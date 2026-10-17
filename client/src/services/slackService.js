import { Capacitor, CapacitorHttp } from '@capacitor/core';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export const DEFAULT_SETTINGS = {
  workspaceUrl: 'https://picnic.enterprise.slack.com',
  slackToken: 'xoxc-REDACTED-PICNIC-SESSION',
  slackCookie: 'xoxd-REDACTED-COOKIE',
  channelName: '#nl-dist-runners-hlm',
  channelId: 'CAM2MJTA9',
  botSenderName: 'Day-Planning-Sender',
  autoReact: true,
  pollIntervalMs: 1500,
  soundEnabled: true,
  emojiMapping: {
    M1: '1-red',
    M2: '2-red',
    S1: '1-red',
    S2: '2-red',
    S3: '3-red'
  }
};

class SlackService {
  constructor() {
    this.pollTimer = null;
    this.processedMessageIds = new Set();
    this.statusListeners = [];
    this.reactionListeners = [];
    this.logListeners = [];
    this.cachedAuth = null;
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

  async callSlackApi(endpoint, body = null, settings = null) {
    const currentSettings = settings || this.getSettings();
    const token = (currentSettings.slackToken || '').trim();
    const cookie = this.getCleanCookie(currentSettings.slackCookie);

    if (!token) {
      throw new Error('Geen Slack token geconfigureerd');
    }

    const domain = (currentSettings.workspaceUrl || 'https://picnic.enterprise.slack.com')
      .replace('enterprise.slack.com', 'slack.com')
      .replace(/\/+$/, '');
    
    // In Enterprise Grid, API calls usually go to teampicnic.slack.com/api or picnic.enterprise.slack.com/api
    const url = `https://teampicnic.slack.com/api/${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': DESKTOP_UA,
      'Accept': 'application/json'
    };
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    if (Capacitor.isNativePlatform()) {
      // Use native CapacitorHttp on Android / iOS (bypasses CORS completely)
      if (body) {
        headers['Content-Type'] = 'application/json; charset=utf-8';
        const res = await CapacitorHttp.post({
          url,
          headers,
          data: body
        });
        return res.data;
      } else {
        const res = await CapacitorHttp.get({
          url,
          headers
        });
        return res.data;
      }
    } else {
      // Running in Desktop web browser: call local backend proxy
      const res = await fetch(`http://localhost:3001/api/test-connection`);
      return res.json();
    }
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
          url: 'https://teampicnic.slack.com/api/auth.test',
          headers,
          data: {}
        });

        const authData = authRes.data;
        if (!authData?.ok) {
          return {
            ok: false,
            error: authData?.error || 'Slack auth.test mislukt'
          };
        }

        this.cachedAuth = {
          user: authData.user,
          team: authData.team || 'Picnic',
          userId: authData.user_id,
          teamId: authData.team_id
        };

        // 2. Test Channel
        const channelId = currentSettings.channelId || 'CAM2MJTA9';
        let channelOk = false;
        let messageCount = 0;
        let messages = [];

        try {
          const histRes = await CapacitorHttp.get({
            url: `https://teampicnic.slack.com/api/conversations.history?channel=${channelId}&limit=10`,
            headers
          });
          if (histRes.data?.ok) {
            channelOk = true;
            messages = histRes.data.messages || [];
            messageCount = messages.length;
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

    const cleanEmoji = emoji.replace(/^:+|:+$/g, '');

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.post({
        url: 'https://teampicnic.slack.com/api/reactions.add',
        headers,
        data: {
          channel: channelId,
          timestamp: messageTs,
          name: cleanEmoji
        }
      });
      return res.data;
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

      const res = await CapacitorHttp.get({
        url: `https://teampicnic.slack.com/api/conversations.history?channel=${channelId}&limit=15`,
        headers
      });
      return res.data?.ok ? res.data.messages : [];
    } else {
      const res = await fetch('http://localhost:3001/api/recent-messages');
      const data = await res.json();
      return data?.messages || [];
    }
  }

  getSettings() {
    try {
      const raw = localStorage.getItem('vrijcheck_settings');
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(newSettings) {
    const merged = { ...this.getSettings(), ...newSettings };
    try {
      localStorage.setItem('vrijcheck_settings', JSON.stringify(merged));
    } catch (e) {}

    // Also try syncing to local backend server if reachable
    fetch('http://localhost:3001/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged)
    }).catch(() => {});

    this.emitStatus();
    return merged;
  }

  getShifts() {
    try {
      const raw = localStorage.getItem('vrijcheck_shifts');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  saveShifts(shifts) {
    try {
      localStorage.setItem('vrijcheck_shifts', JSON.stringify(shifts));
    } catch (e) {}

    fetch('http://localhost:3001/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shifts)
    }).catch(() => {});
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

  emitStatus() {
    const st = this.getStatus();
    this.statusListeners.forEach(cb => cb(st));
  }
}

export const slackService = new SlackService();
