import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { isCriticalListeningWindow } from '../utils/constants';

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
  pollIntervalMs: 1000,
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
    this.cachedAuth = null;
    this.recentMessages = [];
    this.isPollingActive = false;
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
      const msgs = res.data?.ok ? res.data.messages : [];
      this.recentMessages = msgs;
      return msgs;
    } else {
      const res = await fetch('http://localhost:3001/api/recent-messages');
      const data = await res.json();
      return data?.messages || [];
    }
  }

  // Real-time Standalone Background Poller with 17:10 & 10:10 Critical Window Boost
  startPolling(onReactionCallback = null) {
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

    const shifts = this.getShifts();

    for (const msg of messages) {
      if (this.processedMessageIds.has(msg.ts)) continue;

      const text = msg.text || '';
      const isPlanner = text.includes('Graag voor') || 
                        text.includes('Overschotten') || 
                        text.includes('Check je vrij') || 
                        (msg.username && msg.username.includes('Planning'));

      if (!isPlanner) continue;

      // Extract date & period
      const dateMatch = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
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

      if (targetIsoDate && shifts[targetIsoDate]) {
        const userShift = shifts[targetIsoDate];
        if (userShift.block !== 'none' && userShift.vrijcheckActive !== false && !userShift.reactionStatus?.success) {
          const mapping = settings.emojiMapping || DEFAULT_SETTINGS.emojiMapping;
          const emojiToReact = mapping[userShift.block] || '1-red';

          const startTime = Date.now();
          const reactRes = await this.addReaction(channelId, msg.ts, emojiToReact, settings);
          const latencyMs = Date.now() - startTime;

          if (reactRes?.ok || reactRes?.error === 'already_reacted') {
            this.processedMessageIds.add(msg.ts);
            userShift.reactionStatus = {
              success: true,
              emoji: emojiToReact,
              latencyMs,
              ts: Date.now()
            };
            shifts[targetIsoDate] = userShift;
            this.saveShifts(shifts);

            // Notify listeners
            this.reactionListeners.forEach(cb => cb({
              reactionSuccess: true,
              emoji: emojiToReact,
              latencyMs,
              shift: userShift,
              date: targetIsoDate
            }));
            return;
          }
        }
      }

      this.processedMessageIds.add(msg.ts);
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
