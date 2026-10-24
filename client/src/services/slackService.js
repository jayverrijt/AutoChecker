import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { isCriticalListeningWindow } from '../utils/constants';
import { getShiftForBlock, saveShiftBlock } from '../utils/shiftHelpers';
import { appStorage } from '../utils/storage';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export const DEFAULT_PROD_SERVER_URL = 'http://82.165.110.152:3001';
export const DEFAULT_PROD_SERVER_TOKEN = 'vc_prod_1464e0be3d28f34112b6a5bfe545eb04';

export const DEFAULT_SETTINGS = {
  workspaceUrl: 'https://picnic.enterprise.slack.com',
  slackToken: '',
  slackCookie: '',
  channelName: '#nl-dist-runners-hlm',
  channelId: 'CAM2MJTA9',
  hubCode: 'HLM',
  realName: 'Jay Verrijt',
  displayName: 'Jay Verrijt',
  firstName: 'Jay',
  avatarUrl: null,
  botSenderName: 'Day-Planning-Sender',
  autoReact: true,
  pollIntervalMs: 1000,
  soundEnabled: true,
  serverUrl: DEFAULT_PROD_SERVER_URL,
  serverToken: DEFAULT_PROD_SERVER_TOKEN,
  emojiMapping: {
    M1: '1-red',
    M2: '2-red',
    S1: '1-red',
    S2: '2-red',
    S3: '3-red'
  }
};

export const DEFAULT_SHIFTS = {};

class SlackService {
  constructor() {
    this.pollTimer = null;
    this.processedMessageIds = new Set();
    this.statusListeners = [];
    this.reactionListeners = [];
    this.cachedAuth = null;
    this.recentMessages = [];
    this.isPollingActive = false;
  }

  isTestingMode() {
    try {
      if (typeof window !== 'undefined') {
        if (window.__DEBUG_MODE__) return true;
        if (window.location && window.location.search && window.location.search.includes('debug=true')) return true;
        if (appStorage.getItem('vrijcheck_debug_mode') === 'true') return true;
      }
      return Boolean(import.meta.env?.DEV);
    } catch (_) {
      return false;
    }
  }

  getUserId() {
    if (this.cachedAuth?.userId) {
      return this.cachedAuth.userId;
    }
    try {
      const stored = appStorage.getItem('vrijcheck_user_id');
      if (stored && stored.trim().length > 0) return stored.trim();
      const generated = 'runner_' + Math.random().toString(36).substring(2, 9);
      appStorage.setItem('vrijcheck_user_id', generated);
      return generated;
    } catch (e) {
      return 'runner_default';
    }
  }

  setUserId(userId) {
    if (userId) {
      try {
        appStorage.setItem('vrijcheck_user_id', userId.trim());
      } catch (e) {}
    }
  }

  getCleanCookie(rawCookie) {
    if (!rawCookie) return '';
    let val = rawCookie.trim();
    val = val.replace(/^d\s*[:=]\s*["']?/, '');
    val = val.replace(/["';\s]+$/, '');
    if (val.startsWith('xoxd-')) {
      return `d=${val}`;
    }
    return val ? `d=${val}` : '';
  }

  async testConnection(settings = null) {
    const currentSettings = settings || this.getSettings();
    const token = (currentSettings.slackToken || '').trim();
    const cookie = this.getCleanCookie(currentSettings.slackCookie);

    if (!token) {
      return { ok: false, error: 'Vul een Slack token in' };
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'User-Agent': DESKTOP_UA,
          'Accept': 'application/json'
        };
        if (cookie) {
          headers['Cookie'] = cookie;
        }

        // 1. Test Auth
        const authRes = await CapacitorHttp.post({
          url: 'https://slack.com/api/auth.test',
          headers,
          data: {},
          connectTimeout: 4000,
          readTimeout: 4000
        });

        const authData = authRes.data;
        if (!authData?.ok) {
          return {
            ok: false,
            error: authData?.error || 'Slack auth.test mislukt'
          };
        }

        // 1b. Fetch User Profile from Slack (Real Name, Avatar, etc.)
        let profile = null;
        try {
          const profileRes = await CapacitorHttp.get({
            url: 'https://slack.com/api/users.profile.get',
            headers,
            connectTimeout: 4000,
            readTimeout: 4000
          });
          if (profileRes.data?.ok && profileRes.data.profile) {
            const p = profileRes.data.profile;
            profile = {
              realName: p.real_name || p.display_name || authData.user,
              displayName: p.display_name || p.real_name || authData.user,
              firstName: p.first_name || (p.real_name ? p.real_name.split(' ')[0] : 'Jay'),
              lastName: p.last_name || '',
              avatarUrl: p.image_192 || p.image_512 || p.image_72 || null,
              email: p.email || ''
            };
            this.saveSettings({
              realName: profile.realName,
              displayName: profile.displayName,
              firstName: profile.firstName,
              avatarUrl: profile.avatarUrl
            });
          }
        } catch (e) {
          console.warn('Profile fetch warning:', e);
        }

        // 1c. Discover Runner Channels (#nl-dist-runners-*)
        let runnerChannels = [];
        try {
          const countsRes = await CapacitorHttp.get({
            url: 'https://slack.com/api/client.counts',
            headers,
            connectTimeout: 4000,
            readTimeout: 4000
          });
          if (countsRes.data?.ok && Array.isArray(countsRes.data.channels)) {
            for (const ch of countsRes.data.channels) {
              if (ch.id) {
                try {
                  const infoRes = await CapacitorHttp.get({
                    url: `https://slack.com/api/conversations.info?channel=${ch.id}`,
                    headers,
                    connectTimeout: 3000,
                    readTimeout: 3000
                  });
                  if (infoRes.data?.ok && infoRes.data.channel) {
                    const cname = infoRes.data.channel.name || '';
                    if (cname.startsWith('nl-dist-runners-') || cname.includes('runners')) {
                      const code = cname.replace(/^nl-dist-runners-/, '').toUpperCase();
                      runnerChannels.push({
                        id: ch.id,
                        name: `#${cname}`,
                        hubCode: code
                      });
                    }
                  }
                } catch (_) {}
              }
            }
          }
        } catch (e) {
          console.warn('Runner channels check warning:', e);
        }

        // If no channels detected from client.counts, ensure current channel is included
        if (runnerChannels.length === 0 && currentSettings.channelName) {
          const curClean = currentSettings.channelName.replace(/^#?nl-dist-runners-/, '').toUpperCase();
          runnerChannels.push({
            id: currentSettings.channelId || 'CAM2MJTA9',
            name: currentSettings.channelName,
            hubCode: curClean || 'HLM'
          });
        }

        this.cachedAuth = {
          user: authData.user,
          team: authData.team || 'Picnic',
          userId: authData.user_id,
          teamId: authData.team_id,
          profile,
          runnerChannels
        };

        // 2. Test Channel
        const channelId = currentSettings.channelId || 'CAM2MJTA9';
        let channelOk = false;
        let messageCount = 0;
        let messages = [];

        try {
          const histRes = await CapacitorHttp.get({
            url: `https://slack.com/api/conversations.history?channel=${channelId}&limit=10`,
            headers,
            connectTimeout: 4000,
            readTimeout: 4000
          });
          if (histRes.data?.ok) {
            channelOk = true;
            messages = histRes.data.messages || [];
            messageCount = messages.length;
            this.recentMessages = messages;
          }
        } catch (e) {
          console.warn('Channel check warning:', e);
        }

        const result = {
          ok: true,
          auth: this.cachedAuth,
          channel: {
            ok: channelOk,
            name: currentSettings.channelName || '#nl-dist-runners-hlm',
            id: channelId,
            messageCount
          },
          recentMessages: messages
        };

        this.emitStatus();
        return result;
      } else {
        // Desktop browser fallback
        const res = await fetch('http://localhost:3001/api/test-connection');
        const data = await res.json();
        if (data?.ok && data?.auth) {
          this.cachedAuth = data.auth;
          this.emitStatus();
        }
        return data;
      }
    } catch (err) {
      console.error('SlackService testConnection error:', err);
      return { ok: false, error: err.message };
    }
  }

  async addReaction(channelId, messageTs, emoji, settings = null) {
    const currentSettings = settings || this.getSettings();
    const serverUrl = (currentSettings?.serverUrl || DEFAULT_PROD_SERVER_URL).trim();
    const serverToken = currentSettings?.serverToken || DEFAULT_PROD_SERVER_TOKEN;
    const cleanEmoji = emoji.replace(/^:+|:+$/g, '');

    // 1. If 24/7 VPS server is configured, try server first (fast, sub-second reaction)
    if (serverUrl && !serverUrl.includes('localhost:3001')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${serverUrl.replace(/\/+$/, '')}/api/bot/test-reaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': serverToken,
            'x-user-id': this.getUserId()
          },
          body: JSON.stringify({ emoji: cleanEmoji, userId: this.getUserId() }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data?.ok) return { ok: true, emoji: cleanEmoji };
      } catch (err) {
        console.warn('VPS server test-reaction failed, falling back to direct Slack:', err.message);
      }
    }

    // 2. Direct Slack API (using https://slack.com/api/reactions.add with timeout)
    const token = (currentSettings.slackToken || '').trim();
    const cookie = this.getCleanCookie(currentSettings.slackCookie);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': DESKTOP_UA
    };
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const res = await CapacitorHttp.post({
          url: 'https://slack.com/api/reactions.add',
          headers,
          data: {
            channel: channelId,
            timestamp: messageTs,
            name: cleanEmoji
          },
          connectTimeout: 4000,
          readTimeout: 4000
        });
        return res.data;
      } catch (e) {
        return { ok: false, error: e.message || 'Slack verbinding time-out' };
      }
    } else {
      const res = await fetch('http://localhost:3001/api/test-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelId, timestamp: messageTs, emoji: cleanEmoji })
      });
      return res.json();
    }
  }

  async fetchRecentMessages(channelId = 'CAM2MJTA9', settings = null) {
    const currentSettings = settings || this.getSettings();
    const token = (currentSettings.slackToken || '').trim();
    const cookie = this.getCleanCookie(currentSettings.slackCookie);

    if (!token) return [];

    if (Capacitor.isNativePlatform()) {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'User-Agent': DESKTOP_UA
      };
      if (cookie) {
        headers['Cookie'] = cookie;
      }

      try {
        const res = await CapacitorHttp.get({
          url: `https://slack.com/api/conversations.history?channel=${channelId}&limit=15`,
          headers,
          connectTimeout: 4000,
          readTimeout: 4000
        });
        const msgs = res.data?.ok ? res.data.messages : [];
        this.recentMessages = msgs;
        return msgs;
      } catch (e) {
        return [];
      }
    } else {
      const res = await fetch('http://localhost:3001/api/recent-messages');
      const data = await res.json();
      return data?.messages || [];
    }
  }

  async fetchServerStatus(serverUrl, serverToken) {
    const targetUrl = (serverUrl || DEFAULT_PROD_SERVER_URL).trim();
    const targetToken = serverToken || DEFAULT_PROD_SERVER_TOKEN;
    if (!targetUrl) {
      return { ok: false, error: 'Geen VPS server URL geconfigureerd in Instellingen' };
    }
    const cleanUrl = targetUrl.replace(/\/+$/, '');
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${cleanUrl}/api/status`, {
        headers: {
          'x-api-key': targetToken,
          'x-user-id': this.getUserId()
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const pingMs = Date.now() - startTime;

      if (!res.ok) {
        return { ok: false, error: `VPS server antwoordde met status ${res.status}` };
      }
      const data = await res.json();
      return {
        ok: true,
        pingMs,
        serverTime: data.serverTime,
        botStatus: data,
        channelName: data.channelName || '#nl-dist-runners-hlm',
        isPollingActive: data.isPollingActive,
        lastCheck: data.lastCheck,
        lastReaction: data.lastReaction,
        connected: data.connected !== false
      };
    } catch (err) {
      return {
        ok: false,
        error: err.name === 'AbortError' ? 'Time-out bij verbinden met VPS server (>3.5s)' : err.message
      };
    }
  }

  // Real-time Background Poller (Alleen actief in test/debugger modus!)
  startPolling(onReactionCallback = null) {
    if (!this.isTestingMode()) {
      console.log('[SLACK SERVICE] Standalone modus: lokale toestel-poller is uitgeschakeld. 24/7 VPS server handelt alle reacties af.');
      return;
    }
    this.stopPolling();
    this.isPollingActive = true;
    if (onReactionCallback) {
      this.reactionListeners.push(onReactionCallback);
    }

    const pollLoop = async () => {
      if (!this.isPollingActive) return;

      const windowCheck = isCriticalListeningWindow();
      // If in critical window (17:10 or 10:10): hyper-speed 500ms! Otherwise 1200ms
      const pollDelay = windowCheck.active ? 500 : 1200;

      try {
        await this.checkAndReact();
      } catch (err) {
        console.warn('Polling check error:', err);
      }

      if (this.isPollingActive) {
        this.pollTimer = setTimeout(pollLoop, pollDelay);
      }
    };

    pollLoop();
  }

  stopPolling() {
    this.isPollingActive = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async checkAndReact() {
    const settings = this.getSettings();
    if (!settings.autoReact || !settings.slackToken) return;

    const channelId = settings.channelId || 'CAM2MJTA9';
    const messages = await this.fetchRecentMessages(channelId, settings);
    if (!messages || messages.length === 0) return;

    let currentShifts = this.getShifts();

    for (const msg of messages) {
      if (this.processedMessageIds.has(msg.ts)) continue;

      const text = msg.text || '';
      const isPlanner = msg.user === 'U062ALTD6DQ' ||
                        text.includes('*OCHTEND') ||
                        text.includes('*MIDDAG') ||
                        text.includes('Graag voor') || 
                        text.includes('Overschotten') || 
                        text.includes('Check je vrij') || 
                        (msg.username && msg.username.includes('Planning'));

      if (!isPlanner) {
        this.processedMessageIds.add(msg.ts);
        continue;
      }

      // Extract date & period
      const dateMatch = text.match(/(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{2,4})/);
      let targetIsoDate = null;
      if (dateMatch) {
        let d = dateMatch[1].padStart(2, '0');
        let m = dateMatch[2].padStart(2, '0');
        let y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
        targetIsoDate = `${y}-${m}-${d}`;
      }

      let period = null;
      if (/OCHTEND/i.test(text)) period = 'OCHTEND';
      else if (/MIDDAG/i.test(text)) period = 'MIDDAG';

      if (!targetIsoDate && period === 'OCHTEND') {
        // Morning release at 17:10 is for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        targetIsoDate = tomorrow.toISOString().split('T')[0];
      } else if (!targetIsoDate && period === 'MIDDAG') {
        // Afternoon release at 10:10 is for today
        targetIsoDate = new Date().toISOString().split('T')[0];
      }

      if (targetIsoDate) {
        const candidateBlocks = period === 'OCHTEND' 
          ? ['M1', 'M2'] 
          : period === 'MIDDAG' 
          ? ['S1', 'S2', 'S3'] 
          : ['M1', 'M2', 'S1', 'S2', 'S3'];

        let anyReacted = false;

        for (const bId of candidateBlocks) {
          const userShift = getShiftForBlock(currentShifts, targetIsoDate, bId);
          if (userShift && userShift.vrijcheckActive === true && !userShift.reactionStatus?.success) {
            const mapping = settings.emojiMapping || DEFAULT_SETTINGS.emojiMapping;
            const emojiToReact = mapping[bId] || (bId.includes('3') ? '3-red' : bId.includes('2') ? '2-red' : '1-red');

            const startTime = Date.now();
            const reactRes = await this.addReaction(channelId, msg.ts, emojiToReact, settings);
            const latencyMs = Date.now() - startTime;

            if (reactRes?.ok || reactRes?.error === 'already_reacted') {
              anyReacted = true;
              const updatedShift = {
                ...userShift,
                reactionStatus: {
                  success: true,
                  emoji: emojiToReact,
                  latencyMs,
                  ts: Date.now()
                }
              };
              currentShifts = saveShiftBlock(currentShifts, targetIsoDate, bId, updatedShift);
              this.saveShifts(currentShifts);

              // Notify listeners
              this.reactionListeners.forEach(cb => cb({
                reactionSuccess: true,
                emoji: emojiToReact,
                latencyMs,
                shift: updatedShift,
                date: targetIsoDate,
                blockId: bId
              }));
            }
          }
        }

        if (anyReacted) {
          this.processedMessageIds.add(msg.ts);
          return;
        }
      }

      // If message is older than 1 hour, ignore it in future polls
      const msgAgeSec = (Date.now() / 1000) - parseFloat(msg.ts || 0);
      if (msgAgeSec > 3600) {
        this.processedMessageIds.add(msg.ts);
      }
    }
  }

  getSettings() {
    try {
      const raw = appStorage.getItem('vrijcheck_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Automatically default to production VPS if unset or legacy localhost
        if (!parsed.serverUrl || parsed.serverUrl.includes('localhost')) {
          parsed.serverUrl = DEFAULT_PROD_SERVER_URL;
        }
        if (!parsed.serverToken || parsed.serverToken === 'vrijcheck_secret_2026') {
          parsed.serverToken = DEFAULT_PROD_SERVER_TOKEN;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(newSettings) {
    const current = this.getSettings();
    const merged = { ...current, ...newSettings };
    merged.userId = this.getUserId();
    if (this.cachedAuth?.user) {
      merged.username = this.cachedAuth.user;
    }
    try {
      appStorage.setItem('vrijcheck_settings', JSON.stringify(merged));
    } catch (e) {}

    const serverUrl = (merged.serverUrl || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const serverToken = merged.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': serverToken,
      'x-user-id': this.getUserId()
    };

    if (Capacitor.isNativePlatform()) {
      CapacitorHttp.post({
        url: `${serverUrl}/api/settings`,
        headers,
        data: merged
      }).catch(() => {});
    } else {
      fetch(`${serverUrl}/api/settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(merged)
      }).catch(() => {});
    }

    this.emitStatus();
    return merged;
  }

  getShifts() {
    try {
      const raw = appStorage.getItem('vrijcheck_shifts');
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_SHIFTS;
  }

  saveShifts(shifts) {
    if (!shifts || typeof shifts !== 'object') return;
    try {
      appStorage.setItem('vrijcheck_shifts', JSON.stringify(shifts));
    } catch (e) {}

    const settings = this.getSettings();
    const serverUrl = (settings.serverUrl || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const serverToken = settings.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    const headers = { 
      'Content-Type': 'application/json',
      'x-api-key': serverToken,
      'x-user-id': this.getUserId()
    };

    if (Capacitor.isNativePlatform()) {
      CapacitorHttp.post({
        url: `${serverUrl}/api/shifts/bulk`,
        headers,
        data: { shifts, userId: this.getUserId() }
      }).catch((err) => console.warn('[SAVE SHIFTS] Native HTTP error:', err));
    } else {
      fetch(`${serverUrl}/api/shifts/bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ shifts, userId: this.getUserId() })
      }).catch((err) => console.warn('[SAVE SHIFTS] Web fetch error:', err));
    }
  }

  /**
   * Test connection to the 24/7 Vrijcheck Webserver using the Server Auth Token
   */
  async testServerConnection(url, token) {
    const cleanUrl = (url || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const cleanToken = (token || DEFAULT_PROD_SERVER_TOKEN).trim();

    try {
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.post({
          url: `${cleanUrl}/api/auth/verify`,
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': cleanToken,
            'x-user-id': this.getUserId()
          },
          data: { token: cleanToken, userId: this.getUserId() }
        });
        if (res?.data?.ok) {
          return { ok: true, message: 'Verbonden met 24/7 Multi-User webserver!' };
        }
        return { ok: false, error: res?.data?.error || 'Ongeldig server token of server onbereikbaar' };
      } else {
        const res = await fetch(`${cleanUrl}/api/auth/verify`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': cleanToken,
            'x-user-id': this.getUserId()
          },
          body: JSON.stringify({ token: cleanToken, userId: this.getUserId() })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          return { ok: true, message: 'Verbonden met 24/7 Multi-User webserver!' };
        }
        return { ok: false, error: data.error || 'Server authenticatie geweigerd' };
      }
    } catch (err) {
      return { ok: false, error: `Kon geen verbinding maken met ${cleanUrl}: ${err.message}` };
    }
  }

  /**
   * Trigger Day-Planning-Sender emulation on the 24/7 server to benchmark latency
   */
  async emulateOnServer(url, token, options = {}) {
    const cleanUrl = (url || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const cleanToken = (token || DEFAULT_PROD_SERVER_TOKEN).trim();

    const payload = {
      period: options.period || 'OCHTEND',
      date: options.date,
      minDelayMs: options.minDelayMs || 40,
      maxDelayMs: options.maxDelayMs || 150,
      isSimulation: true
    };

    try {
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.post({
          url: `${cleanUrl}/api/test/emulate-planner`,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': cleanToken
          },
          data: payload
        });
        return res.data;
      } else {
        const res = await fetch(`${cleanUrl}/api/test/emulate-planner`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': cleanToken
          },
          body: JSON.stringify(payload)
        });
        return await res.json();
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  getStatus() {
    const s = this.getSettings();
    return {
      status: this.cachedAuth?.user ? 'connected' : 'disconnected',
      hasToken: Boolean(s.slackToken && s.slackToken.length > 0),
      hasCookie: Boolean(s.slackCookie && s.slackCookie.length > 0),
      authInfo: this.cachedAuth,
      workspaceUrl: s.workspaceUrl,
      channelName: s.channelName,
      channelId: s.channelId
    };
  }

  onStatusChange(cb) {
    this.statusListeners.push(cb);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== cb);
    };
  }

  logout() {
    this.stopPolling();
    this.cachedAuth = null;
    this.recentMessages = [];
    const cleared = {
      ...this.getSettings(),
      slackToken: '',
      slackCookie: ''
    };
    try {
      localStorage.setItem('vrijcheck_settings', JSON.stringify(cleared));
    } catch (e) {}
    this.emitStatus();
    return cleared;
  }

  emitStatus() {
    const st = this.getStatus();
    this.statusListeners.forEach(cb => cb(st));
  }
}

export const slackService = new SlackService();
