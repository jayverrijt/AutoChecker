import { db, DEFAULT_EMOJI_MAPPING, extractFirstName } from './db.js';
import { DayPlannerEmulator } from './emulator.js';
import { getHubInfo } from './hubs.js';

export class SlackBotManager {
  constructor(io) {
    this.io = io;
    this.pollTimer = null;
    this.lastCheckedTs = null;
    this.processedMessageIds = new Set();
    this.lastListeningNotificationMinute = null;
    this.status = 'disconnected'; // 'connected' | 'polling' | 'disconnected' | 'error' | 'simulated'
    this.lastError = null;
    this.resolvedChannelId = null;
    this.lastActivity = null;
    this.authInfo = null;
    this.recentChannelMessages = [];
    this.emulator = new DayPlannerEmulator(this);

    const allUsers = db.getAllUsers();
    allUsers.forEach((u) => {
      const history = db.getHistory(u.userId);
      history.forEach((item) => {
        if (item.messageTs) this.processedMessageIds.add(item.messageTs);
      });
    });
  }

  log(type, message, details = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    };
    console.log(`[SLACK BOT] [${type.toUpperCase()}] ${message}`, details || '');
    this.lastActivity = logEntry;
    if (this.io) {
      this.io.emit('bot:log', logEntry);
    }
  }

  getStatus(userId = null) {
    const userSettings = db.getSettings(userId);
    const poller = db.getPrimaryPollerUser();
    const allUsers = db.getAllUsers();
    const hubCode = (userSettings.hubCode || poller.hubCode || 'HLM').toUpperCase();
    const hubInfo = getHubInfo(hubCode);

    return {
      status: this.status,
      lastError: this.lastError,
      lastActivity: this.lastActivity,
      workspaceUrl: userSettings.workspaceUrl || poller.workspaceUrl || 'https://picnic.enterprise.slack.com',
      hubCode,
      hubName: hubInfo.name,
      channelName: userSettings.channelName || hubInfo.channel || '#nl-dist-runners-hlm',
      channelId: this.resolvedChannelId || userSettings.channelId || poller.channelId,
      botSenderName: userSettings.botSenderName || 'Day-Planning-Sender',
      autoReact: userSettings.autoReact !== false,
      pollIntervalMs: poller.pollIntervalMs || 1000,
      hasToken: Boolean(userSettings.slackToken && userSettings.slackToken.trim().length > 0),
      hasCookie: Boolean(userSettings.slackCookie && userSettings.slackCookie.trim().length > 0),
      authInfo: this.authInfo,
      processedCount: this.processedMessageIds.size,
      recentMessagesCount: this.recentChannelMessages.length,
      isMultiUser: true,
      mysqlConnected: db.isMySQLConnected,
      activeUsersCount: allUsers.length,
      registeredRunners: allUsers.map((u) => ({
        userId: u.userId,
        firstName: u.firstName || 'Runner',
        displayName: u.displayName || u.username || u.userId,
        hubCode: u.hubCode || 'HLM',
        hasToken: Boolean(u.slackToken && u.slackToken.trim().length > 0),
        lastSeen: u.lastSeen
      }))
    };
  }

  getApiBaseUrl(session = null) {
    const current = session || db.getPrimaryPollerUser();
    const ws = (current.workspaceUrl || 'https://picnic.enterprise.slack.com').trim().replace(/\/+$/, '');
    return `${ws}/api`;
  }

  async callSlackApi(endpoint, body = null, method = 'POST', customSession = null) {
    const session = customSession || db.getPrimaryPollerUser();
    const token = (session.slackToken || '').trim();
    if (!token) {
      throw new Error('Geen Slack token geconfigureerd voor deze gebruiker');
    }

    if (token.startsWith('xoxc-') && (!session.slackCookie || !session.slackCookie.trim())) {
      this.log(
        'warning',
        'Een xoxc- token vereist altijd de bijbehorende "d" (xoxd-...) sessiecookie op Enterprise Slack.'
      );
      return {
        ok: false,
        error: 'invalid_auth: Je hebt een xoxc- token ingevuld, maar de Session Cookie "d" (xoxd-...) ontbreekt nog.'
      };
    }

    const baseUrl = this.getApiBaseUrl(session);
    const url = `${baseUrl}/${endpoint}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Accept: '*/*'
    };

    if (session.slackCookie && session.slackCookie.trim()) {
      let cookieVal = session.slackCookie.trim();
      cookieVal = cookieVal.replace(/^d\s*[:=]\s*["']?/, '');
      cookieVal = cookieVal.replace(/["';\s]+$/, '');
      if (cookieVal.startsWith('xoxd-')) {
        cookieVal = `d=${cookieVal}`;
      }
      headers['Cookie'] = cookieVal;
    }

    const options = {
      method,
      headers
    };

    if (method === 'POST') {
      const formParams = new URLSearchParams();
      formParams.append('token', token);
      if (body) {
        for (const [k, v] of Object.entries(body)) {
          if (v !== undefined && v !== null) {
            formParams.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          }
        }
      }
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = formParams.toString();
    }

    try {
      const response = await fetch(url, options);
      return await response.json();
    } catch (err) {
      if (!baseUrl.includes('slack.com/api')) {
        try {
          const fallbackUrl = `https://slack.com/api/${endpoint}`;
          const fallbackRes = await fetch(fallbackUrl, options);
          return await fallbackRes.json();
        } catch (_) {
          throw err;
        }
      }
      throw err;
    }
  }

  extractChannelId(input) {
    if (!input) return null;
    const clean = input.trim();
    const urlMatch = clean.match(/\/archives\/([A-Z0-9]+)/i);
    if (urlMatch) {
      return urlMatch[1];
    }
    if (/^[CG][A-Z0-9]{8,12}$/i.test(clean)) {
      return clean.toUpperCase();
    }
    return null;
  }

  /**
   * Fetches Slack profile (avatar, display_name, real_name, extracted firstName)
   * and scans for #nl-dist-runners-<hubcode> channels the user is a member of.
   */
  async fetchProfileAndRunnerChannels(session) {
    let profile = {
      firstName: session.firstName || 'Runner',
      displayName: session.displayName || '',
      realName: session.realName || '',
      avatarUrl: session.avatarUrl || null
    };
    const runnerChannels = [];

    try {
      const profRes = await this.callSlackApi('users.profile.get', null, 'GET', session);
      if (profRes?.ok && profRes.profile) {
        const p = profRes.profile;
        const displayName = (p.display_name || '').trim();
        const realName = (p.real_name || '').trim();
        const firstName = extractFirstName(displayName, realName, 'Runner');
        profile = {
          firstName,
          displayName: displayName || realName || firstName,
          realName: realName || displayName || firstName,
          avatarUrl: p.image_192 || p.image_512 || p.image_72 || null
        };
      }
    } catch (err) {
      this.log('warning', `Kon Slack profiel niet ophalen: ${err.message}`);
    }

    try {
      const convRes = await this.callSlackApi(
        'users.conversations?types=public_channel,private_channel&limit=1000',
        null,
        'GET',
        session
      );
      if (convRes?.ok && Array.isArray(convRes.channels)) {
        for (const ch of convRes.channels) {
          const name = (ch.name || '').toLowerCase();
          const match = name.match(/^nl-dist-runners-([a-z0-9]+)$/i);
          if (match) {
            const hubCode = match[1].toUpperCase();
            const hubInfo = getHubInfo(hubCode);
            runnerChannels.push({
              id: ch.id,
              name: `#${name}`,
              hubCode,
              hubName: hubInfo.name
            });
          }
        }
      }
    } catch (err) {
      this.log('warning', `Kon gebruikerskanalen niet scannen: ${err.message}`);
    }

    return { profile, runnerChannels };
  }

  async testConnection(userId = null) {
    const userSettings = db.getSettings(userId);
    if (!userSettings.slackToken) {
      return { ok: false, error: 'Geen token ingevuld. Voer eerst je xoxc of xoxp token in.' };
    }

    try {
      this.log('info', `Verbinding testen voor ${userSettings.displayName || userSettings.userId || 'runner'}...`);
      const authRes = await this.callSlackApi('auth.test', {}, 'POST', userSettings);

      if (!authRes.ok) {
        return { ok: false, error: authRes.error || 'Authenticatie mislukt' };
      }

      const { profile, runnerChannels } = await this.fetchProfileAndRunnerChannels(userSettings);

      // Automatic Hub Detection (Section 3):
      // If runner has exact 1 #nl-dist-runners-<hubcode> channel, set it automatically!
      let detectedHubCode = userSettings.hubCode || 'HLM';
      let detectedChannelName = userSettings.channelName || `#nl-dist-runners-${detectedHubCode.toLowerCase()}`;
      let detectedChannelId = userSettings.channelId || '';

      if (runnerChannels.length === 1) {
        detectedHubCode = runnerChannels[0].hubCode;
        detectedChannelName = runnerChannels[0].name;
        detectedChannelId = runnerChannels[0].id;
      }

      const targetSlackId = authRes.user_id || userId || 'default';
      const savedUser = db.saveUser(targetSlackId, {
        ...userSettings,
        userId: targetSlackId,
        slack_user_id: targetSlackId,
        username: authRes.user,
        firstName: profile.firstName,
        displayName: profile.displayName || authRes.user,
        realName: profile.realName || authRes.user,
        avatarUrl: profile.avatarUrl,
        hubCode: detectedHubCode,
        channelName: detectedChannelName,
        channelId: detectedChannelId
      });

      await this.resolveChannel(savedUser);

      return {
        ok: true,
        auth: {
          user: authRes.user,
          userId: targetSlackId,
          team: authRes.team,
          teamId: authRes.team_id,
          url: authRes.url,
          profile,
          runnerChannels,
          autoSelectedHub: runnerChannels.length === 1 ? runnerChannels[0] : null
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async initialize() {
    await db.init();
    const poller = db.getPrimaryPollerUser();
    if (!poller.slackToken || !poller.slackToken.trim()) {
      this.status = 'disconnected';
      this.log('info', 'Geen actieve Slack credentials gevonden. Daemon staat gereed voor runner registratie.');
      return;
    }

    try {
      this.status = 'connecting';
      const authRes = await this.callSlackApi('auth.test', {}, 'POST', poller);

      if (!authRes.ok) {
        throw new Error(authRes.error || 'Authenticatie mislukt');
      }

      const { profile, runnerChannels } = await this.fetchProfileAndRunnerChannels(poller);

      this.authInfo = {
        user: authRes.user,
        userId: authRes.user_id,
        team: authRes.team,
        url: authRes.url,
        profile,
        runnerChannels
      };

      this.log('success', `Centrale luister-engine verbonden met Picnic Slack als: ${profile.firstName || authRes.user}!`);
      await this.resolveChannel(poller);

      this.status = 'polling';
      this.startPolling();
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message || 'Fout bij verbinden met Slack';
      this.log('error', `Initialisatie mislukt: ${this.lastError}`);
    }
  }

  async resolveChannel(settings) {
    const directFromId = this.extractChannelId(settings.channelId);
    if (directFromId) {
      this.resolvedChannelId = directFromId;
      return;
    }

    const directFromName = this.extractChannelId(settings.channelName);
    if (directFromName) {
      this.resolvedChannelId = directFromName;
      return;
    }

    if ((settings.channelName || '').toLowerCase().includes('hlm')) {
      this.resolvedChannelId = 'CAM2MJTA9';
      return;
    }

    try {
      const channelNameClean = (settings.channelName || 'nl-dist-runners-hlm').replace(/^#/, '');
      const res = await this.callSlackApi(
        'conversations.list?types=public_channel,private_channel&limit=1000',
        null,
        'GET',
        settings
      );

      if (res.ok && res.channels) {
        const found = res.channels.find((c) => c.name === channelNameClean);
        if (found) {
          this.resolvedChannelId = found.id;
          this.log('success', `Kanaal #${channelNameClean} gevonden (ID: ${found.id})`);
          return;
        }
      }
    } catch (err) {
      this.log('warning', `Fout bij opzoeken kanaal: ${err.message}`);
    }
  }

  isCriticalWindow() {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Amsterdam',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = {};
    for (const p of parts) partMap[p.type] = parseInt(p.value, 10);
    const h = (partMap.hour || 0) % 24;
    const m = partMap.minute || 0;

    this.checkListeningNotification(h, m);

    if (h === 17 && (m === 9 || m === 10 || m === 11)) {
      return { active: true, target: '17:10', period: 'OCHTEND', delayMs: 400 };
    }
    if (h === 10 && (m === 9 || m === 10 || m === 11)) {
      return { active: true, target: '10:10', period: 'MIDDAG', delayMs: 400 };
    }
    return { active: false, delayMs: 1000 };
  }

  checkListeningNotification(h, m) {
    let target = null;
    let period = null;

    if (h === 17 && m === 9) {
      target = '17:10';
      period = 'OCHTEND';
    } else if (h === 10 && m === 9) {
      target = '10:10';
      period = 'MIDDAG';
    }

    if (!target) return;

    const minuteKey = `${new Date().toISOString().split('T')[0]}_${target}`;
    if (this.lastListeningNotificationMinute === minuteKey) return;
    this.lastListeningNotificationMinute = minuteKey;

    const poller = db.getPrimaryPollerUser();
    const event = {
      type: 'listening_started',
      target,
      period,
      channel: poller.channelName || '#nl-dist-runners-hlm',
      title: 'Luisteren gestart',
      message: `Luisteren gestart: Bot staat scherp voor het vrijcheck-bericht om ${target}.`,
      timestamp: new Date().toISOString()
    };

    this.log('info', `📢 1 minuut voor ${target}: Luisteren gestart voor ${period}-shifts!`);
    if (this.io) {
      // Only send the 1-minute advance listening notification to runners who have a STANDBY vrijcheck request
      // (Never send advance listening notification for non-time-sensitive :picnic: working shift reactions)
      const allUsers = db.getAllUsers();
      for (const u of allUsers) {
        const uId = u.userId || u.slack_user_id;
        if (!uId || u.notify1mBefore === false) continue;
        const userReqs = db.getVrijcheckRequests(uId);
        const hasStandby = userReqs.some((r) => r.status === 'STANDBY');
        if (hasStandby) {
          this.io.to(`user:${uId}`).emit('bot:listening_started', event);
        }
      }
    }
  }

  startPolling() {
    this.stopPolling();
    this.isPolling = true;
    const poller = db.getPrimaryPollerUser();
    this.log(
      'info',
      `24/7 Slack luister-engine actief voor ${poller.channelName || '#nl-dist-runners-hlm'} (Multi-User Engine)`
    );

    const loop = async () => {
      if (!this.isPolling) return;
      const windowCheck = this.isCriticalWindow();
      const delay = windowCheck.active ? (windowCheck.delayMs || 400) : Math.max(800, poller.pollIntervalMs || 1000);

      await this.pollChannelMessages();

      if (this.isPolling) {
        this.pollTimer = setTimeout(loop, delay);
      }
    };

    this.pollTimer = setTimeout(loop, 200);
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollChannelMessages() {
    if (!this.resolvedChannelId || this.status !== 'polling') return;

    try {
      let queryUrl = `conversations.history?channel=${this.resolvedChannelId}&limit=8`;
      if (this.lastCheckedTs) {
        queryUrl += `&oldest=${this.lastCheckedTs}`;
      }

      const res = await this.callSlackApi(queryUrl, null, 'GET');
      if (!res.ok || !res.messages || res.messages.length === 0) return;

      const newestMessage = res.messages[0];
      if (newestMessage && (!this.lastCheckedTs || parseFloat(newestMessage.ts) > parseFloat(this.lastCheckedTs))) {
        this.lastCheckedTs = newestMessage.ts;
      }

      this.recentChannelMessages = res.messages.slice(0, 10);
      if (this.io) {
        this.io.emit('bot:recent_messages', this.recentChannelMessages);
      }

      const messagesToProcess = [...res.messages].reverse();
      for (const msg of messagesToProcess) {
        if (!this.processedMessageIds.has(msg.ts)) {
          await this.processMessage(msg, false);
        }
      }
    } catch (err) {
      console.error('Polling error:', err.message);
    }
  }

  parsePlannerMessage(text, username = '', userId = '') {
    if (!text) return null;

    const senderMatch =
      username.toLowerCase().includes('day-plan') ||
      username.toLowerCase().includes('planning') ||
      userId === 'U062ALTD6DQ' ||
      text.includes('Graag voor') ||
      text.includes('Overschotten') ||
      text.includes('Check je vrij') ||
      text.includes('*OCHTEND') ||
      text.includes('*MIDDAG') ||
      text.includes('Planning');

    let period = null;
    if (/MIDDAG/i.test(text) || /AVOND/i.test(text)) {
      period = 'MIDDAG';
    } else if (/OCHTEND/i.test(text)) {
      period = 'OCHTEND';
    }

    const dateMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
    let parsedDate = null;
    let isoDate = null;

    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3] || String(new Date().getFullYear());
      if (year.length === 2) year = '20' + year;
      parsedDate = `${day}-${month}-${year}`;
      isoDate = `${year}-${month}-${day}`;
    }

    const overschotten = {};
    const overschotShift1 = text.match(/Shift\s*1\s*:\s*(\d+)/i);
    const overschotShift2 = text.match(/Shift\s*2\s*:\s*(\d+)/i);
    const overschotShift3 = text.match(/Shift\s*3\s*:\s*(\d+)/i);
    const overschotShift4 = text.match(/Shift\s*4\s*:\s*(\d+)/i);
    if (overschotShift1) overschotten.shift1 = parseInt(overschotShift1[1], 10);
    if (overschotShift2) overschotten.shift2 = parseInt(overschotShift2[1], 10);
    if (overschotShift3) overschotten.shift3 = parseInt(overschotShift3[1], 10);
    if (overschotShift4) overschotten.shift4 = parseInt(overschotShift4[1], 10);

    return {
      isPlannerMessage: Boolean(senderMatch || (parsedDate && period)),
      parsedDate,
      isoDate,
      period,
      overschotten,
      rawText: text
    };
  }

  getEmojiForShiftBlock(user, block) {
    const mapping = {
      ...DEFAULT_EMOJI_MAPPING,
      ...(user?.emojiMapping || {})
    };
    const raw = mapping[block] || null;
    return raw ? raw.replace(/^:+|:+$/g, '') : null;
  }

  resolveTargetShiftBlocks(userId, targetDateIso, period) {
    const userShifts = db.getShifts(userId);
    const dayData = userShifts[targetDateIso];
    if (!dayData) return [];

    const candidateBlockIds =
      period === 'OCHTEND'
        ? ['M1', 'M2', 'M3', 'M4']
        : period === 'MIDDAG'
        ? ['S1', 'S2', 'S3', 'S4']
        : ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'];

    const matchedBlocks = [];

    for (const bId of candidateBlockIds) {
      const blockObj = dayData[bId];
      if (blockObj && typeof blockObj === 'object' && blockObj.vrijcheckActive === true) {
        matchedBlocks.push({ blockId: bId, details: blockObj });
      }
    }

    return matchedBlocks;
  }

  resolveWorkingShiftBlocks(userId, targetDateIso, period) {
    const userShifts = db.getShifts(userId);
    const dayData = userShifts[targetDateIso];
    if (!dayData) return [];

    const candidateBlockIds =
      period === 'OCHTEND'
        ? ['M1', 'M2', 'M3', 'M4']
        : period === 'MIDDAG'
        ? ['S1', 'S2', 'S3', 'S4']
        : ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'];

    const workingBlocks = [];
    for (const bId of candidateBlockIds) {
      const blockObj = dayData[bId];
      if (
        blockObj &&
        typeof blockObj === 'object' &&
        blockObj.isScheduled !== false &&
        !blockObj.vrijcheckActive
      ) {
        workingBlocks.push({ blockId: bId, details: blockObj });
      }
    }

    return workingBlocks;
  }

  hasAnyShiftForPeriod(userId, targetDateIso, period) {
    const userShifts = db.getShifts(userId);
    const dayData = userShifts[targetDateIso];
    if (!dayData) return false;
    const candidateBlockIds =
      period === 'OCHTEND' ? ['M1', 'M2', 'M3', 'M4'] : ['S1', 'S2', 'S3', 'S4'];

    for (const bId of candidateBlockIds) {
      if (dayData[bId]) return true;
    }
    return false;
  }

  /**
   * Process Day-Planning-Sender message and trigger sub-second reactions for all matching runners.
   * Bugfix #1 & #4: Never stores fake failures for runners who did not request a vrijcheck!
   */
  async processMessage(msg, isSimulation = false) {
    const text = msg.text || '';
    const username = msg.username || msg.user || '';
    const parsed = this.parsePlannerMessage(text, username, msg.user);

    if (!parsed || !parsed.isPlannerMessage) {
      return null;
    }

    this.log(
      'info',
      `Day-Planning-Sender bericht gedetecteerd! Datum: ${parsed.parsedDate || 'onbekend'}, Blok: ${parsed.period || 'onbekend'}`
    );
    const targetDateIso = parsed.isoDate || new Date().toISOString().split('T')[0];

    let allUsers = db.getAllUsers();
    if (allUsers.length === 0) {
      allUsers = [db.getSettings('default')];
    }

    const runnersProcessed = [];

    await Promise.allSettled(
      allUsers.map(async (user) => {
        const uId = user.userId || 'default';
        const uName = user.firstName || user.displayName || user.username || uId;

        if (user.autoReact === false) {
          return;
        }

        const activeBlocks = this.resolveTargetShiftBlocks(uId, targetDateIso, parsed.period);
        const workingBlocks = this.resolveWorkingShiftBlocks(uId, targetDateIso, parsed.period);
        const workingBlockIds = workingBlocks.map((w) => w.blockId);

        const triggerPicnicReactionIfNeeded = async () => {
          if (workingBlocks.length === 0 || user.autoPicnicReact === false) {
            return { picnicReacted: false, picnicLatencyMs: null };
          }
          const picnicStart = performance.now();
          let picnicSuccess = false;

          if (isSimulation) {
            await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 25) + 30));
            picnicSuccess = true;
            this.log(
              'success',
              `[SIMULATIE] Automatische :picnic: reactie geplaatst voor ${uName} (werkshift: ${workingBlockIds.join(', ')})!`
            );
          } else {
            try {
              const res = await this.callSlackApi(
                'reactions.add',
                {
                  channel: this.resolvedChannelId || user.channelId || 'CAM2MJTA9',
                  timestamp: msg.ts,
                  name: 'picnic'
                },
                'POST',
                user
              );
              if (res.ok || res.error === 'already_reacted') {
                picnicSuccess = true;
                this.log(
                  'success',
                  `🧺 Automatische :picnic: reactie geplaatst voor ${uName} (werkshift: ${workingBlockIds.join(', ')})!`
                );
              }
            } catch (_) {}
          }

          const picnicLatencyMs = Math.round(performance.now() - picnicStart);

          if (this.io && picnicSuccess) {
            const picnicNotification = {
              type: 'picnic_completed',
              userId: uId,
              username: uName,
              blocks: workingBlockIds,
              emoji: 'picnic',
              period: parsed.period,
              date: targetDateIso,
              reactionSuccess: true,
              latencyMs: picnicLatencyMs,
              title: 'Reactie :picnic: geplaatst!',
              message: `Automatisch met :picnic: gereageerd op je ingeroosterde shift (${workingBlockIds.join(', ')}) in Slack.`,
              timestamp: new Date().toISOString()
            };
            this.io.to(`user:${uId}`).emit('bot:picnic_completed', picnicNotification);
          }

          return { picnicReacted: picnicSuccess, picnicLatencyMs };
        };

        // Case 1: Runner did NOT request vrijcheck for any block in this period.
        // Bugfix #1 & #4: Do NOT insert any failed record into vrijcheck_requests or history!
        if (activeBlocks.length === 0) {
          const { picnicReacted } = await triggerPicnicReactionIfNeeded();
          const hasAnyShift = this.hasAnyShiftForPeriod(uId, targetDateIso, parsed.period);
          const reason = hasAnyShift
            ? `Vrijcheck staat UIT voor de shifts op ${targetDateIso} (${parsed.period}). Geen vrijcheck-reactie verzonden.`
            : `Geen actieve shift in jouw rooster voor ${parsed.period} op ${targetDateIso}.`;

          runnersProcessed.push({
            user: uName,
            userId: uId,
            matched: false,
            picnicReacted,
            picnicBlocks: workingBlockIds,
            picnicEmoji: picnicReacted ? 'picnic' : null,
            status: hasAnyShift ? 'vrijcheck_disabled' : 'no_shift',
            reason
          });
          return;
        }

        // Case 2: Runner HAS requested vrijcheck (STANDBY) for 1 or more shift blocks!
        // Execute sub-second vrijcheck reactions FIRST with highest priority!
        for (const { blockId } of activeBlocks) {
          const emojiName = this.getEmojiForShiftBlock(user, blockId);
          if (!emojiName) continue;

          this.log(
            'info',
            `🎯 SHIFT MATCH voor ${uName}! Datum: ${targetDateIso}, Blok: ${blockId} ➜ Bliksemsnel reageren met :${emojiName}:...`
          );
          const startTime = performance.now();
          let reactionSuccess = false;
          let errorDetail = null;

          if (isSimulation) {
            await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 50) + 90));
            reactionSuccess = true;
            this.log('success', `[SIMULATIE] Reactie :${emojiName}: geplaatst voor ${uName} (${blockId})!`);
          } else {
            try {
              const res = await this.callSlackApi(
                'reactions.add',
                {
                  channel: this.resolvedChannelId || user.channelId || 'CAM2MJTA9',
                  timestamp: msg.ts,
                  name: emojiName
                },
                'POST',
                user
              );

              if (res.ok || res.error === 'already_reacted') {
                reactionSuccess = true;
                this.log('success', `🚀 Echte Slack reactie :${emojiName}: geplaatst voor ${uName} (${blockId})!`);
              } else {
                reactionSuccess = false;
                errorDetail = res.error || 'Onbekende fout';
                this.log('error', `Slack reactie voor ${uName} mislukt: ${errorDetail}`);
              }
            } catch (err) {
              reactionSuccess = false;
              errorDetail = err.message;
              this.log('error', `Verbindingsfout tijdens reactie voor ${uName}: ${errorDetail}`);
            }
          }

          const latencyMs = Math.round(performance.now() - startTime);

          // Update Single Source of Truth in MySQL (STANDBY -> SUCCESS or FAILED)
          db.updateVrijcheckStatus(uId, targetDateIso, blockId, {
            status: reactionSuccess ? 'SUCCESS' : 'FAILED',
            emoji: emojiName,
            errorMessage: errorDetail,
            latencyMs,
            messageTs: msg.ts
          });

          const userShifts = db.getShifts(uId);
          const userRequests = db.getVrijcheckRequests(uId);

          const historyRecord = {
            userId: uId,
            username: uName,
            messageTs: msg.ts,
            messageDate: parsed.parsedDate || targetDateIso,
            period: parsed.period,
            matchedShift: blockId,
            reactionEmoji: emojiName,
            reactionSuccess,
            latencyMs,
            status: reactionSuccess ? 'success' : 'failed',
            error: errorDetail
          };

          if (this.io) {
            const completedNotification = {
              type: 'vrijcheck_completed',
              userId: uId,
              username: uName,
              block: blockId,
              emoji: emojiName,
              period: parsed.period,
              reactionSuccess,
              title: reactionSuccess ? 'Reactie succesvol geplaatst!' : '⚠️ Vrijcheck Mislukt',
              message: reactionSuccess
                ? 'Reactie succesvol geplaatst! Kijk nu op Slack om te zien of je vrij hebt gekregen.'
                : `Er is een technische fout opgetreden bij het plaatsen van de reactie (${errorDetail || 'onbekende fout'}).`,
              timestamp: new Date().toISOString()
            };

            this.io.to(`user:${uId}`).emit('shifts:updated', userShifts);
            this.io.to(`user:${uId}`).emit('vrijcheck_requests:updated', userRequests);
            this.io.to(`user:${uId}`).emit('bot:reaction_event', historyRecord);
            this.io.to(`user:${uId}`).emit('bot:vrijcheck_completed', completedNotification);
            this.io.emit('bot:vrijcheck_completed', completedNotification);
            this.io.to(`user:${uId}`).emit('history:updated', db.getHistory(uId));
          }

          runnersProcessed.push({
            user: uName,
            userId: uId,
            matched: true,
            blockId,
            emojiName,
            reactionSuccess,
            latencyMs,
            picnicReacted: false,
            picnicBlocks: workingBlockIds,
            picnicEmoji: null,
            status: reactionSuccess ? 'success' : 'failed'
          });
        }

        // Fire non-time-sensitive :picnic: reaction in background after vrijcheck is already placed!
        if (workingBlocks.length > 0 && user.autoPicnicReact !== false) {
          triggerPicnicReactionIfNeeded().catch(() => {});
        }
      })
    );

    this.processedMessageIds.add(msg.ts);

    if (this.io) {
      this.io.emit('bot:multi_reaction_summary', {
        messageTs: msg.ts,
        date: targetDateIso,
        period: parsed.period,
        runners: runnersProcessed
      });
    }

    const firstMatched = runnersProcessed.find((r) => r.matched);
    return {
      parsedDate: targetDateIso,
      period: parsed.period,
      runners: runnersProcessed,
      matchedShift: firstMatched?.blockId || null,
      emoji: firstMatched?.emojiName || null,
      reactionSuccess: firstMatched ? firstMatched.reactionSuccess : false,
      status: firstMatched
        ? firstMatched.status
        : runnersProcessed[0]?.reason?.includes('UIT')
        ? 'vrijcheck_disabled'
        : 'no_shift',
      reason: firstMatched ? null : runnersProcessed[0]?.reason
    };
  }

  async simulateDayPlannerMessage({ period = 'MIDDAG', date = '17-10-2026', overschotten = { shift1: 3, shift2: 4, shift3: 2 } }) {
    const fakeTs = `${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 900000 + 100000)}`;
    const text = `*${period} ${date}*\nOverschotten:\nShift 1: ${overschotten.shift1 || 2}\nShift 2: ${overschotten.shift2 || 2}\nShift 3: ${overschotten.shift3 || 1}\nCheck je vrij met :1-red: :2-red: :3-red: :4-red:`;
    return this.processMessage(
      {
        ts: fakeTs,
        username: 'Day-Planning-Sender',
        text
      },
      true
    );
  }

  async testRealReactionOnSlack({ emoji = '3-red', userId = null }) {
    const user = db.getUser(userId) || db.getPrimaryPollerUser();
    if (!user.slackToken) {
      throw new Error('Geen Slack token ingesteld voor deze gebruiker');
    }

    const channelId = this.resolvedChannelId || user.channelId || 'CAM2MJTA9';
    const historyRes = await this.callSlackApi(
      `conversations.history?channel=${channelId}&limit=5`,
      null,
      'GET',
      user
    );

    if (!historyRes.ok || !historyRes.messages || historyRes.messages.length === 0) {
      throw new Error(`Kon recente berichten niet ophalen uit kanaal: ${historyRes.error || 'Geen berichten'}`);
    }

    const targetMessage = historyRes.messages[0];
    const cleanEmoji = emoji.replace(/^:+|:+$/g, '');

    const res = await this.callSlackApi(
      'reactions.add',
      {
        channel: channelId,
        timestamp: targetMessage.ts,
        name: cleanEmoji
      },
      'POST',
      user
    );

    if (res.ok || res.error === 'already_reacted') {
      const completedNotification = {
        type: 'vrijcheck_completed',
        userId: user.userId,
        username: user.firstName || user.username,
        emoji: cleanEmoji,
        reactionSuccess: true,
        title: 'Reactie succesvol geplaatst!',
        message: 'Reactie succesvol geplaatst! Kijk nu op Slack om te zien of je vrij hebt gekregen.',
        timestamp: new Date().toISOString()
      };
      if (this.io) {
        this.io.emit('bot:vrijcheck_completed', completedNotification);
      }

      return {
        ok: true,
        emoji: cleanEmoji,
        messageTs: targetMessage.ts,
        alreadyReacted: res.error === 'already_reacted'
      };
    }

    throw new Error(res.error || 'Slack reactie mislukt');
  }

  triggerNotificationTest(type = 'listening_started', userId = null) {
    const user = db.getUser(userId) || db.getPrimaryPollerUser();
    const poller = db.getPrimaryPollerUser();
    const channel = user.channelName || poller.channelName || '#nl-dist-runners-hlm';

    if (type === 'listening_started') {
      const event = {
        type: 'listening_started',
        target: '17:10',
        period: 'OCHTEND',
        channel,
        title: 'Luisteren gestart',
        message: 'Luisteren gestart: Bot staat scherp voor het vrijcheck-bericht om 10:10 / 17:10.',
        timestamp: new Date().toISOString()
      };
      if (this.io) {
        this.io.emit('bot:listening_started', event);
      }
      return event;
    } else {
      const event = {
        type: 'vrijcheck_completed',
        userId: user.userId,
        username: user.firstName || user.username,
        emoji: '1-red',
        reactionSuccess: true,
        title: 'Reactie succesvol geplaatst!',
        message: 'Reactie succesvol geplaatst! Kijk nu op Slack om te zien of je vrij hebt gekregen.',
        timestamp: new Date().toISOString()
      };
      if (this.io) {
        this.io.emit('bot:vrijcheck_completed', event);
      }
      return event;
    }
  }
}
