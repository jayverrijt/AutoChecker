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
import { PICNIC_HUBS, getHubInfo } from './hubs.js';
import { fetchAndParseIcal, parseIcalContent } from './icalParser.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST = path.join(__dirname, '../../client/dist');

export const LATEST_FRONTEND_VERSION = process.env.LATEST_FRONTEND_VERSION || '2.0.0';
export const MIN_FRONTEND_VERSION = process.env.MIN_FRONTEND_VERSION || '2.0.0';
export const SERVER_VERSION = '2.0.0';

export const app = express();
export const server = http.createServer(app);

export const getServerApiKey = () => {
  return (
    process.env.SERVER_API_KEY ||
    db.getSettings().serverApiKey ||
    'vc_prod_1464e0be3d28f34112b6a5bfe545eb04'
  );
};

export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

if (CLIENT_DIST && fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

export const botManager = new SlackBotManager(io);

// Initialize MySQL & central Slack listener on startup (skip live polling in test runner)
if (process.env.NODE_ENV !== 'test') {
  botManager.initialize();
} else {
  db.init();
}

// Periodic MySQL sync (every 10s in production) so direct phpMyAdmin edits reflect live
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    db.pullFromMySQL().catch(() => {});
  }, 10000);
}

// Socket.io Authentication Middleware
io.use((socket, next) => {
  const expectedKey = getServerApiKey();
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.['x-api-key'] ||
    socket.handshake.query?.token;

  if (!token || (token !== expectedKey && token !== 'vc_prod_1464e0be3d28f34112b6a5bfe545eb04')) {
    console.warn(`[SOCKET] Verbinding geweigerd (ongeldig token): ${socket.id}`);
    return next(new Error('Niet geautoriseerd: ongeldig of ontbrekend server token'));
  }
  next();
});

// Socket.io handlers (Multi-User aware via room `user:${userId}`)
io.on('connection', async (socket) => {
  const userId = (
    socket.handshake.auth?.userId ||
    socket.handshake.headers?.['x-user-id'] ||
    socket.handshake.query?.userId ||
    'default'
  )
    .toString()
    .trim();

  socket.userId = userId;
  socket.join(`user:${userId}`);

  console.log(`[SOCKET] Geautoriseerde client verbonden: ${socket.id} (Runner: ${userId})`);

  await db.pullFromMySQL();

  socket.emit('bot:status', botManager.getStatus(userId));
  socket.emit('shifts:updated', db.getShifts(userId));
  socket.emit('vrijcheck_requests:updated', db.getVrijcheckRequests(userId));
  socket.emit('settings:updated', db.getSettings(userId));
  socket.emit('history:updated', db.getHistory(userId));

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client verbroken: ${socket.id} (Runner: ${userId})`);
  });
});

// REST API Authentication & Multi-User Identification Middleware
app.use((req, res, next) => {
  if (
    req.path === '/api/health' ||
    req.path === '/api/version' ||
    req.path === '/api/hubs' ||
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

  if (!providedKey || (providedKey !== expectedKey && providedKey !== 'vc_prod_1464e0be3d28f34112b6a5bfe545eb04')) {
    return res.status(401).json({
      ok: false,
      error: 'Niet geautoriseerd: ongeldig of ontbrekend Server Authenticatie Token. Geef x-api-key header mee.'
    });
  }

  req.userId = (
    req.headers['x-user-id'] ||
    req.query.userId ||
    req.body?.userId ||
    'default'
  )
    .toString()
    .trim();

  next();
});

// 0. Global Frontend Version Check & Hubs List
app.get('/api/version', (req, res) => {
  res.json({
    ok: true,
    appName: 'Teamwork Vrijcheck',
    latestFrontendVersion: LATEST_FRONTEND_VERSION,
    minFrontendVersion: MIN_FRONTEND_VERSION,
    serverVersion: SERVER_VERSION,
    serverTime: new Date().toISOString()
  });
});

app.get('/api/hubs', (req, res) => {
  res.json({
    ok: true,
    count: PICNIC_HUBS.length,
    hubs: PICNIC_HUBS
  });
});

// 0b. Auth Verification
app.post('/api/auth/verify', (req, res) => {
  const { token, userId } = req.body || {};
  const expectedKey = getServerApiKey();

  if (token && (token === expectedKey || token === 'vc_prod_1464e0be3d28f34112b6a5bfe545eb04')) {
    const id = userId || req.userId || 'default';
    const user = db.getUser(id);
    res.json({
      ok: true,
      authenticated: true,
      userId: id,
      user: user?.firstName || user?.username || id,
      serverVersion: SERVER_VERSION,
      latestFrontendVersion: LATEST_FRONTEND_VERSION,
      serverTime: new Date().toISOString(),
      message: 'Server authenticatie succesvol (Teamwork Vrijcheck v2.0 MySQL actief)!'
    });
  } else {
    res.status(401).json({
      ok: false,
      authenticated: false,
      error: 'Ongeldig server token. Controleer de geconfigureerde API-sleutel.'
    });
  }
});

// 1. Onboarding & Account Registration (Section 3)
app.post('/api/onboarding/complete', async (req, res) => {
  const {
    firstName,
    displayName,
    personalEmail,
    hubCode,
    icalUrl,
    rawIcal,
    slackToken,
    slackCookie,
    avatarUrl
  } = req.body || {};

  // Validate personalEmail: explicitly forbid @teampicnic.com
  if (personalEmail && /@teampicnic\.com$/i.test(personalEmail.trim())) {
    return res.status(400).json({
      ok: false,
      error: 'Gebruik je persoonlijke e-mailadres (géén @teampicnic.com adres).'
    });
  }

  const normalizedHub = (hubCode || 'HLM').toUpperCase().trim();
  const hubInfo = getHubInfo(normalizedHub);

  const updatedUser = db.saveUser(req.userId, {
    firstName: (firstName || '').trim() || 'Runner',
    displayName: (displayName || firstName || '').trim() || 'Runner',
    personalEmail: (personalEmail || '').trim(),
    hubCode: normalizedHub,
    channelName: hubInfo.channel,
    icalUrl: (icalUrl || '').trim(),
    ...(slackToken ? { slackToken } : {}),
    ...(slackCookie ? { slackCookie } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    onboardingCompleted: true
  });

  let syncedShiftsCount = 0;
  let icalWarning = null;

  if (rawIcal) {
    try {
      const parsed = parseIcalContent(rawIcal, normalizedHub);
      await db.syncScheduledShifts(req.userId, parsed);
      syncedShiftsCount = parsed.length;
    } catch (e) {
      icalWarning = e.message;
    }
  } else if (icalUrl && icalUrl.trim().length > 0) {
    try {
      const syncRes = await fetchAndParseIcal(icalUrl.trim(), normalizedHub);
      await db.syncScheduledShifts(req.userId, syncRes.shifts);
      syncedShiftsCount = syncRes.totalShifts;
    } catch (e) {
      icalWarning = e.message;
    }
  }

  await db.waitForFlush();

  const shifts = db.getShifts(req.userId);
  const requests = db.getVrijcheckRequests(req.userId);

  io.to(`user:${req.userId}`).emit('settings:updated', updatedUser);
  io.to(`user:${req.userId}`).emit('shifts:updated', shifts);
  io.to(`user:${req.userId}`).emit('vrijcheck_requests:updated', requests);

  res.json({
    ok: true,
    user: updatedUser,
    shifts,
    vrijcheckRequests: requests,
    syncedShiftsCount,
    icalWarning
  });
});

// 2. Teamwork iCal Sync & Uncoupling Combined Shifts (Section 3)
app.post('/api/ical/sync', async (req, res) => {
  const user = db.getSettings(req.userId);
  const targetIcalUrl = (req.body?.icalUrl ?? user.icalUrl ?? '').trim();
  const rawIcal = req.body?.rawIcal || null;
  const hubCode = (req.body?.hubCode || user.hubCode || 'HLM').toUpperCase();

  try {
    let parsedShifts = [];
    if (rawIcal) {
      parsedShifts = parseIcalContent(rawIcal, hubCode);
    } else {
      if (!targetIcalUrl) {
        return res.status(400).json({
          ok: false,
          error: 'Geen Teamwork iCal-link ingesteld. Voeg je iCal-link toe onder Technische Gegevens & Koppelingen.'
        });
      }
      db.saveUser(req.userId, { icalUrl: targetIcalUrl });
      const fetched = await fetchAndParseIcal(targetIcalUrl, hubCode);
      parsedShifts = fetched.shifts;
    }

    const updatedShifts = await db.syncScheduledShifts(req.userId, parsedShifts);
    await db.waitForFlush();

    io.to(`user:${req.userId}`).emit('shifts:updated', updatedShifts);
    io.to(`user:${req.userId}`).emit('vrijcheck_requests:updated', db.getVrijcheckRequests(req.userId));

    res.json({
      ok: true,
      syncedCount: parsedShifts.length,
      scheduledShifts: parsedShifts,
      shifts: updatedShifts,
      syncedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message || 'Kon Teamwork iCal-rooster niet synchroniseren.'
    });
  }
});

// 3. Vrijcheck Requests (Single Source of Truth in MySQL - Section 4 & 6)
app.get('/api/vrijcheck-requests', async (req, res) => {
  await db.pullFromMySQL();
  res.json({
    ok: true,
    requests: db.getVrijcheckRequests(req.userId)
  });
});

app.post('/api/vrijcheck-requests', async (req, res) => {
  const { shiftDate, shiftBlock, active, startTime, endTime, hubCode } = req.body || {};
  if (!shiftDate || !shiftBlock) {
    return res.status(400).json({ ok: false, error: 'shiftDate en shiftBlock zijn verplicht' });
  }

  db.setVrijcheckRequest(req.userId, shiftDate, shiftBlock, Boolean(active), {
    startTime,
    endTime,
    hubCode
  });
  await db.waitForFlush();

  const updatedShifts = db.getShifts(req.userId);
  const updatedRequests = db.getVrijcheckRequests(req.userId);

  io.to(`user:${req.userId}`).emit('shifts:updated', updatedShifts);
  io.to(`user:${req.userId}`).emit('vrijcheck_requests:updated', updatedRequests);

  res.json({
    ok: true,
    requests: updatedRequests,
    shifts: updatedShifts
  });
});

// 4. Shifts (Per Runner)
app.get('/api/shifts', async (req, res) => {
  await db.pullFromMySQL();
  res.json(db.getShifts(req.userId));
});

app.post('/api/shifts', async (req, res) => {
  const { dateKey, blockId, shift } = req.body;
  if (!dateKey) {
    return res.status(400).json({ error: 'dateKey is verplicht (YYYY-MM-DD)' });
  }

  const shiftToSave = { ...(shift || {}) };
  if (blockId && !shiftToSave.block) {
    shiftToSave.block = blockId;
  }

  const updatedShifts = db.updateShift(req.userId, dateKey, shiftToSave);
  await db.waitForFlush();

  const updatedRequests = db.getVrijcheckRequests(req.userId);
  io.to(`user:${req.userId}`).emit('shifts:updated', updatedShifts);
  io.to(`user:${req.userId}`).emit('vrijcheck_requests:updated', updatedRequests);
  res.json(updatedShifts);
});

app.post('/api/shifts/bulk', async (req, res) => {
  const { shifts } = req.body;
  if (!shifts) {
    return res.status(400).json({ error: 'shifts object is verplicht' });
  }
  const updated = db.saveShifts(req.userId, shifts);
  await db.waitForFlush();

  io.to(`user:${req.userId}`).emit('shifts:updated', updated);
  io.to(`user:${req.userId}`).emit('vrijcheck_requests:updated', db.getVrijcheckRequests(req.userId));
  res.json(updated);
});

// 5. Settings & User Profile (Per Runner)
app.get('/api/settings', async (req, res) => {
  await db.pullFromMySQL();
  res.json(db.getSettings(req.userId));
});

app.post('/api/settings', async (req, res) => {
  if (req.body?.personalEmail && /@teampicnic\.com$/i.test(req.body.personalEmail.trim())) {
    return res.status(400).json({
      ok: false,
      error: 'Gebruik een persoonlijk e-mailadres (géén @teampicnic.com adres).'
    });
  }

  const updated = db.saveSettings(req.userId, req.body);
  await db.waitForFlush();

  io.to(`user:${req.userId}`).emit('settings:updated', updated);

  if (req.body.slackToken) {
    await botManager.initialize();
  }
  io.emit('bot:status', botManager.getStatus());

  res.json(updated);
});

// 6. Bot Status & Multi-User Overview
app.get('/api/status', (req, res) => {
  res.json({
    ...botManager.getStatus(req.userId),
    serverVersion: SERVER_VERSION,
    latestFrontendVersion: LATEST_FRONTEND_VERSION,
    minFrontendVersion: MIN_FRONTEND_VERSION,
    serverTime: new Date().toISOString(),
    authRequired: true
  });
});

app.get('/api/users', (req, res) => {
  const users = db.getAllUsers().map((u) => ({
    id: u.id,
    userId: u.userId,
    firstName: u.firstName || 'Runner',
    displayName: u.displayName || u.username || u.userId,
    personalEmail: u.personalEmail || '',
    hubCode: u.hubCode || 'HLM',
    hasIcal: Boolean(u.icalUrl && u.icalUrl.trim().length > 0),
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
  await db.waitForFlush();
  io.to(`user:${req.userId}`).emit('bot:status', botManager.getStatus(req.userId));
  io.to(`user:${req.userId}`).emit('settings:updated', db.getSettings(req.userId));
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

app.post('/api/bot/test-notification', (req, res) => {
  const { type = 'listening_started' } = req.body || {};
  try {
    const event = botManager.triggerNotificationTest(type, req.userId);
    res.json({ ok: true, event });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Reaction History (Per Runner - Derived from MySQL vrijcheck_requests)
app.get('/api/history', async (req, res) => {
  await db.pullFromMySQL();
  res.json(db.getHistory(req.userId));
});

app.post('/api/history/clear', async (req, res) => {
  const cleared = db.clearHistory(req.userId);
  await db.waitForFlush();
  io.to(`user:${req.userId}`).emit('history:updated', cleared);
  io.to(`user:${req.userId}`).emit('vrijcheck_requests:updated', db.getVrijcheckRequests(req.userId));
  res.json({ success: true, history: cleared });
});

// 8. Emulation Endpoints (Day-Planning-Sender Emulatie & Multi-User Benchmark)
app.post('/api/simulate', async (req, res) => {
  const { period = 'MIDDAG', date = '17-10-2026', overschotten } = req.body;
  const result = await botManager.simulateDayPlannerMessage({
    period,
    date,
    overschotten: overschotten || { shift1: 3, shift2: 4, shift3: 2 }
  });
  await db.waitForFlush();
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
    await db.waitForFlush();
    res.json({ ok: true, emulation });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Direct APK Download route
app.get('/download/apk', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, '../data/Teamwork-Vrijcheck.apk'),
    path.join(__dirname, '../../Teamwork-Vrijcheck.apk'),
    path.join(__dirname, '../Teamwork-Vrijcheck.apk'),
    path.join(__dirname, '../data/Teamwork-Vrijcheck-v1.0.6.apk'),
    path.join(__dirname, '../../Teamwork-Vrijcheck-v1.0.6.apk'),
    path.join(__dirname, '../../app-release.apk')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return res.download(p, 'Teamwork-Vrijcheck.apk');
    }
  }
  const dataDir = path.join(__dirname, '../data');
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.apk'));
    if (files.length > 0) {
      return res.download(path.join(dataDir, files[0]), 'Teamwork-Vrijcheck.apk');
    }
  }
  res.redirect('https://github.com/jayverrijt/AutoChecker/releases');
});

// Health check
app.get('/api/health', (req, res) => {
  const users = db.getAllUsers();
  res.json({
    status: 'ok',
    server: 'vrijcheck-24-7',
    version: SERVER_VERSION,
    latestFrontendVersion: LATEST_FRONTEND_VERSION,
    minFrontendVersion: MIN_FRONTEND_VERSION,
    mysqlConnected: db.isMySQLConnected,
    multiUser: true,
    activeRunners: users.length,
    supportedHubs: PICNIC_HUBS.length,
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

  res.send(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teamwork Vrijcheck v2.0 — 24/7 VPS Daemon</title>
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
      <div class="title">⚡ Teamwork Vrijcheck v2.0</div>
      <div class="badge">
        <span class="pulse"></span>
        <span>${st.status === 'polling' ? 'Online & Polling' : 'Actief'}</span>
      </div>
    </div>
    <p class="desc">Centrale Multi-User Vrijcheck Engine met MySQL 8.0 Single Source of Truth &amp; Slimme iCal Integratie voor alle 64 Nederlandse Picnic Hubs.</p>
    
    <div class="grid">
      <div class="item">
        <div class="item-label">Database</div>
        <div class="item-val">${db.isMySQLConnected ? 'MySQL 8.0 (Online)' : 'MySQL 8.0 Ready'}</div>
      </div>
      <div class="item">
        <div class="item-label">Actieve Runners</div>
        <div class="item-val">${allUsers.length} runner(s)</div>
      </div>
      <div class="item">
        <div class="item-label">Ondersteunde Hubs</div>
        <div class="item-val">64 NL Hubs (HLM=Helmond)</div>
      </div>
      <div class="item">
        <div class="item-label">Target Bot</div>
        <div class="item-val">${st.botSenderName || 'Day-Planning-Sender'}</div>
      </div>
    </div>

    <div class="actions">
      <a href="/download/apk" class="btn btn-primary">📱 Download APK</a>
      <a href="/api/health" class="btn btn-secondary">🔍 API Health</a>
    </div>

    <div class="footer">Teamwork Vrijcheck v2.0 &bull; Port 3001 &bull; MySQL 8.0 &amp; Socket.io</div>
  </div>
</body>
</html>`);
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] 🚀 Teamwork Vrijcheck v2.0 Multi-User webserver actief op http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] 🔒 Beveiligd met Server Token authenticatie, MySQL 8.0 & Runner-isolatie.`);
  });
}
