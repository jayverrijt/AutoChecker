import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SHIFTS_FILE = path.join(DATA_DIR, 'shifts.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

export const DEFAULT_SETTINGS = {
  workspaceUrl: 'https://picnic.enterprise.slack.com',
  slackToken: '',
  slackCookie: '',
  channelName: '#nl-dist-runners-hlm',
  channelId: 'CAM2MJTA9',
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

// Multi-User Initialization & Migration
function initMultiUserData() {
  const users = readJsonFile(USERS_FILE, {});
  const legacySettings = readJsonFile(SETTINGS_FILE, {});

  // Migrate legacy single-user settings if users.json is empty
  if (Object.keys(users).length === 0) {
    const primaryId = legacySettings.slackUserId || 'U0BQST2DC7R';
    const primaryUsername = legacySettings.slackUsername || 'jayverrijt';

    users[primaryId] = {
      userId: primaryId,
      username: primaryUsername,
      ...DEFAULT_SETTINGS,
      ...legacySettings,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
    users['default'] = users[primaryId];
    writeJsonFile(USERS_FILE, users);
  }

  // Ensure shifts.json is multi-user compliant
  const rawShifts = readJsonFile(SHIFTS_FILE, {});
  const isLegacyShifts = Object.keys(rawShifts).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
  if (isLegacyShifts) {
    const multiShifts = {
      'U0BQST2DC7R': { ...rawShifts },
      'default': { ...rawShifts }
    };
    writeJsonFile(SHIFTS_FILE, multiShifts);
  }

  // Ensure history.json is multi-user compliant
  const rawHistory = readJsonFile(HISTORY_FILE, []);
  if (Array.isArray(rawHistory)) {
    const multiHistory = {
      'U0BQST2DC7R': [...rawHistory],
      'default': [...rawHistory]
    };
    writeJsonFile(HISTORY_FILE, multiHistory);
  }
}

initMultiUserData();

function resolveUserId(userId) {
  if (userId && typeof userId === 'string' && userId.trim().length > 0) {
    return userId.trim();
  }
  const users = readJsonFile(USERS_FILE, {});
  // Look for first non-default user, else default
  const nonDefault = Object.keys(users).find(k => k !== 'default');
  return nonDefault || 'default';
}

export const db = {
  // --- USER MANAGEMENT ---
  getUser: (userId) => {
    const id = resolveUserId(userId);
    const users = readJsonFile(USERS_FILE, {});
    return users[id] || users['default'] || null;
  },

  getAllUsers: () => {
    const users = readJsonFile(USERS_FILE, {});
    const uniqueMap = new Map();
    for (const [id, user] of Object.entries(users)) {
      if (id === 'default' && Object.keys(users).length > 1) continue;
      const actualId = user.userId || id;
      if (!uniqueMap.has(actualId)) {
        uniqueMap.set(actualId, user);
      }
    }
    return Array.from(uniqueMap.values());
  },

  saveUser: (userId, userData) => {
    const id = resolveUserId(userId);
    const users = readJsonFile(USERS_FILE, {});
    const current = users[id] || {};
    const updated = {
      ...current,
      ...userData,
      userId: id,
      lastSeen: new Date().toISOString()
    };
    users[id] = updated;
    // Keep 'default' pointer aligned if single user or default updated
    if (id === 'default' || Object.keys(users).length === 1) {
      users['default'] = updated;
    }
    writeJsonFile(USERS_FILE, users);
    return updated;
  },

  deleteUser: (userId) => {
    const id = resolveUserId(userId);
    const users = readJsonFile(USERS_FILE, {});
    delete users[id];
    writeJsonFile(USERS_FILE, users);
    return true;
  },

  // Returns primary user session for background channel polling
  getPrimaryPollerUser: () => {
    const users = readJsonFile(USERS_FILE, {});
    // 1. Look for user with valid token
    for (const [id, user] of Object.entries(users)) {
      if (id !== 'default' && user.slackToken && user.slackToken.trim().length > 0) {
        return user;
      }
    }
    if (users['default']?.slackToken) return users['default'];
    return { ...DEFAULT_SETTINGS };
  },

  // --- SHIFTS MANAGEMENT ---
  getShifts: (userId) => {
    const id = resolveUserId(userId);
    const raw = readJsonFile(SHIFTS_FILE, {});
    // Backward compatibility: if file is directly a date map
    if (Object.keys(raw).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
      return raw;
    }
    return raw[id] || raw['default'] || {};
  },

  saveShifts: (userIdOrShifts, maybeShifts) => {
    let id;
    let shifts;
    if (maybeShifts !== undefined) {
      id = resolveUserId(userIdOrShifts);
      shifts = maybeShifts;
    } else {
      id = resolveUserId(null);
      shifts = userIdOrShifts;
    }

    const raw = readJsonFile(SHIFTS_FILE, {});
    // If raw was a date map, migrate
    const isDirectMap = Object.keys(raw).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
    const multi = isDirectMap ? { default: { ...raw } } : { ...raw };

    multi[id] = shifts;
    if (id !== 'default') {
      multi['default'] = shifts;
    }
    writeJsonFile(SHIFTS_FILE, multi);
    return shifts;
  },

  getShiftForDate: (userIdOrDate, maybeDate) => {
    let id;
    let dateKey;
    if (maybeDate !== undefined) {
      id = resolveUserId(userIdOrDate);
      dateKey = maybeDate;
    } else {
      id = resolveUserId(null);
      dateKey = userIdOrDate;
    }
    const userShifts = db.getShifts(id);
    return userShifts[dateKey] || null;
  },

  updateShift: (userIdOrDate, dateKeyOrData, maybeData) => {
    let id;
    let dateKey;
    let shiftData;
    if (maybeData !== undefined) {
      id = resolveUserId(userIdOrDate);
      dateKey = dateKeyOrData;
      shiftData = maybeData;
    } else {
      id = resolveUserId(null);
      dateKey = userIdOrDate;
      shiftData = dateKeyOrData;
    }

    const userShifts = db.getShifts(id);
    const targetBlock = shiftData?.block;
    if (targetBlock && ['M1', 'M2', 'S1', 'S2', 'S3'].includes(targetBlock)) {
      userShifts[dateKey] = userShifts[dateKey] || {};
      userShifts[dateKey][targetBlock] = {
        ...(userShifts[dateKey][targetBlock] || {}),
        ...shiftData
      };
    } else {
      userShifts[dateKey] = {
        ...(userShifts[dateKey] || {}),
        ...shiftData
      };
    }
    db.saveShifts(id, userShifts);
    return userShifts;
  },

  // --- SETTINGS MANAGEMENT ---
  getSettings: (userId) => {
    const id = resolveUserId(userId);
    const user = db.getUser(id);
    if (user) {
      return { ...DEFAULT_SETTINGS, ...user };
    }
    const legacy = readJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...legacy };
  },

  saveSettings: (userIdOrSettings, maybeSettings) => {
    let id;
    let newSettings;
    if (maybeSettings !== undefined) {
      id = resolveUserId(userIdOrSettings);
      newSettings = maybeSettings;
    } else {
      id = resolveUserId(newSettings?.userId);
      newSettings = userIdOrSettings;
    }

    const current = db.getSettings(id);
    const updated = { ...current, ...newSettings };
    db.saveUser(id, updated);
    // Also update legacy settings.json for backward compatibility
    writeJsonFile(SETTINGS_FILE, updated);
    return updated;
  },

  // --- HISTORY MANAGEMENT ---
  getHistory: (userId) => {
    const id = resolveUserId(userId);
    const raw = readJsonFile(HISTORY_FILE, {});
    if (Array.isArray(raw)) return raw;
    return raw[id] || raw['default'] || [];
  },

  addHistoryItem: (userIdOrItem, maybeItem) => {
    let id;
    let item;
    if (maybeItem !== undefined) {
      id = resolveUserId(userIdOrItem);
      item = maybeItem;
    } else {
      id = resolveUserId(null);
      item = userIdOrItem;
    }

    const raw = readJsonFile(HISTORY_FILE, {});
    const multi = Array.isArray(raw) ? { default: [...raw] } : { ...raw };
    const userHistory = multi[id] || multi['default'] || [];

    userHistory.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...item
    });

    const trimmed = userHistory.slice(0, 100);
    multi[id] = trimmed;
    if (id !== 'default') {
      multi['default'] = trimmed;
    }
    writeJsonFile(HISTORY_FILE, multi);
    return trimmed;
  },

  clearHistory: (userId) => {
    const id = resolveUserId(userId);
    const raw = readJsonFile(HISTORY_FILE, {});
    const multi = Array.isArray(raw) ? { default: [] } : { ...raw };
    multi[id] = [];
    writeJsonFile(HISTORY_FILE, multi);
    return [];
  }
};
