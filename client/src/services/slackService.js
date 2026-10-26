import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { isCriticalListeningWindow, extractFirstName, APP_VERSION, isVersionOutdated } from '../utils/constants';
import { getShiftForBlock, saveShiftBlock } from '../utils/shiftHelpers';
import { appStorage } from '../utils/storage';
import { getHubByCode } from '../components/HubSelectorModal';

const SlackAuth = registerPlugin('SlackAuth');

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export const DEFAULT_PROD_SERVER_URL = 'http://82.165.110.152:3001';
export const DEFAULT_PROD_SERVER_TOKEN = 'vc_prod_1464e0be3d28f34112b6a5bfe545eb04';

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
  channelName: '#nl-dist-runners-hlm',
  channelId: 'CAM2MJTA9',
  hubCode: 'HLM',
  realName: '',
  displayName: '',
  firstName: 'Runner',
  personalEmail: '',
  icalUrl: '',
  onboardingCompleted: false,
  avatarUrl: null,
  botSenderName: 'Day-Planning-Sender',
  autoReact: true,
  notify1mBefore: true,
  notifyCompletion: true,
  pollIntervalMs: 1000,
  soundEnabled: true,
  serverMode: 'DEFAULT', // 'DEFAULT' | 'OTHER'
  customServerHost: '',
  customServerPort: '3001',
  serverUrl: DEFAULT_PROD_SERVER_URL,
  serverToken: DEFAULT_PROD_SERVER_TOKEN,
  emojiMapping: { ...DEFAULT_EMOJI_MAPPING }
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
        if (window.location?.search?.includes('debug=true')) return true;
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
    } catch (_) {
      return 'runner_default';
    }
  }

  setUserId(userId) {
    if (userId) {
      try {
        appStorage.setItem('vrijcheck_user_id', userId.trim());
      } catch (_) {}
    }
  }

  getActiveServerUrl(settings = null) {
    const s = settings || this.getSettings();
    if (s.serverMode === 'OTHER' && s.customServerHost && s.customServerHost.trim().length > 0) {
      let host = s.customServerHost.trim().replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(host)) {
        host = `http://${host}`;
      }
      const port = (s.customServerPort || '').toString().trim();
      if (port && !host.match(/:\d+$/)) {
        return `${host}:${port}`;
      }
      return host;
    }
    return (s.serverUrl || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
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

  async _httpJson(url, { method = 'GET', headers = {}, body = null, timeout = 5000 } = {}) {
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.request({
        url,
        method,
        headers,
        data: body || undefined,
        connectTimeout: timeout,
        readTimeout: timeout
      });
      return res.data;
    } else {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });
        return await res.json();
      } finally {
        clearTimeout(t);
      }
    }
  }

  /**
   * Global Version Check (Section 4):
   * Checks if the local frontend APP_VERSION is behind the latest frontend release.
   * For OTHER (Custom Backend), only checks frontend app version, never backend version differences.
   */
  async checkFrontendUpdateRequired(settings = null) {
    const s = settings || this.getSettings();
    const checkUrl = `${DEFAULT_PROD_SERVER_URL}/api/version`;
    try {
      const data = await this._httpJson(checkUrl, { method: 'GET', timeout: 3500 });
      if (data?.ok && data.minFrontendVersion) {
        const outdated = isVersionOutdated(APP_VERSION, data.minFrontendVersion);
        return {
          updateRequired: outdated,
          currentVersion: APP_VERSION,
          latestFrontendVersion: data.latestFrontendVersion || data.minFrontendVersion,
          serverMode: s.serverMode || 'DEFAULT'
        };
      }
    } catch (_) {}
    return {
      updateRequired: false,
      currentVersion: APP_VERSION,
      latestFrontendVersion: APP_VERSION,
      serverMode: s.serverMode || 'DEFAULT'
    };
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
          Authorization: `Bearer ${token}`,
          'User-Agent': DESKTOP_UA,
          Accept: 'application/json'
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

        if (authData.user_id) {
          this.setUserId(authData.user_id);
        }

        // 1b. Fetch User Profile from Slack & extract firstName (Bugfix #2)
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
            const displayName = (p.display_name || '').trim();
            const realName = (p.real_name || '').trim();
            const firstName = extractFirstName(displayName, realName, 'Runner');
            profile = {
              realName: realName || displayName || authData.user || 'Runner',
              displayName: displayName || realName || authData.user || 'Runner',
              firstName,
              lastName: p.last_name || '',
              avatarUrl: p.image_192 || p.image_512 || p.image_72 || null
            };
          }
        } catch (e) {
          console.warn('Profile fetch warning:', e);
        }

        // 1c. Discover Runner Channels (#nl-dist-runners-<hubcode>)
        const runnerChannels = [];
        const seenCodes = new Set();
        try {
          const convRes = await CapacitorHttp.get({
            url: 'https://slack.com/api/users.conversations?types=public_channel,private_channel&limit=1000',
            headers,
            connectTimeout: 4500,
            readTimeout: 4500
          });
          if (convRes.data?.ok && Array.isArray(convRes.data.channels)) {
            for (const ch of convRes.data.channels) {
              const cname = (ch.name || '').toLowerCase();
              const m = cname.match(/^nl-dist-runners-([a-z0-9]+)$/i);
              if (m) {
                const code = m[1].toUpperCase();
                if (!seenCodes.has(code)) {
                  seenCodes.add(code);
                  const hubObj = getHubByCode(code);
                  runnerChannels.push({
                    id: ch.id,
                    name: `#${cname}`,
                    hubCode: code,
                    hubName: hubObj.name
                  });
                }
              }
            }
          }
        } catch (_) {}

        if (runnerChannels.length === 0) {
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
                      const cname = (infoRes.data.channel.name || '').toLowerCase();
                      const m = cname.match(/^nl-dist-runners-([a-z0-9]+)$/i);
                      if (m) {
                        const code = m[1].toUpperCase();
                        if (!seenCodes.has(code)) {
                          seenCodes.add(code);
                          const hubObj = getHubByCode(code);
                          runnerChannels.push({
                            id: ch.id,
                            name: `#${cname}`,
                            hubCode: code,
                            hubName: hubObj.name
                          });
                        }
                      }
                    }
                  } catch (_) {}
                }
              }
            }
          } catch (_) {}
        }

        // Automatic Hub Detection: if exact 1 runner channel found, set automatically!
        let nextHubCode = currentSettings.hubCode || 'HLM';
        let nextChannelName = currentSettings.channelName || '#nl-dist-runners-hlm';
        let nextChannelId = currentSettings.channelId || 'CAM2MJTA9';

        if (runnerChannels.length === 1) {
          nextHubCode = runnerChannels[0].hubCode;
          nextChannelName = runnerChannels[0].name;
          nextChannelId = runnerChannels[0].id;
        }

        this.saveSettings({
          ...(profile
            ? {
                realName: profile.realName,
                displayName: profile.displayName,
                firstName: profile.firstName,
                avatarUrl: profile.avatarUrl
              }
            : {}),
          hubCode: nextHubCode,
          channelName: nextChannelName,
          channelId: nextChannelId
        });

        this.cachedAuth = {
          user: authData.user,
          team: authData.team || 'Picnic',
          userId: authData.user_id,
          teamId: authData.team_id,
          profile,
          runnerChannels,
          autoSelectedHub: runnerChannels.length === 1 ? runnerChannels[0] : null
        };

        // 2. Test Channel
        let channelOk = false;
        let messageCount = 0;
        let messages = [];

        try {
          const histRes = await CapacitorHttp.get({
            url: `https://slack.com/api/conversations.history?channel=${nextChannelId}&limit=10`,
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
        } catch (_) {}

        const result = {
          ok: true,
          auth: this.cachedAuth,
          channel: {
            ok: channelOk,
            name: nextChannelName,
            id: nextChannelId,
            messageCount
          },
          recentMessages: messages
        };

        this.emitStatus();
        return result;
      } else {
        // Desktop browser / backend testConnection
        const serverUrl = this.getActiveServerUrl(currentSettings);
        const serverToken = currentSettings.serverToken || DEFAULT_PROD_SERVER_TOKEN;

        // Save token to server first so /api/bot/test-connection can verify it
        await this._httpJson(`${serverUrl}/api/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': serverToken,
            'x-user-id': this.getUserId()
          },
          body: currentSettings
        }).catch(() => {});

        const data = await this._httpJson(`${serverUrl}/api/bot/test-connection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': serverToken,
            'x-user-id': this.getUserId()
          },
          body: {}
        });

        if (data?.ok && data?.auth) {
          if (data.auth.userId) {
            this.setUserId(data.auth.userId);
          }
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

  async completeOnboarding(payload = {}) {
    const currentSettings = this.getSettings();
    const serverUrl = this.getActiveServerUrl(currentSettings);
    const serverToken = currentSettings.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    const mergedLocal = this.saveSettings({
      ...payload,
      onboardingCompleted: true
    });

    try {
      const data = await this._httpJson(`${serverUrl}/api/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': this.getUserId()
        },
        body: {
          ...mergedLocal,
          ...payload,
          userId: this.getUserId()
        },
        timeout: 12000
      });

      if (data?.ok) {
        if (data.user) {
          appStorage.setItem('vrijcheck_settings', JSON.stringify({ ...mergedLocal, ...data.user }));
        }
        if (data.shifts) {
          appStorage.setItem('vrijcheck_shifts', JSON.stringify(data.shifts));
        }
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async syncIcalOnServer(icalUrl = null, rawIcal = null) {
    const currentSettings = this.getSettings();
    const serverUrl = this.getActiveServerUrl(currentSettings);
    const serverToken = currentSettings.serverToken || DEFAULT_PROD_SERVER_TOKEN;
    const targetUrl = (icalUrl ?? currentSettings.icalUrl ?? '').trim();

    if (targetUrl) {
      this.saveSettings({ icalUrl: targetUrl });
    }

    try {
      const data = await this._httpJson(`${serverUrl}/api/ical/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': this.getUserId()
        },
        body: {
          icalUrl: targetUrl,
          rawIcal,
          hubCode: currentSettings.hubCode || 'HLM'
        },
        timeout: 12000
      });

      if (data?.ok && data.shifts) {
        appStorage.setItem('vrijcheck_shifts', JSON.stringify(data.shifts));
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchVrijcheckRequests() {
    const currentSettings = this.getSettings();
    const serverUrl = this.getActiveServerUrl(currentSettings);
    const serverToken = currentSettings.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    try {
      const data = await this._httpJson(`${serverUrl}/api/vrijcheck-requests`, {
        method: 'GET',
        headers: {
          'x-api-key': serverToken,
          'x-user-id': this.getUserId()
        },
        timeout: 5000
      });
      if (data?.ok && Array.isArray(data.requests)) {
        appStorage.setItem('vrijcheck_requests', JSON.stringify(data.requests));
        return data.requests;
      }
    } catch (_) {}

    try {
      const cached = appStorage.getItem('vrijcheck_requests');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return [];
  }

  async setVrijcheckRequestOnServer({ shiftDate, shiftBlock, active, startTime, endTime, hubCode }) {
    const currentSettings = this.getSettings();
    const serverUrl = this.getActiveServerUrl(currentSettings);
    const serverToken = currentSettings.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    try {
      const data = await this._httpJson(`${serverUrl}/api/vrijcheck-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': this.getUserId()
        },
        body: {
          shiftDate,
          shiftBlock,
          active,
          startTime,
          endTime,
          hubCode: hubCode || currentSettings.hubCode || 'HLM'
        },
        timeout: 5000
      });
      if (data?.ok) {
        if (data.shifts) appStorage.setItem('vrijcheck_shifts', JSON.stringify(data.shifts));
        if (data.requests) appStorage.setItem('vrijcheck_requests', JSON.stringify(data.requests));
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async addReaction(channelId, messageTs, emoji, settings = null) {
    const currentSettings = settings || this.getSettings();
    const serverUrl = this.getActiveServerUrl(currentSettings);
    const serverToken = currentSettings?.serverToken || DEFAULT_PROD_SERVER_TOKEN;
    const cleanEmoji = emoji.replace(/^:+|:+$/g, '');

    if (serverUrl) {
      try {
        const data = await this._httpJson(`${serverUrl}/api/bot/test-reaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': serverToken,
            'x-user-id': this.getUserId()
          },
          body: { emoji: cleanEmoji, userId: this.getUserId() },
          timeout: 4000
        });
        if (data?.ok) return { ok: true, emoji: cleanEmoji };
      } catch (err) {
        console.warn('VPS server test-reaction fallback:', err.message);
      }
    }

    const token = (currentSettings.slackToken || '').trim();
    const cookie = this.getCleanCookie(currentSettings.slackCookie);

    const headers = {
      Authorization: `Bearer ${token}`,
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
      return { ok: false, error: 'Kon reactie niet plaatsen via server.' };
    }
  }

  async fetchRecentMessages(channelId = 'CAM2MJTA9', settings = null) {
    const currentSettings = settings || this.getSettings();
    const token = (currentSettings.slackToken || '').trim();
    const cookie = this.getCleanCookie(currentSettings.slackCookie);

    if (!token) return [];

    if (Capacitor.isNativePlatform()) {
      const headers = {
        Authorization: `Bearer ${token}`,
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
      } catch (_) {
        return [];
      }
    }
    return [];
  }

  async fetchServerStatus(serverUrl, serverToken) {
    const targetUrl = (serverUrl || this.getActiveServerUrl()).trim();
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

  startPolling(onReactionCallback = null) {
    if (!this.isTestingMode()) {
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
      const pollDelay = windowCheck.active ? 500 : 1200;

      try {
        await this.checkAndReact();
      } catch (_) {}

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
      const isPlanner =
        msg.user === 'U062ALTD6DQ' ||
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

      const dateMatch = text.match(/(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{2,4})/);
      let targetIsoDate = null;
      if (dateMatch) {
        const d = dateMatch[1].padStart(2, '0');
        const m = dateMatch[2].padStart(2, '0');
        const y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
        targetIsoDate = `${y}-${m}-${d}`;
      }

      let period = null;
      if (/OCHTEND/i.test(text)) period = 'OCHTEND';
      else if (/MIDDAG/i.test(text) || /AVOND/i.test(text)) period = 'MIDDAG';

      if (!targetIsoDate && period === 'OCHTEND') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        targetIsoDate = tomorrow.toISOString().split('T')[0];
      } else if (!targetIsoDate && period === 'MIDDAG') {
        targetIsoDate = new Date().toISOString().split('T')[0];
      }

      if (targetIsoDate) {
        const candidateBlocks =
          period === 'OCHTEND'
            ? ['M1', 'M2', 'M3', 'M4']
            : period === 'MIDDAG'
            ? ['S1', 'S2', 'S3', 'S4']
            : ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'];

        let anyReacted = false;

        for (const bId of candidateBlocks) {
          const userShift = getShiftForBlock(currentShifts, targetIsoDate, bId);
          if (userShift && userShift.vrijcheckActive === true && !userShift.reactionStatus?.success) {
            const mapping = settings.emojiMapping || DEFAULT_SETTINGS.emojiMapping;
            const emojiToReact = mapping[bId] || '1-red';

            const startTime = Date.now();
            const reactRes = await this.addReaction(channelId, msg.ts, emojiToReact, settings);
            const latencyMs = Date.now() - startTime;

            if (reactRes?.ok || reactRes?.error === 'already_reacted') {
              anyReacted = true;
              const updatedShift = {
                ...userShift,
                vrijcheckStatus: 'SUCCESS',
                reactionStatus: {
                  status: 'SUCCESS',
                  success: true,
                  emoji: emojiToReact,
                  latencyMs,
                  ts: Date.now()
                }
              };
              currentShifts = saveShiftBlock(currentShifts, targetIsoDate, bId, updatedShift);
              this.saveShifts(currentShifts);

              this.reactionListeners.forEach((cb) =>
                cb({
                  reactionSuccess: true,
                  emoji: emojiToReact,
                  latencyMs,
                  shift: updatedShift,
                  date: targetIsoDate,
                  blockId: bId
                })
              );
            }
          }
        }

        if (anyReacted) {
          this.processedMessageIds.add(msg.ts);
          return;
        }
      }

      const msgAgeSec = Date.now() / 1000 - parseFloat(msg.ts || 0);
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
        if (!parsed.serverUrl || parsed.serverUrl.includes('localhost')) {
          parsed.serverUrl = DEFAULT_PROD_SERVER_URL;
        }
        if (!parsed.serverToken || parsed.serverToken === 'vrijcheck_secret_2026') {
          parsed.serverToken = DEFAULT_PROD_SERVER_TOKEN;
        }
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          emojiMapping: {
            ...DEFAULT_EMOJI_MAPPING,
            ...(parsed.emojiMapping || {})
          }
        };
      }
    } catch (_) {}
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(newSettings) {
    const current = this.getSettings();
    const merged = {
      ...current,
      ...newSettings,
      emojiMapping: {
        ...DEFAULT_EMOJI_MAPPING,
        ...(current.emojiMapping || {}),
        ...(newSettings?.emojiMapping || {})
      }
    };

    if (merged.serverMode === 'OTHER' && merged.customServerHost) {
      merged.serverUrl = this.getActiveServerUrl(merged);
    } else if (merged.serverMode === 'DEFAULT') {
      merged.serverUrl = DEFAULT_PROD_SERVER_URL;
    }

    merged.userId = this.getUserId();
    if (this.cachedAuth?.user) {
      merged.username = this.cachedAuth.user;
    }
    try {
      appStorage.setItem('vrijcheck_settings', JSON.stringify(merged));
    } catch (_) {}

    const serverUrl = this.getActiveServerUrl(merged);
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
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (_) {}
    return DEFAULT_SHIFTS;
  }

  saveShiftsLocalOnly(shifts) {
    if (!shifts || typeof shifts !== 'object') return;
    try {
      appStorage.setItem('vrijcheck_shifts', JSON.stringify(shifts));
    } catch (_) {}
  }

  saveShifts(shifts) {
    if (!shifts || typeof shifts !== 'object') return;
    this.saveShiftsLocalOnly(shifts);

    const settings = this.getSettings();
    const serverUrl = this.getActiveServerUrl(settings);
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
      }).catch(() => {});
    } else {
      fetch(`${serverUrl}/api/shifts/bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ shifts, userId: this.getUserId() })
      }).catch(() => {});
    }
  }

  async testServerConnection(url, token) {
    const cleanUrl = (url || this.getActiveServerUrl()).replace(/\/+$/, '');
    const cleanToken = (token || DEFAULT_PROD_SERVER_TOKEN).trim();

    try {
      const data = await this._httpJson(`${cleanUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanToken,
          'x-user-id': this.getUserId()
        },
        body: { token: cleanToken, userId: this.getUserId() },
        timeout: 4500
      });
      if (data?.ok) {
        return { ok: true, message: 'Verbonden met 24/7 Multi-User webserver!' };
      }
      return { ok: false, error: data?.error || 'Ongeldig server token of server onbereikbaar' };
    } catch (err) {
      return { ok: false, error: `Kon geen verbinding maken met ${cleanUrl}: ${err.message}` };
    }
  }

  async emulateOnServer(url, token, options = {}) {
    const cleanUrl = (url || this.getActiveServerUrl()).replace(/\/+$/, '');
    const cleanToken = (token || DEFAULT_PROD_SERVER_TOKEN).trim();

    const payload = {
      period: options.period || 'OCHTEND',
      date: options.date,
      minDelayMs: options.minDelayMs || 40,
      maxDelayMs: options.maxDelayMs || 150,
      isSimulation: true
    };

    try {
      return await this._httpJson(`${cleanUrl}/api/test/emulate-planner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanToken,
          'x-user-id': this.getUserId()
        },
        body: payload
      });
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
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  /**
   * Hard Session Wipe on Logout (Section 5):
   * Wipes all native WebView cookies (Slack + Picnic Keycloak SSO), WebStorage, cache,
   * and clears local credentials so the user must re-enter Keycloak email & password on next login.
   */
  async logout() {
    this.stopPolling();
    this.cachedAuth = null;
    this.recentMessages = [];

    if (Capacitor.isNativePlatform()) {
      try {
        await SlackAuth.logout();
      } catch (err) {
        console.warn('Native SlackAuth.logout warning:', err);
      }
    }

    const cleared = {
      ...DEFAULT_SETTINGS,
      slackToken: '',
      slackCookie: '',
      onboardingCompleted: false
    };
    try {
      appStorage.setItem('vrijcheck_settings', JSON.stringify(cleared));
      appStorage.removeItem('vrijcheck_shifts');
      appStorage.removeItem('vrijcheck_requests');
      appStorage.removeItem('vrijcheck_user_id');
    } catch (_) {}
    this.emitStatus();
    return cleared;
  }

  emitStatus() {
    const st = this.getStatus();
    this.statusListeners.forEach((cb) => cb(st));
  }
}

export const slackService = new SlackService();
