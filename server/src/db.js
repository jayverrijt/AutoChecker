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

// Initial default shifts for demonstration (current week / month)
const DEFAULT_SHIFTS = {
  // Key format: YYYY-MM-DD
  '2026-10-17': {
    block: 'S1', // S1 -> :1-red:
    startTime: '13:00',
    endTime: '21:30',
    vrijcheckActive: true,
    reactionStatus: null
  },
  '2026-10-18': {
    block: 'M1', // M1 -> :1-red:
    startTime: '06:30',
    endTime: '15:00',
    vrijcheckActive: true,
    reactionStatus: null
  },
  '2026-10-19': {
    block: 'S2', // S2 -> :2-red:
    startTime: '14:00',
    endTime: '22:30',
    vrijcheckActive: true,
    reactionStatus: null
  },
  '2026-10-20': {
    block: 'none',
    vrijcheckActive: false,
    reactionStatus: null
  },
  '2026-10-21': {
    block: 'S3', // S3 -> :3-red:
    startTime: '16:30',
    endTime: '23:00',
    vrijcheckActive: true,
    reactionStatus: null
  }
};

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
