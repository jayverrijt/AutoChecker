import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SHIFTS_FILE = path.join(DATA_DIR, 'shifts.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

const DEFAULT_SETTINGS = {
  workspaceUrl: 'https://picnic.enterprise.slack.com',
  slackToken: '', // xoxc-... (Enterprise session) of xoxp-... (User token)
  slackCookie: '', // d=xoxd-... cookie voor Enterprise Slack
  channelName: '#nl-dist-runners-hlm',
  channelId: '',
  botSenderName: 'Day-Planning-Sender',
  autoReact: true,
  pollIntervalMs: 1000,
  emojiMapping: {
    M1: '1-red',
    M2: '2-red',
    S1: '1-red',
    S2: '2-red',
    S3: '3-red'
  },
  soundEnabled: true,
  simulationMode: false
};

// Initial default shifts (empty by default; user explicitly sets shifts)
const DEFAULT_SHIFTS = {};

function readJsonFile(file, defaultData) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultData;
  }
}

function writeJsonFile(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

export const db = {
  getShifts: () => readJsonFile(SHIFTS_FILE, DEFAULT_SHIFTS),
  saveShifts: (shifts) => writeJsonFile(SHIFTS_FILE, shifts),
  
  getShiftForDate: (dateKey) => {
    const shifts = readJsonFile(SHIFTS_FILE, DEFAULT_SHIFTS);
    return shifts[dateKey] || null;
  },

  updateShift: (dateKey, shiftData) => {
    const shifts = readJsonFile(SHIFTS_FILE, DEFAULT_SHIFTS);
    shifts[dateKey] = {
      ...(shifts[dateKey] || {}),
      ...shiftData
    };
    writeJsonFile(SHIFTS_FILE, shifts);
    return shifts;
  },

  getSettings: () => {
    const saved = readJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...saved };
  },

  saveSettings: (settings) => {
    const current = readJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
    const updated = { ...current, ...settings };
    writeJsonFile(SETTINGS_FILE, updated);
    return updated;
  },

  getHistory: () => readJsonFile(HISTORY_FILE, []),
  
  addHistoryItem: (item) => {
    const history = readJsonFile(HISTORY_FILE, []);
    history.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...item
    });
    // Keep last 100 history items
    const trimmed = history.slice(0, 100);
    writeJsonFile(HISTORY_FILE, trimmed);
    return trimmed;
  },

  clearHistory: () => {
    writeJsonFile(HISTORY_FILE, []);
    return [];
  }
};
