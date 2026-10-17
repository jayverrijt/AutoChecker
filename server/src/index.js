import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { SlackBotManager } from './slackBot.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST = path.join(__dirname, '../../client/dist');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
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


const botManager = new SlackBotManager(io);

// Initialize bot on startup
botManager.initialize();

// Socket.io handlers
io.on('connection', (socket) => {
  console.log(`[SOCKET] Client verbonden: ${socket.id}`);

  // Send initial state to newly connected client
  socket.emit('bot:status', botManager.getStatus());
  socket.emit('shifts:updated', db.getShifts());
  socket.emit('settings:updated', db.getSettings());
  socket.emit('history:updated', db.getHistory());

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client verbroken: ${socket.id}`);
  });
});

// REST API Endpoints

// 1. Shifts
app.get('/api/shifts', (req, res) => {
  res.json(db.getShifts());
});

app.post('/api/shifts', (req, res) => {
  const { dateKey, shift } = req.body;
  if (!dateKey) {
    return res.status(400).json({ error: 'dateKey is verplicht (YYYY-MM-DD)' });
  }

  const updatedShifts = db.updateShift(dateKey, shift);
  io.emit('shifts:updated', updatedShifts);
  res.json(updatedShifts);
});

app.post('/api/shifts/bulk', (req, res) => {
  const { shifts } = req.body;
  if (!shifts) {
    return res.status(400).json({ error: 'shifts object is verplicht' });
  }
  db.saveShifts(shifts);
  io.emit('shifts:updated', shifts);
  res.json(shifts);
});

// 2. Settings
app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.post('/api/settings', async (req, res) => {
  const updated = db.saveSettings(req.body);
  io.emit('settings:updated', updated);

  // Reinitialize Slack Bot if token or channel changed
  await botManager.initialize();
  io.emit('bot:status', botManager.getStatus());

  res.json(updated);
});

// 3. Bot Status & Control
app.get('/api/status', (req, res) => {
  res.json(botManager.getStatus());
});

app.post('/api/bot/reconnect', async (req, res) => {
  await botManager.initialize();
  const status = botManager.getStatus();
  io.emit('bot:status', status);
  res.json(status);
});

app.post('/api/bot/test-connection', async (req, res) => {
  const result = await botManager.testConnection();
  io.emit('bot:status', botManager.getStatus());
  res.json(result);
});

app.post('/api/bot/test-reaction', async (req, res) => {
  const { emoji = '3-red' } = req.body || {};
  try {
    const result = await botManager.testRealReactionOnSlack({ emoji });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Reaction History
app.get('/api/history', (req, res) => {
  res.json(db.getHistory());
});

app.post('/api/history/clear', (req, res) => {
  const cleared = db.clearHistory();
  io.emit('history:updated', cleared);
  res.json({ success: true, history: cleared });
});

// 5. Simulation Endpoint (Simuleer Day-Planning-Sender bericht)
app.post('/api/simulate', async (req, res) => {
  const { period = 'MIDDAG', date = '17-10-2026', overschotten } = req.body;
  const result = await botManager.simulateDayPlannerMessage({
    period,
    date,
    overschotten: overschotten || { shift1: 3, shift2: 4, shift3: 2 }
  });
  res.json({ success: true, result });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// SPA wildcard fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {

  console.log(`[SERVER] Vrijcheck backend actief op http://0.0.0.0:${PORT}`);
});
