import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { SlackBotManager } from './slackBot.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST = path.join(__dirname, '../../client/dist');

export const app = express();
export const server = http.createServer(app);

export const getServerApiKey = () => {
  return process.env.SERVER_API_KEY || db.getSettings().serverApiKey || 'REDACTED_API_KEY';
};

export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend build if present
if (CLIENT_DIST) {
  app.use(express.static(CLIENT_DIST));
}

export const botManager = new SlackBotManager(io);

// Initialize central listener on startup
botManager.initialize();

// Socket.io Authentication Middleware
io.use((socket, next) => {
  const expectedKey = getServerApiKey();
  const token = 
    socket.handshake.auth?.token ||
    socket.handshake.headers?.['x-api-key'] ||
    socket.handshake.query?.token;

  if (!token || token !== expectedKey) {
    console.warn(`[SOCKET] Verbinding geweigerd (ongeldig token): ${socket.id}`);
    return next(new Error('Niet geautoriseerd: ongeldig of ontbrekend server token'));
  }
  next();
});

// Socket.io handlers (Multi-User aware via room `user:${userId}`)
io.on('connection', (socket) => {
  const userId = (
    socket.handshake.auth?.userId ||
    socket.handshake.headers?.['x-user-id'] ||
    socket.handshake.query?.userId ||
    'default'
  ).toString().trim();

  socket.userId = userId;
  socket.join(`user:${userId}`);

  console.log(`[SOCKET] Geautoriseerde client verbonden: ${socket.id} (Runner: ${userId})`);

  // Send initial state specific to this runner
  socket.emit('bot:status', botManager.getStatus(userId));
  socket.emit('shifts:updated', db.getShifts(userId));
  socket.emit('settings:updated', db.getSettings(userId));
  socket.emit('history:updated', db.getHistory(userId));

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client verbroken: ${socket.id} (Runner: ${userId})`);
  });
});

// REST API Authentication & Multi-User Identification Middleware
app.use((req, res, next) => {
  // Allow health check, auth verification, and non-api routes without token
  if (
    req.path === '/api/health' || 
    req.path === '/api/auth/verify' || 
    !req.path.startsWith('/api')
  ) {
    return next();
  }

  const expectedKey = getServerApiKey();
  const providedKey = 
    req.headers['x-api-key'] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.query.token;

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ 
      ok: false, 
      error: 'Niet geautoriseerd: ongeldig of ontbrekend Server Authenticatie Token. Geef x-api-key header mee.' 
    });
  }

  // Extract runner userId
  req.userId = (
    req.headers['x-user-id'] ||
    req.query.userId ||
    req.body?.userId ||
    'default'
  ).toString().trim();

  next();
});

// REST API Endpoints

// 0. Auth Verification
app.post('/api/auth/verify', (req, res) => {
  const { token, userId } = req.body || {};
  const expectedKey = getServerApiKey();

  if (token && token === expectedKey) {
    const id = userId || req.userId || 'default';
    const user = db.getUser(id);
    res.json({
      ok: true,
      authenticated: true,
      userId: id,
      user: user?.username || id,
      serverTime: new Date().toISOString(),
      message: 'Server authenticatie succesvol (Multi-User actief)!'
    });
  } else {
    res.status(401).json({
      ok: false,
      authenticated: false,
      error: 'Ongeldig server token. Controleer de geconfigureerde API-sleutel.'
    });
  }
});

// 1. Shifts (Per Runner)
app.get('/api/shifts', (req, res) => {
  res.json(db.getShifts(req.userId));
});

app.post('/api/shifts', (req, res) => {
  const { dateKey, shift } = req.body;
  if (!dateKey) {
    return res.status(400).json({ error: 'dateKey is verplicht (YYYY-MM-DD)' });
  }

  const updatedShifts = db.updateShift(req.userId, dateKey, shift);
  io.to(`user:${req.userId}`).emit('shifts:updated', updatedShifts);
  res.json(updatedShifts);
});

app.post('/api/shifts/bulk', (req, res) => {
  const { shifts } = req.body;
  if (!shifts) {
    return res.status(400).json({ error: 'shifts object is verplicht' });
  }
  db.saveShifts(req.userId, shifts);
  io.to(`user:${req.userId}`).emit('shifts:updated', shifts);
  res.json(shifts);
});

// 2. Settings (Per Runner)
app.get('/api/settings', (req, res) => {
  res.json(db.getSettings(req.userId));
});

app.post('/api/settings', async (req, res) => {
  const updated = db.saveSettings(req.userId, req.body);
  io.to(`user:${req.userId}`).emit('settings:updated', updated);

  // If Slack token was updated or server was disconnected, reinitialize poller
  if (req.body.slackToken) {
    await botManager.initialize();
  }
  io.emit('bot:status', botManager.getStatus());

  res.json(updated);
});

// 3. Bot Status & Multi-User Overview
app.get('/api/status', (req, res) => {
  res.json({
    ...botManager.getStatus(req.userId),
    serverTime: new Date().toISOString(),
    authRequired: true
  });
});

app.get('/api/users', (req, res) => {
  const users = db.getAllUsers().map(u => ({
    userId: u.userId,
    username: u.username || u.userId,
    hasToken: Boolean(u.slackToken && u.slackToken.trim().length > 0),
    autoReact: u.autoReact !== false,
    lastSeen: u.lastSeen
  }));
  res.json({ ok: true, count: users.length, users });
});

app.post('/api/bot/reconnect', async (req, res) => {
  await botManager.initialize();
  const status = botManager.getStatus(req.userId);
  io.emit('bot:status', botManager.getStatus());
  res.json(status);
});

app.post('/api/bot/test-connection', async (req, res) => {
  const result = await botManager.testConnection(req.userId);
  io.to(`user:${req.userId}`).emit('bot:status', botManager.getStatus(req.userId));
  res.json(result);
});

app.post('/api/bot/test-reaction', async (req, res) => {
  const { emoji = '3-red' } = req.body || {};
  try {
    const result = await botManager.testRealReactionOnSlack({ emoji, userId: req.userId });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Reaction History (Per Runner)
app.get('/api/history', (req, res) => {
  res.json(db.getHistory(req.userId));
});

app.post('/api/history/clear', (req, res) => {
  const cleared = db.clearHistory(req.userId);
  io.to(`user:${req.userId}`).emit('history:updated', cleared);
  res.json({ success: true, history: cleared });
});

// 5. Emulation Endpoints (Day-Planning-Sender Emulatie & Multi-User Benchmark)
app.post('/api/simulate', async (req, res) => {
  const { period = 'MIDDAG', date = '17-10-2026', overschotten } = req.body;
  const result = await botManager.simulateDayPlannerMessage({
    period,
    date,
    overschotten: overschotten || { shift1: 3, shift2: 4, shift3: 2 }
  });
  res.json({ success: true, result });
});

app.post('/api/test/emulate-planner', async (req, res) => {
  const {
    period = 'OCHTEND',
    date,
    minDelayMs = 40,
    maxDelayMs = 180,
    overschotten,
    isSimulation = true
  } = req.body || {};

  try {
    const emulation = await botManager.emulator.emulatePost({
      period,
      date,
      minDelayMs,
      maxDelayMs,
      overschotten,
      isSimulation
    });
    res.json({ ok: true, emulation });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const users = db.getAllUsers();
  res.json({ 
    status: 'ok', 
    server: 'vrijcheck-24-7',
    multiUser: true,
    activeRunners: users.length,
    time: new Date().toISOString(),
    authRequired: true
  });
});

// SPA wildcard fallback or Server Status Dashboard
app.get('*', (req, res) => {
  const clientIndex = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(clientIndex)) {
    return res.sendFile(clientIndex);
  }

  const st = botManager.getStatus();
  const allUsers = db.getAllUsers();
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeStr = `${hours}u ${minutes}m ${seconds}s`;

  res.send(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoChecker 24/7 VPS Daemon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0c0d12; color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #161722; border: 1px solid #272a38; border-radius: 20px; max-width: 500px; width: 100%; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .title { font-size: 19px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 9999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 12px; font-weight: 700; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .desc { font-size: 13px; color: #9ca3af; line-height: 1.5; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
    .item { background: #0f1017; border: 1px solid #20222f; border-radius: 12px; padding: 12px; }
    .item-label { font-size: 10px; text-transform: uppercase; color: #8e95a5; font-weight: 700; letter-spacing: 0.5px; }
    .item-val { font-size: 13px; font-weight: 700; color: #fff; margin-top: 4px; font-family: ui-monospace, SFMono-Regular, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .actions { display: flex; gap: 10px; margin-top: 24px; }
    .btn { flex: 1; text-align: center; padding: 12px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: 700; transition: transform 0.1s; }
    .btn:active { transform: scale(0.97); }
    .btn-primary { background: #e11d48; color: #fff; }
    .btn-secondary { background: #222432; color: #d1d5db; border: 1px solid #323547; }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">⚡ AutoChecker 24/7</div>
      <div class="badge">
        <span class="pulse"></span>
        <span>${st.status === 'polling' ? 'Online & Polling' : 'Actief'}</span>
      </div>
    </div>
    <p class="desc">Centrale Multi-User Vrijcheck Engine. Luistert 24/7 en checkt alle aangesloten runners parallel vrij.</p>
    
    <div class="grid">
      <div class="item">
        <div class="item-label">Architectuur</div>
        <div class="item-val">Multi-User (24/7)</div>
      </div>
      <div class="item">
        <div class="item-label">Actieve Runners</div>
        <div class="item-val">${allUsers.length} runner(s)</div>
      </div>
      <div class="item">
        <div class="item-label">Kanaal</div>
        <div class="item-val">${st.channelName || '#nl-dist-runners-hlm'}</div>
      </div>
      <div class="item">
        <div class="item-label">Target Bot</div>
        <div class="item-val">${st.botSenderName || 'Day-Planning-Sender'}</div>
      </div>
    </div>

    <div class="actions">
      <a href="https://github.com/jayverrijt/AutoChecker/releases" class="btn btn-primary" target="_blank">📱 Download App (APK)</a>
      <a href="/api/health" class="btn btn-secondary">🔍 API Health</a>
    </div>

    <div class="footer">AutoChecker Multi-Tenant Engine &bull; Port 3001 &bull; REST API &amp; Socket.io</div>
  </div>
</body>
</html>`);
});

// Start listening if run directly
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] 🚀 Vrijcheck 24/7 Multi-User webserver actief op http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] 🔒 Beveiligd met Server Token authenticatie & Runner-isolatie.`);
  });
}
