import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { BLOCK_DEFAULT_TIMES, VALID_SHIFT_BLOCKS } from './icalParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

export const DEFAULT_EMOJI_MAPPING = {
  M1: '1-red',
  M2: '2-red',
  M3: '3-red',
  M4: '4-red',
  S1: '1-red',
  S2: '2-red',
  S3: '3-red',
  S4: '4-red'
};

export const DEFAULT_SETTINGS = {
  workspaceUrl: 'https://picnic.enterprise.slack.com',
  slackToken: '',
  slackCookie: '',
  hubCode: 'HLM',
  channelName: '#nl-dist-runners-hlm',
  channelId: 'CAM2MJTA9',
  firstName: 'Runner',
  displayName: '',
  personalEmail: '',
  avatarUrl: null,
  icalUrl: '',
  onboardingCompleted: false,
  botSenderName: 'Day-Planning-Sender',
  autoReact: true,
  autoPicnicReact: true,
  notify1mBefore: true,
  notifyCompletion: true,
  pollIntervalMs: 1000,
  emojiMapping: { ...DEFAULT_EMOJI_MAPPING },
  soundEnabled: true,
  simulationMode: false
};

/**
 * Bugfix #2: Extract first name from Slack profile.display_name or profile.real_name
 * Fallback is ALWAYS "Runner" (never hardcoded to a specific person).
 */
export function extractFirstName(displayName, realName, fallback = 'Runner') {
  const candidates = [displayName, realName];
  for (const raw of candidates) {
    if (raw && typeof raw === 'string' && raw.trim().length > 0) {
      const cleaned = raw.trim().replace(/^[0-9_\-\s]+/, '');
      const firstWord = cleaned.split(/\s+/)[0];
      if (firstWord && firstWord.length > 0) {
        return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      }
    }
  }
  return fallback;
}

class MySQLDatabase {
  constructor() {
    this.pool = null;
    this.isMySQLConnected = false;
    this.initPromise = null;
    this.pendingWrites = new Set();

    // Relational in-memory tables mirroring MySQL 8.0 schema
    this.usersBySlackId = new Map(); // slack_user_id -> user row
    this.userIdBySlackId = new Map(); // slack_user_id -> numeric id
    this.slackIdByUserId = new Map(); // numeric id -> slack_user_id
    this.nextUserId = 1;

    // scheduled_shifts: slack_user_id -> Map(`${shift_date}#${shift_block}` -> row)
    this.scheduledShifts = new Map();

    // vrijcheck_requests: slack_user_id -> Map(`${shift_date}#${shift_block}` -> row)
    this.vrijcheckRequests = new Map();

    // Load any legacy JSON data into memory immediately for synchronous startup compatibility,
    // then init() will connect to MySQL 8.0 and sync with the database.
    this._bootstrapFromLegacyJsonIfPresent();
  }

  _trackWrite(promise) {
    if (!promise) return;
    this.pendingWrites.add(promise);
    promise.finally(() => this.pendingWrites.delete(promise));
    return promise;
  }

  async waitForFlush() {
    if (this.pendingWrites.size > 0) {
      await Promise.allSettled(Array.from(this.pendingWrites));
    }
  }

  _bootstrapFromLegacyJsonIfPresent() {
    try {
      const usersFile = path.join(DATA_DIR, 'users.json');
      if (fs.existsSync(usersFile)) {
        const rawUsers = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
        for (const [key, u] of Object.entries(rawUsers)) {
          if (key === 'default' && Object.keys(rawUsers).length > 1) continue;
          const slackId = (u.slack_user_id || u.userId || key).toString().trim();
          if (!slackId) continue;
          this._upsertMemoryUser(slackId, u);
        }
      }
    } catch (_) {}
  }

  _upsertMemoryUser(slackUserId, data = {}) {
    const cleanSlackId = (slackUserId || 'default').toString().trim();
    const existing = this.usersBySlackId.get(cleanSlackId) || {};

    let numericId = existing.id || data.id || this.userIdBySlackId.get(cleanSlackId);
    if (!numericId) {
      numericId = this.nextUserId++;
    } else if (numericId >= this.nextUserId) {
      this.nextUserId = numericId + 1;
    }

    const displayName =
      data.display_name ??
      data.displayName ??
      data.realName ??
      existing.display_name ??
      existing.displayName ??
      data.username ??
      existing.username ??
      '';

    const firstName =
      data.first_name ??
      data.firstName ??
      existing.first_name ??
      existing.firstName ??
      extractFirstName(displayName, data.realName || existing.realName, 'Runner');

    const hubCode = (
      data.hub_code ||
      data.hubCode ||
      existing.hub_code ||
      existing.hubCode ||
      (data.channelName || existing.channelName || '#nl-dist-runners-hlm').replace(/^#?nl-dist-runners-/i, '') ||
      'HLM'
    )
      .toUpperCase()
      .trim();

    const channelName =
      data.channelName ||
      existing.channelName ||
      `#nl-dist-runners-${hubCode.toLowerCase()}`;

    const slackToken =
      data.slack_xoxc_token ??
      data.slackToken ??
      existing.slack_xoxc_token ??
      existing.slackToken ??
      '';

    const slackCookie =
      data.slack_xoxd_cookie ??
      data.slackCookie ??
      existing.slack_xoxd_cookie ??
      existing.slackCookie ??
      '';

    const icalUrl = data.ical_url ?? data.icalUrl ?? existing.ical_url ?? existing.icalUrl ?? '';
    const personalEmail =
      data.personal_email ?? data.personalEmail ?? existing.personal_email ?? existing.personalEmail ?? '';
    const avatarUrl =
      data.avatar_url ?? data.avatarUrl ?? existing.avatar_url ?? existing.avatarUrl ?? null;

    const emojiMapping = {
      ...DEFAULT_EMOJI_MAPPING,
      ...(existing.emojiMapping || {}),
      ...(data.emoji_mapping || data.emojiMapping || {})
    };

    const onboardingCompleted = Boolean(
      data.onboarding_completed ??
      data.onboardingCompleted ??
      existing.onboarding_completed ??
      existing.onboardingCompleted ??
      (personalEmail && icalUrl)
    );

    const nowIso = new Date().toISOString();

    const record = {
      ...DEFAULT_SETTINGS,
      ...existing,
      ...data,
      id: numericId,
      userId: cleanSlackId,
      slack_user_id: cleanSlackId,
      username: data.username || existing.username || displayName || cleanSlackId,
      first_name: firstName,
      firstName,
      display_name: displayName || firstName,
      displayName: displayName || firstName,
      realName: data.realName || existing.realName || displayName || firstName,
      personal_email: personalEmail,
      personalEmail,
      avatar_url: avatarUrl,
      avatarUrl,
      hub_code: hubCode,
      hubCode,
      channelName,
      channelId: data.channel_id ?? data.channelId ?? existing.channelId ?? (hubCode === 'HLM' ? 'CAM2MJTA9' : ''),
      ical_url: icalUrl,
      icalUrl,
      slack_xoxc_token: slackToken,
      slackToken,
      slack_xoxd_cookie: slackCookie,
      slackCookie,
      emojiMapping,
      autoReact: data.auto_react !== undefined ? Boolean(data.auto_react) : (data.autoReact ?? existing.autoReact ?? true),
      autoPicnicReact:
        data.auto_picnic_react !== undefined
          ? Boolean(data.auto_picnic_react)
          : (data.autoPicnicReact ?? existing.autoPicnicReact ?? true),
      notify1mBefore:
        data.notify_1m_before !== undefined
          ? Boolean(data.notify_1m_before)
          : (data.notify1mBefore ?? existing.notify1mBefore ?? true),
      notifyCompletion:
        data.notify_completion !== undefined
          ? Boolean(data.notify_completion)
          : (data.notifyCompletion ?? existing.notifyCompletion ?? true),
      soundEnabled:
        data.sound_enabled !== undefined
          ? Boolean(data.sound_enabled)
          : (data.soundEnabled ?? existing.soundEnabled ?? true),
      onboardingCompleted,
      onboarding_completed: onboardingCompleted,
      created_at: existing.created_at || data.created_at || nowIso,
      updated_at: nowIso,
      lastSeen: nowIso
    };

    this.usersBySlackId.set(cleanSlackId, record);
    this.userIdBySlackId.set(cleanSlackId, numericId);
    this.slackIdByUserId.set(numericId, cleanSlackId);

    if (!this.scheduledShifts.has(cleanSlackId)) {
      this.scheduledShifts.set(cleanSlackId, new Map());
    }
    if (!this.vrijcheckRequests.has(cleanSlackId)) {
      this.vrijcheckRequests.set(cleanSlackId, new Map());
    }

    return record;
  }

  /**
   * Initializes the MySQL 8.0 connection pool, creates the database & tables if needed,
   * and loads all users, scheduled_shifts, and vrijcheck_requests from MySQL.
   */
  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const host = process.env.DB_HOST || '127.0.0.1';
      const port = parseInt(process.env.DB_PORT || '3306', 10);
      const user = process.env.DB_USER || 'root';
      const password = process.env.DB_PASSWORD || 'root';
      const database = process.env.DB_NAME || 'vrijcheck';

      try {
        // 1. Ensure database exists
        const bootstrapConn = await mysql.createConnection({
          host,
          port,
          user,
          password,
          connectTimeout: 4000
        });
        await bootstrapConn.query(
          `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
        );
        await bootstrapConn.end();

        // 2. Create connection pool
        this.pool = mysql.createPool({
          host,
          port,
          user,
          password,
          database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          timezone: 'Z'
        });

        await this._createTables();
        this.isMySQLConnected = true;
        console.log(`[MYSQL] ✅ Verbonden met MySQL 8.0 database '${database}' op ${host}:${port}`);

        // 3. Pull existing rows from MySQL (or push migrated JSON if MySQL was empty)
        await this.pullFromMySQL();
      } catch (err) {
        this.isMySQLConnected = false;
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `[MYSQL] ⚠️ Kon niet verbinden met MySQL op ${host}:${port} (${err.message}). In-memory relationele modus actief; probeert automatisch te herverbinden.`
          );
        }
      }
    })();

    return this.initPromise;
  }

  async _createTables() {
    if (!this.pool) return;

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slack_user_id VARCHAR(64) NOT NULL UNIQUE,
        first_name VARCHAR(100) NOT NULL DEFAULT 'Runner',
        display_name VARCHAR(150) DEFAULT '',
        personal_email VARCHAR(255) DEFAULT '',
        avatar_url TEXT,
        hub_code VARCHAR(16) NOT NULL DEFAULT 'HLM',
        channel_id VARCHAR(64) DEFAULT '',
        ical_url TEXT,
        slack_xoxc_token TEXT,
        slack_xoxd_cookie TEXT,
        emoji_mapping JSON,
        auto_react TINYINT(1) NOT NULL DEFAULT 1,
        auto_picnic_react TINYINT(1) NOT NULL DEFAULT 1,
        notify_1m_before TINYINT(1) NOT NULL DEFAULT 1,
        notify_completion TINYINT(1) NOT NULL DEFAULT 1,
        sound_enabled TINYINT(1) NOT NULL DEFAULT 1,
        onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await this.pool.execute(
        'ALTER TABLE users ADD COLUMN auto_picnic_react TINYINT(1) NOT NULL DEFAULT 1 AFTER auto_react'
      );
    } catch (_) {}

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS scheduled_shifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        shift_date VARCHAR(10) NOT NULL,
        shift_block VARCHAR(16) NOT NULL,
        start_time VARCHAR(10) DEFAULT '',
        end_time VARCHAR(10) DEFAULT '',
        location_hub VARCHAR(16) NOT NULL DEFAULT 'HLM',
        raw_ical_uid VARCHAR(255) DEFAULT '',
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_shift (user_id, shift_date, shift_block),
        CONSTRAINT fk_scheduled_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS vrijcheck_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        shift_date VARCHAR(10) NOT NULL,
        shift_block VARCHAR(16) NOT NULL,
        hub_code VARCHAR(16) NOT NULL DEFAULT 'HLM',
        status ENUM('STANDBY', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'STANDBY',
        reaction_emoji VARCHAR(32) NOT NULL DEFAULT ':1-red:',
        error_message TEXT NULL,
        latency_ms INT NULL,
        message_ts VARCHAR(64) NULL,
        reacted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_vrijcheck_req (user_id, shift_date, shift_block),
        CONSTRAINT fk_request_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  async pullFromMySQL() {
    if (!this.pool || !this.isMySQLConnected) return;

    try {
      const [userRows] = await this.pool.execute('SELECT * FROM users ORDER BY id ASC');

      if (userRows.length === 0 && this.usersBySlackId.size > 0) {
        // Migrate in-memory / legacy users to MySQL
        for (const [slackId, u] of this.usersBySlackId.entries()) {
          await this._persistUserToMySQL(slackId, u);
        }
        return;
      }

      for (const row of userRows) {
        let emojiMapping = { ...DEFAULT_EMOJI_MAPPING };
        if (row.emoji_mapping) {
          try {
            emojiMapping =
              typeof row.emoji_mapping === 'string'
                ? { ...DEFAULT_EMOJI_MAPPING, ...JSON.parse(row.emoji_mapping) }
                : { ...DEFAULT_EMOJI_MAPPING, ...row.emoji_mapping };
          } catch (_) {}
        }

        this._upsertMemoryUser(row.slack_user_id, {
          id: row.id,
          slack_user_id: row.slack_user_id,
          first_name: row.first_name,
          display_name: row.display_name,
          personal_email: row.personal_email,
          avatar_url: row.avatar_url,
          hub_code: row.hub_code,
          channel_id: row.channel_id,
          ical_url: row.ical_url,
          slack_xoxc_token: row.slack_xoxc_token,
          slack_xoxd_cookie: row.slack_xoxd_cookie,
          emoji_mapping: emojiMapping,
          auto_react: Boolean(row.auto_react),
          auto_picnic_react: row.auto_picnic_react !== undefined ? Boolean(row.auto_picnic_react) : true,
          notify_1m_before: Boolean(row.notify_1m_before),
          notify_completion: Boolean(row.notify_completion),
          sound_enabled: Boolean(row.sound_enabled),
          onboarding_completed: Boolean(row.onboarding_completed),
          created_at: row.created_at,
          updated_at: row.updated_at
        });
      }

      // Load scheduled_shifts
      const [shiftRows] = await this.pool.execute('SELECT * FROM scheduled_shifts ORDER BY shift_date ASC');
      const nextScheduled = new Map();
      for (const slackId of this.usersBySlackId.keys()) {
        nextScheduled.set(slackId, new Map());
      }
      for (const s of shiftRows) {
        const slackId = this.slackIdByUserId.get(s.user_id);
        if (!slackId) continue;
        if (!nextScheduled.has(slackId)) nextScheduled.set(slackId, new Map());
        const key = `${s.shift_date}#${s.shift_block}`;
        nextScheduled.get(slackId).set(key, {
          id: s.id,
          user_id: s.user_id,
          shift_date: s.shift_date,
          shift_block: s.shift_block,
          start_time: s.start_time || BLOCK_DEFAULT_TIMES[s.shift_block]?.startTime || '14:00',
          end_time: s.end_time || BLOCK_DEFAULT_TIMES[s.shift_block]?.endTime || '16:45',
          location_hub: s.location_hub || 'HLM',
          raw_ical_uid: s.raw_ical_uid || '',
          synced_at: s.synced_at
        });
      }
      this.scheduledShifts = nextScheduled;

      // Load vrijcheck_requests
      const [reqRows] = await this.pool.execute('SELECT * FROM vrijcheck_requests ORDER BY shift_date ASC');
      const nextRequests = new Map();
      for (const slackId of this.usersBySlackId.keys()) {
        nextRequests.set(slackId, new Map());
      }
      for (const r of reqRows) {
        const slackId = this.slackIdByUserId.get(r.user_id);
        if (!slackId) continue;
        if (!nextRequests.has(slackId)) nextRequests.set(slackId, new Map());
        const key = `${r.shift_date}#${r.shift_block}`;
        nextRequests.get(slackId).set(key, {
          id: r.id,
          user_id: r.user_id,
          shift_date: r.shift_date,
          shift_block: r.shift_block,
          hub_code: r.hub_code || 'HLM',
          status: r.status || 'STANDBY',
          reaction_emoji: r.reaction_emoji || ':1-red:',
          error_message: r.error_message || null,
          latency_ms: r.latency_ms ?? null,
          message_ts: r.message_ts || null,
          reacted_at: r.reacted_at ? new Date(r.reacted_at).toISOString() : null,
          created_at: r.created_at,
          updated_at: r.updated_at
        });
      }
      this.vrijcheckRequests = nextRequests;
    } catch (err) {
      console.error('[MYSQL] Pull error:', err.message);
    }
  }

  async _persistUserToMySQL(slackUserId, record) {
    if (!this.pool || !this.isMySQLConnected) return;
    try {
      const [res] = await this.pool.execute(
        `INSERT INTO users (
          slack_user_id, first_name, display_name, personal_email, avatar_url,
          hub_code, channel_id, ical_url, slack_xoxc_token, slack_xoxd_cookie,
          emoji_mapping, auto_react, auto_picnic_react, notify_1m_before, notify_completion, sound_enabled, onboarding_completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          first_name = VALUES(first_name),
          display_name = VALUES(display_name),
          personal_email = VALUES(personal_email),
          avatar_url = VALUES(avatar_url),
          hub_code = VALUES(hub_code),
          channel_id = VALUES(channel_id),
          ical_url = VALUES(ical_url),
          slack_xoxc_token = VALUES(slack_xoxc_token),
          slack_xoxd_cookie = VALUES(slack_xoxd_cookie),
          emoji_mapping = VALUES(emoji_mapping),
          auto_react = VALUES(auto_react),
          auto_picnic_react = VALUES(auto_picnic_react),
          notify_1m_before = VALUES(notify_1m_before),
          notify_completion = VALUES(notify_completion),
          sound_enabled = VALUES(sound_enabled),
          onboarding_completed = VALUES(onboarding_completed)`,
        [
          slackUserId,
          record.firstName || 'Runner',
          record.displayName || '',
          record.personalEmail || '',
          record.avatarUrl || null,
          record.hubCode || 'HLM',
          record.channelId || '',
          record.icalUrl || '',
          record.slackToken || '',
          record.slackCookie || '',
          JSON.stringify(record.emojiMapping || DEFAULT_EMOJI_MAPPING),
          record.autoReact ? 1 : 0,
          record.autoPicnicReact !== false ? 1 : 0,
          record.notify1mBefore !== false ? 1 : 0,
          record.notifyCompletion !== false ? 1 : 0,
          record.soundEnabled !== false ? 1 : 0,
          record.onboardingCompleted ? 1 : 0
        ]
      );

      if (res.insertId) {
        record.id = res.insertId;
        this.userIdBySlackId.set(slackUserId, res.insertId);
        this.slackIdByUserId.set(res.insertId, slackUserId);
      } else {
        const [rows] = await this.pool.execute('SELECT id FROM users WHERE slack_user_id = ?', [slackUserId]);
        if (rows[0]?.id) {
          record.id = rows[0].id;
          this.userIdBySlackId.set(slackUserId, rows[0].id);
          this.slackIdByUserId.set(rows[0].id, slackUserId);
        }
      }
    } catch (err) {
      console.error(`[MYSQL] Fout bij opslaan van gebruiker ${slackUserId}:`, err.message);
    }
  }

  resolveUserId(userId) {
    if (userId && typeof userId === 'string' && userId.trim().length > 0 && userId.trim() !== 'default') {
      return userId.trim();
    }
    for (const k of this.usersBySlackId.keys()) {
      if (k !== 'default') return k;
    }
    return 'default';
  }

  // --- USER MANAGEMENT ---
  getUser(userId) {
    const id = this.resolveUserId(userId);
    return this.usersBySlackId.get(id) || this.usersBySlackId.get('default') || null;
  }

  getAllUsers() {
    const result = [];
    for (const [id, user] of this.usersBySlackId.entries()) {
      if (id === 'default' && this.usersBySlackId.size > 1) continue;
      result.push(user);
    }
    return result;
  }

  saveUser(userId, userData = {}) {
    const id = this.resolveUserId(userId || userData.slack_user_id || userData.userId);
    const updated = this._upsertMemoryUser(id, userData);
    this._trackWrite(this._persistUserToMySQL(id, updated));
    return updated;
  }

  deleteUser(userId) {
    const id = this.resolveUserId(userId);
    const numId = this.userIdBySlackId.get(id);
    this.usersBySlackId.delete(id);
    this.userIdBySlackId.delete(id);
    if (numId) this.slackIdByUserId.delete(numId);
    this.scheduledShifts.delete(id);
    this.vrijcheckRequests.delete(id);

    if (this.pool && this.isMySQLConnected) {
      this._trackWrite(
        this.pool.execute('DELETE FROM users WHERE slack_user_id = ?', [id]).catch(() => {})
      );
    }
    return true;
  }

  getPrimaryPollerUser() {
    for (const [id, user] of this.usersBySlackId.entries()) {
      if (id !== 'default' && user.slackToken && user.slackToken.trim().length > 0) {
        return user;
      }
    }
    const def = this.usersBySlackId.get('default');
    if (def?.slackToken) return def;
    return { ...DEFAULT_SETTINGS };
  }

  // --- SETTINGS MANAGEMENT ---
  getSettings(userId) {
    const id = this.resolveUserId(userId);
    const user = this.getUser(id);
    if (user) {
      return { ...DEFAULT_SETTINGS, ...user };
    }
    return { ...DEFAULT_SETTINGS, userId: id };
  }

  saveSettings(userIdOrSettings, maybeSettings) {
    let id;
    let newSettings;
    if (maybeSettings !== undefined) {
      id = this.resolveUserId(userIdOrSettings);
      newSettings = maybeSettings;
    } else {
      newSettings = userIdOrSettings || {};
      id = this.resolveUserId(newSettings.userId || newSettings.slack_user_id);
    }
    return this.saveUser(id, newSettings);
  }

  // --- ICAL SCHEDULED SHIFTS MANAGEMENT ---
  /**
   * Replaces future scheduled shifts from parsed iCal feed for a runner,
   * while 100% preserving all vrijcheck_requests (STANDBY, SUCCESS, FAILED)!
   */
  async syncScheduledShifts(userId, parsedShifts = []) {
    const id = this.resolveUserId(userId);
    const user = this.getUser(id) || this.saveUser(id, {});
    await this.waitForFlush();

    const shiftMap = new Map();
    for (const s of parsedShifts) {
      const key = `${s.shiftDate}#${s.shiftBlock}`;
      shiftMap.set(key, {
        user_id: user.id,
        shift_date: s.shiftDate,
        shift_block: s.shiftBlock,
        start_time: s.startTime || BLOCK_DEFAULT_TIMES[s.shiftBlock]?.startTime || '14:00',
        end_time: s.endTime || BLOCK_DEFAULT_TIMES[s.shiftBlock]?.endTime || '16:45',
        location_hub: (s.locationHub || user.hubCode || 'HLM').toUpperCase(),
        raw_ical_uid: s.rawIcalUid || '',
        synced_at: new Date().toISOString()
      });
    }
    this.scheduledShifts.set(id, shiftMap);

    if (this.pool && this.isMySQLConnected && user.id) {
      try {
        await this.pool.execute('DELETE FROM scheduled_shifts WHERE user_id = ?', [user.id]);
        for (const row of shiftMap.values()) {
          await this.pool.execute(
            `INSERT INTO scheduled_shifts
              (user_id, shift_date, shift_block, start_time, end_time, location_hub, raw_ical_uid)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              start_time = VALUES(start_time),
              end_time = VALUES(end_time),
              location_hub = VALUES(location_hub),
              raw_ical_uid = VALUES(raw_ical_uid),
              synced_at = CURRENT_TIMESTAMP`,
            [
              user.id,
              row.shift_date,
              row.shift_block,
              row.start_time,
              row.end_time,
              row.location_hub,
              row.raw_ical_uid
            ]
          );
        }
      } catch (err) {
        console.error(`[MYSQL] Fout bij synchroniseren van scheduled_shifts voor ${id}:`, err.message);
      }
    }

    return this.getShifts(id);
  }

  getScheduledShiftsList(userId) {
    const id = this.resolveUserId(userId);
    const map = this.scheduledShifts.get(id);
    if (!map) return [];
    return Array.from(map.values());
  }

  // --- VRIJCHECK REQUESTS (SINGLE SOURCE OF TRUTH) ---
  /**
   * Returns ONLY explicitly requested vrijchecks (STANDBY, SUCCESS, FAILED) for this runner.
   * Never returns unrequested shifts or fake failures!
   */
  getVrijcheckRequests(userId) {
    const id = this.resolveUserId(userId);
    const reqMap = this.vrijcheckRequests.get(id);
    if (!reqMap) return [];

    const schedMap = this.scheduledShifts.get(id) || new Map();

    return Array.from(reqMap.values())
      .map((r) => {
        const key = `${r.shift_date}#${r.shift_block}`;
        const sched = schedMap.get(key);
        const defTimes = BLOCK_DEFAULT_TIMES[r.shift_block] || { startTime: '14:00', endTime: '16:45' };
        return {
          ...r,
          shiftDate: r.shift_date,
          shiftBlock: r.shift_block,
          hubCode: r.hub_code,
          reactionEmoji: (r.reaction_emoji || ':1-red:').replace(/^:+|:+$/g, ''),
          startTime: sched?.start_time || r.start_time || defTimes.startTime,
          endTime: sched?.end_time || r.end_time || defTimes.endTime
        };
      })
      .sort((a, b) => {
        if (a.shift_date !== b.shift_date) return a.shift_date.localeCompare(b.shift_date);
        return VALID_SHIFT_BLOCKS.indexOf(a.shift_block) - VALID_SHIFT_BLOCKS.indexOf(b.shift_block);
      });
  }

  /**
   * Sets or cancels a vrijcheck request for a specific date and shift block.
   * - When active === true: creates/updates row in vrijcheck_requests with status = 'STANDBY' (unless already SUCCESS).
   * - When active === false: deletes the row from vrijcheck_requests so it is no longer requested.
   */
  setVrijcheckRequest(userId, shiftDate, shiftBlock, active, extra = {}) {
    const id = this.resolveUserId(userId);
    const user = this.getUser(id) || this.saveUser(id, {});
    if (!this.vrijcheckRequests.has(id)) {
      this.vrijcheckRequests.set(id, new Map());
    }
    const reqMap = this.vrijcheckRequests.get(id);
    const block = (shiftBlock || 'M1').toUpperCase().trim();
    const key = `${shiftDate}#${block}`;

    if (!active) {
      reqMap.delete(key);
      if (this.pool && this.isMySQLConnected && user.id) {
        this._trackWrite(
          this.pool
            .execute(
              'DELETE FROM vrijcheck_requests WHERE user_id = ? AND shift_date = ? AND shift_block = ?',
              [user.id, shiftDate, block]
            )
            .catch((err) => console.error('[MYSQL] Delete vrijcheck_request error:', err.message))
        );
      }
      return null;
    }

    const existing = reqMap.get(key);
    const emojiMap = user.emojiMapping || DEFAULT_EMOJI_MAPPING;
    const rawEmoji = extra.reactionEmoji || extra.emoji || emojiMap[block] || '1-red';
    const formattedEmoji = `:${rawEmoji.replace(/^:+|:+$/g, '')}:`;
    const status = extra.status || (existing?.status === 'SUCCESS' ? 'SUCCESS' : 'STANDBY');
    const hubCode = (extra.hubCode || user.hubCode || 'HLM').toUpperCase();
    const nowIso = new Date().toISOString();

    const record = {
      id: existing?.id || null,
      user_id: user.id,
      shift_date: shiftDate,
      shift_block: block,
      hub_code: hubCode,
      status,
      reaction_emoji: formattedEmoji,
      error_message: status === 'FAILED' ? (extra.errorMessage || null) : null,
      latency_ms: extra.latencyMs ?? existing?.latency_ms ?? null,
      message_ts: extra.messageTs ?? existing?.message_ts ?? null,
      reacted_at: status === 'STANDBY' ? null : (extra.reactedAt || existing?.reacted_at || nowIso),
      start_time: extra.startTime || existing?.start_time || BLOCK_DEFAULT_TIMES[block]?.startTime || '14:00',
      end_time: extra.endTime || existing?.end_time || BLOCK_DEFAULT_TIMES[block]?.endTime || '16:45',
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso
    };

    reqMap.set(key, record);

    if (this.pool && this.isMySQLConnected && user.id) {
      this._trackWrite(
        this.pool
          .execute(
            `INSERT INTO vrijcheck_requests
              (user_id, shift_date, shift_block, hub_code, status, reaction_emoji, error_message, latency_ms, message_ts, reacted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              hub_code = VALUES(hub_code),
              status = VALUES(status),
              reaction_emoji = VALUES(reaction_emoji),
              error_message = VALUES(error_message),
              latency_ms = VALUES(latency_ms),
              message_ts = VALUES(message_ts),
              reacted_at = VALUES(reacted_at),
              updated_at = CURRENT_TIMESTAMP`,
            [
              user.id,
              record.shift_date,
              record.shift_block,
              record.hub_code,
              record.status,
              record.reaction_emoji,
              record.error_message,
              record.latency_ms,
              record.message_ts,
              record.reacted_at ? new Date(record.reacted_at) : null
            ]
          )
          .catch((err) => console.error('[MYSQL] Upsert vrijcheck_request error:', err.message))
      );
    }

    return record;
  }

  /**
   * Updates the status of an existing vrijcheck request to SUCCESS or FAILED when the bot reacts.
   */
  updateVrijcheckStatus(userId, shiftDate, shiftBlock, { status, emoji, errorMessage = null, latencyMs = null, messageTs = null }) {
    const id = this.resolveUserId(userId);
    const block = (shiftBlock || '').toUpperCase().trim();
    return this.setVrijcheckRequest(id, shiftDate, block, true, {
      status,
      emoji,
      errorMessage,
      latencyMs,
      messageTs,
      reactedAt: new Date().toISOString()
    });
  }

  // --- UNIFIED SHIFTS MAP (COMPATIBLE WITH SCHEDULE VIEW & BOT ENGINE) ---
  /**
   * Returns a dateKey -> { [blockId]: shiftObj } map combining `scheduled_shifts` and `vrijcheck_requests`.
   */
  getShifts(userId) {
    const id = this.resolveUserId(userId);
    const schedMap = this.scheduledShifts.get(id) || new Map();
    const reqMap = this.vrijcheckRequests.get(id) || new Map();

    const result = {};

    // 1. Add all scheduled shifts from iCal
    for (const s of schedMap.values()) {
      const d = s.shift_date;
      const b = s.shift_block;
      if (!result[d]) result[d] = {};
      result[d][b] = {
        block: b,
        startTime: s.start_time || BLOCK_DEFAULT_TIMES[b]?.startTime || '14:00',
        endTime: s.end_time || BLOCK_DEFAULT_TIMES[b]?.endTime || '16:45',
        locationHub: s.location_hub || 'HLM',
        scheduled: true,
        vrijcheckActive: false,
        vrijcheckStatus: null
      };
    }

    // 2. Overlay all requested vrijchecks (STANDBY, SUCCESS, FAILED)
    for (const r of reqMap.values()) {
      const d = r.shift_date;
      const b = r.shift_block;
      if (!result[d]) result[d] = {};
      const existing = result[d][b] || {
        block: b,
        startTime: r.start_time || BLOCK_DEFAULT_TIMES[b]?.startTime || '14:00',
        endTime: r.end_time || BLOCK_DEFAULT_TIMES[b]?.endTime || '16:45',
        locationHub: r.hub_code || 'HLM',
        scheduled: true
      };

      const cleanEmoji = (r.reaction_emoji || ':1-red:').replace(/^:+|:+$/g, '');
      const isReacted = r.status === 'SUCCESS' || r.status === 'FAILED';

      result[d][b] = {
        ...existing,
        vrijcheckActive: true,
        vrijcheckStatus: r.status, // 'STANDBY' | 'SUCCESS' | 'FAILED'
        ...(isReacted
          ? {
              reactionStatus: {
                status: r.status,
                success: r.status === 'SUCCESS',
                emoji: cleanEmoji,
                latencyMs: r.latency_ms || 0,
                messageTs: r.message_ts || null,
                timestamp: r.reacted_at,
                error: r.error_message || null
              }
            }
          : {})
      };
    }

    return result;
  }

  saveShifts(userIdOrShifts, maybeShifts) {
    let id;
    let shifts;
    if (maybeShifts !== undefined) {
      id = this.resolveUserId(userIdOrShifts);
      shifts = maybeShifts;
    } else {
      id = this.resolveUserId(null);
      shifts = userIdOrShifts;
    }

    if (!shifts || typeof shifts !== 'object') return this.getShifts(id);

    const user = this.getUser(id) || this.saveUser(id, {});
    if (!this.scheduledShifts.has(id)) this.scheduledShifts.set(id, new Map());
    const schedMap = this.scheduledShifts.get(id);

    for (const [dateKey, dayData] of Object.entries(shifts)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !dayData || typeof dayData !== 'object') continue;

      for (const blockId of VALID_SHIFT_BLOCKS) {
        const blockObj = dayData[blockId];
        if (!blockObj || typeof blockObj !== 'object') continue;

        const key = `${dateKey}#${blockId}`;

        // If scheduled or explicitly passed in dayData, ensure it's in scheduledShifts
        if (blockObj.scheduled !== false) {
          schedMap.set(key, {
            user_id: user.id,
            shift_date: dateKey,
            shift_block: blockId,
            start_time: blockObj.startTime || BLOCK_DEFAULT_TIMES[blockId]?.startTime || '14:00',
            end_time: blockObj.endTime || BLOCK_DEFAULT_TIMES[blockId]?.endTime || '16:45',
            location_hub: blockObj.locationHub || user.hubCode || 'HLM',
            raw_ical_uid: blockObj.rawIcalUid || `manual-${key}`,
            synced_at: new Date().toISOString()
          });
        }

        if (blockObj.vrijcheckActive) {
          const rs = blockObj.reactionStatus;
          let status = blockObj.vrijcheckStatus || 'STANDBY';
          if (rs) {
            status = rs.success ? 'SUCCESS' : 'FAILED';
          }
          this.setVrijcheckRequest(id, dateKey, blockId, true, {
            status,
            emoji: rs?.emoji,
            latencyMs: rs?.latencyMs,
            messageTs: rs?.messageTs,
            errorMessage: rs?.error,
            startTime: blockObj.startTime,
            endTime: blockObj.endTime
          });
        } else {
          this.setVrijcheckRequest(id, dateKey, blockId, false);
        }
      }
    }

    return this.getShifts(id);
  }

  getShiftForDate(userIdOrDate, maybeDate) {
    let id;
    let dateKey;
    if (maybeDate !== undefined) {
      id = this.resolveUserId(userIdOrDate);
      dateKey = maybeDate;
    } else {
      id = this.resolveUserId(null);
      dateKey = userIdOrDate;
    }
    const userShifts = this.getShifts(id);
    return userShifts[dateKey] || null;
  }

  updateShift(userIdOrDate, dateKeyOrData, maybeData) {
    let id;
    let dateKey;
    let shiftData;
    if (maybeData !== undefined) {
      id = this.resolveUserId(userIdOrDate);
      dateKey = dateKeyOrData;
      shiftData = maybeData;
    } else {
      id = this.resolveUserId(null);
      dateKey = userIdOrDate;
      shiftData = dateKeyOrData;
    }

    const blockId = (shiftData?.block || 'M1').toUpperCase().trim();
    if (!VALID_SHIFT_BLOCKS.includes(blockId)) {
      return this.getShifts(id);
    }

    const user = this.getUser(id) || this.saveUser(id, {});
    if (!this.scheduledShifts.has(id)) this.scheduledShifts.set(id, new Map());
    const schedMap = this.scheduledShifts.get(id);
    const key = `${dateKey}#${blockId}`;

    if (!schedMap.has(key) && shiftData.scheduled !== false) {
      const schedRow = {
        user_id: user.id,
        shift_date: dateKey,
        shift_block: blockId,
        start_time: shiftData.startTime || BLOCK_DEFAULT_TIMES[blockId]?.startTime || '14:00',
        end_time: shiftData.endTime || BLOCK_DEFAULT_TIMES[blockId]?.endTime || '16:45',
        location_hub: shiftData.locationHub || user.hubCode || 'HLM',
        raw_ical_uid: `manual-${key}`,
        synced_at: new Date().toISOString()
      };
      schedMap.set(key, schedRow);
      if (this.pool && this.isMySQLConnected && user.id) {
        this._trackWrite(
          this.pool
            .execute(
              `INSERT INTO scheduled_shifts
                (user_id, shift_date, shift_block, start_time, end_time, location_hub, raw_ical_uid)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                start_time = VALUES(start_time),
                end_time = VALUES(end_time)`,
              [
                user.id,
                dateKey,
                blockId,
                schedRow.start_time,
                schedRow.end_time,
                schedRow.location_hub,
                schedRow.raw_ical_uid
              ]
            )
            .catch(() => {})
        );
      }
    }

    const active = Boolean(shiftData.vrijcheckActive);
    const rs = shiftData.reactionStatus;
    let status = shiftData.vrijcheckStatus || 'STANDBY';
    if (rs) {
      status = rs.success ? 'SUCCESS' : 'FAILED';
    }

    this.setVrijcheckRequest(id, dateKey, blockId, active, {
      status,
      emoji: rs?.emoji,
      latencyMs: rs?.latencyMs,
      messageTs: rs?.messageTs,
      errorMessage: rs?.error,
      startTime: shiftData.startTime,
      endTime: shiftData.endTime
    });

    return this.getShifts(id);
  }

  // --- HISTORY MANAGEMENT (DERIVED FROM VRIJCHECK_REQUESTS, NEVER FAKE FAILS) ---
  getHistory(userId) {
    const id = this.resolveUserId(userId);
    const requests = this.getVrijcheckRequests(id);
    return requests
      .filter((r) => r.status === 'SUCCESS' || r.status === 'FAILED')
      .map((r) => ({
        id: `${r.shift_date}-${r.shift_block}`,
        userId: id,
        messageTs: r.message_ts,
        messageDate: r.shift_date,
        matchedShift: r.shift_block,
        reactionEmoji: r.reactionEmoji,
        reactionSuccess: r.status === 'SUCCESS',
        status: r.status.toLowerCase(),
        latencyMs: r.latency_ms || 0,
        error: r.error_message || null,
        timestamp: r.reacted_at || r.updated_at
      }))
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }

  addHistoryItem(userIdOrItem, maybeItem) {
    let id;
    let item;
    if (maybeItem !== undefined) {
      id = this.resolveUserId(userIdOrItem);
      item = maybeItem;
    } else {
      id = this.resolveUserId(null);
      item = userIdOrItem;
    }

    // Bugfix #1 & #4: NEVER store history items for shifts that were not requested ('no_shift', 'vrijcheck_disabled')
    if (!item || !item.matchedShift) {
      return this.getHistory(id);
    }

    return this.getHistory(id);
  }

  clearHistory(userId) {
    const id = this.resolveUserId(userId);
    const reqMap = this.vrijcheckRequests.get(id);
    if (reqMap) {
      for (const [k, r] of reqMap.entries()) {
        if (r.status === 'SUCCESS' || r.status === 'FAILED') {
          reqMap.delete(k);
        }
      }
    }
    const user = this.getUser(id);
    if (this.pool && this.isMySQLConnected && user?.id) {
      this._trackWrite(
        this.pool
          .execute(
            "DELETE FROM vrijcheck_requests WHERE user_id = ? AND status IN ('SUCCESS', 'FAILED')",
            [user.id]
          )
          .catch(() => {})
      );
    }
    return [];
  }
}

export const db = new MySQLDatabase();
