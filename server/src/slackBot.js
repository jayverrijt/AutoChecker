import { db } from './db.js';
import { DayPlannerEmulator } from './emulator.js';

export class SlackBotManager {
  constructor(io) {
    this.io = io;
    this.pollTimer = null;
    this.lastCheckedTs = null;
    this.processedMessageIds = new Set();
    this.status = 'disconnected'; // 'connected' | 'polling' | 'disconnected' | 'error' | 'simulated'
    this.lastError = null;
    this.resolvedChannelId = null;
    this.lastActivity = null;
    this.authInfo = null;
    this.recentChannelMessages = [];
    this.emulator = new DayPlannerEmulator(this);

    // Load history of processed messages across all users so we don't double react on server reboot
    const allUsers = db.getAllUsers();
    allUsers.forEach(u => {
      const history = db.getHistory(u.userId);
      history.forEach(item => {
        if (item.messageTs) this.processedMessageIds.add(item.messageTs);
      });
    });
  }

  log(type, message, details = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type, // 'info' | 'success' | 'warning' | 'error'
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
    return {
      status: this.status,
      lastError: this.lastError,
      lastActivity: this.lastActivity,
      workspaceUrl: userSettings.workspaceUrl || poller.workspaceUrl || 'https://picnic.enterprise.slack.com',
      channelName: userSettings.channelName || poller.channelName || '#nl-dist-runners-hlm',
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
      activeUsersCount: allUsers.length,
      registeredRunners: allUsers.map(u => ({
        userId: u.userId,
        username: u.username || u.userId,
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

  /**
   * Universal Slack API caller with Enterprise Grid session support (xoxc + d cookie)
   * Supports passing a specific user session for multi-user reaction dispatch
   */
  async callSlackApi(endpoint, body = null, method = 'POST', customSession = null) {
    const session = customSession || db.getPrimaryPollerUser();
    const token = (session.slackToken || '').trim();
    if (!token) {
      throw new Error('Geen Slack token geconfigureerd voor deze gebruiker');
    }

    // Check if user has xoxc token without d cookie
    if (token.startsWith('xoxc-') && (!session.slackCookie || !session.slackCookie.trim())) {
      this.log('warning', 'Een xoxc- token vereist altijd de bijbehorende "d" (xoxd-...) sessiecookie op Enterprise Slack.');
      return {
        ok: false,
        error: 'invalid_auth: Je hebt een xoxc- token ingevuld, maar de Session Cookie "d" (xoxd-...) ontbreekt nog.'
      };
    }

    const baseUrl = this.getApiBaseUrl(session);
    const url = `${baseUrl}/${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };

    // Attach d cookie for Enterprise Grid xoxc session if present
    if (session.slackCookie && session.slackCookie.trim()) {
      let cookieVal = session.slackCookie.trim();
      cookieVal = cookieVal.replace(/^d\s*[:=]\s*["']?/, '');
      cookieVal = cookieVal.replace(/["';\s]+$/, '');
      if (cookieVal.startsWith('xoxd-')) {
        cookieVal = `d=${cookieVal}`;
      }
      headers['Cookie'] = cookieVal;
    }

    let options = {
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
      const data = await response.json();
      return data;
    } catch (err) {
      if (!baseUrl.includes('slack.com/api')) {
        try {
          const fallbackUrl = `https://slack.com/api/${endpoint}`;
          const fallbackRes = await fetch(fallbackUrl, options);
          return await fallbackRes.json();
        } catch (fbErr) {
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

  async testConnection(userId = null) {
    const userSettings = db.getSettings(userId);
    if (!userSettings.slackToken) {
      return { ok: false, error: 'Geen token ingevuld. Voer eerst je xoxc of xoxp token in.' };
    }

    try {
      this.log('info', `Verbinding testen voor ${userSettings.username || userSettings.userId || 'runner'}...`);
      const authRes = await this.callSlackApi('auth.test', {}, 'POST', userSettings);
      
      if (!authRes.ok) {
        return { ok: false, error: authRes.error || 'Authenticatie mislukt' };
      }

      // Update user record with verified Slack details
      if (authRes.user_id) {
        db.saveUser(authRes.user_id, {
          userId: authRes.user_id,
          username: authRes.user,
          ...userSettings
        });
      }

      await this.resolveChannel(userSettings);

      return {
        ok: true,
        auth: {
          user: authRes.user,
          userId: authRes.user_id,
          team: authRes.team,
          teamId: authRes.team_id,
          url: authRes.url
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async initialize() {
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

      this.authInfo = {
        user: authRes.user,
        userId: authRes.user_id,
        team: authRes.team,
        url: authRes.url
      };

      this.log('success', `Centrale luister-engine verbonden met Picnic Slack als: ${authRes.user}!`);
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
        const found = res.channels.find(c => c.name === channelNameClean);
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
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();

    // 17:10 window (17:09:40 - 17:12:00) for morning shifts
    if (h === 17 && (m === 10 || m === 11 || (m === 9 && s >= 40))) {
      return { active: true, target: '17:10', period: 'OCHTEND', delayMs: 400 };
    }
    // 10:10 window (10:09:40 - 10:12:00) for afternoon shifts
    if (h === 10 && (m === 10 || m === 11 || (m === 9 && s >= 40))) {
      return { active: true, target: '10:10', period: 'MIDDAG', delayMs: 400 };
    }
    return { active: false, delayMs: 1000 };
  }

  startPolling() {
    this.stopPolling();
    this.isPolling = true;
    const poller = db.getPrimaryPollerUser();
    this.log('info', `24/7 Slack luister-engine actief voor #${poller.channelName || 'nl-dist-runners-hlm'} (Multi-User Engine)`);

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

    const senderMatch = username.toLowerCase().includes('day-plan') || 
                        username.toLowerCase().includes('planning') ||
                        userId === 'U062ALTD6DQ' ||
                        text.includes('Graag voor') ||
                        text.includes('Overschotten') ||
                        text.includes('Check je vrij') ||
                        text.includes('*OCHTEND') ||
                        text.includes('*MIDDAG') ||
                        text.includes('HLM Planning');

    let period = null;
    if (/MIDDAG/i.test(text)) {
      period = 'MIDDAG';
    } else if (/OCHTEND/i.test(text)) {
      period = 'OCHTEND';
    } else if (/AVOND/i.test(text)) {
      period = 'AVOND';
    }

    const dateMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
    let parsedDate = null;
    let isoDate = null;

    if (dateMatch) {
      let day = dateMatch[1].padStart(2, '0');
      let month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3] || String(new Date().getFullYear());
      if (year.length === 2) year = '20' + year;
      parsedDate = `${day}-${month}-${year}`;
      isoDate = `${year}-${month}-${day}`;
    }

    const overschotten = {};
    const overschotShift1 = text.match(/Shift\s*1\s*:\s*(\d+)/i);
    const overschotShift2 = text.match(/Shift\s*2\s*:\s*(\d+)/i);
    const overschotShift3 = text.match(/Shift\s*3\s*:\s*(\d+)/i);
    if (overschotShift1) overschotten.shift1 = parseInt(overschotShift1[1], 10);
    if (overschotShift2) overschotten.shift2 = parseInt(overschotShift2[1], 10);
    if (overschotShift3) overschotten.shift3 = parseInt(overschotShift3[1], 10);

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
    const mapping = user?.emojiMapping || {
      M1: '1-red',
      M2: '2-red',
      S1: '1-red',
      S2: '2-red',
      S3: '3-red'
    };
    return mapping[block] || null;
  }

  resolveTargetShiftBlocks(userId, targetDateIso, period) {
    const userShifts = db.getShifts(userId);
    const dayData = userShifts[targetDateIso];
    if (!dayData) return [];

    const candidateBlockIds = period === 'OCHTEND'
      ? ['M1', 'M2']
      : period === 'MIDDAG'
        ? ['S1', 'S2', 'S3']
        : ['M1', 'M2', 'S1', 'S2', 'S3'];

    const matchedBlocks = [];

    // Format 1: 5-block dictionary { M1: { vrijcheckActive: true }, M2: ... }
    for (const bId of candidateBlockIds) {
      const blockObj = dayData[bId];
      if (blockObj && typeof blockObj === 'object') {
        if (blockObj.vrijcheckActive === true) {
          matchedBlocks.push({ blockId: bId, details: blockObj });
        }
      }
    }

    // Format 2: Array of shifts
    if (matchedBlocks.length === 0 && Array.isArray(dayData)) {
      for (const item of dayData) {
        if (item && candidateBlockIds.includes(item.block) && item.vrijcheckActive === true) {
          matchedBlocks.push({ blockId: item.block, details: item });
        }
      }
    }

    // Format 3: Single shift object
    if (matchedBlocks.length === 0 && dayData.block && candidateBlockIds.includes(dayData.block)) {
      if (dayData.vrijcheckActive === true) {
        matchedBlocks.push({ blockId: dayData.block, details: dayData });
      }
    }

    return matchedBlocks;
  }

  hasAnyShiftForPeriod(userId, targetDateIso, period) {
    const userShifts = db.getShifts(userId);
    const dayData = userShifts[targetDateIso];
    if (!dayData) return false;
    const candidateBlockIds = period === 'OCHTEND' ? ['M1', 'M2'] : ['S1', 'S2', 'S3'];

    for (const bId of candidateBlockIds) {
      if (dayData[bId]) return true;
    }
    if (Array.isArray(dayData)) {
      return dayData.some(item => candidateBlockIds.includes(item?.block));
    }
    if (dayData.block && candidateBlockIds.includes(dayData.block)) return true;
    return false;
  }

  /**
   * Process message and trigger real or simulated Slack reactions for ALL matching registered runners!
   */
  async processMessage(msg, isSimulation = false) {
    const text = msg.text || '';
    const username = msg.username || msg.user || '';
    const parsed = this.parsePlannerMessage(text, username, msg.user);

    if (!parsed || !parsed.isPlannerMessage) {
      return null;
    }

    this.log('info', `Day-Planning-Sender bericht gedetecteerd! Datum: ${parsed.parsedDate || 'onbekend'}, Blok: ${parsed.period || 'onbekend'}`);
    const targetDateIso = parsed.isoDate || new Date().toISOString().split('T')[0];

    // Multi-User: get all active runners
    let allUsers = db.getAllUsers();
    if (allUsers.length === 0) {
      allUsers = [db.getSettings('default')];
    }

    const runnersProcessed = [];

    // Process all users concurrently in parallel
    await Promise.allSettled(allUsers.map(async (user) => {
      const uId = user.userId || 'default';
      const uName = user.username || uId;

      // Skip runners who explicitly turned off autoReact
      if (user.autoReact === false) {
        return;
      }

      const activeBlocks = this.resolveTargetShiftBlocks(uId, targetDateIso, parsed.period);

      // Case 1: Runner has no active shifts with vrijcheck enabled for this period
      if (activeBlocks.length === 0) {
        const hasAnyShift = this.hasAnyShiftForPeriod(uId, targetDateIso, parsed.period);
        const reason = hasAnyShift
          ? `Vrijcheck staat UIT voor de shifts op ${targetDateIso} (${parsed.period}). Geen reactie verzonden.`
          : `Geen actieve shift in jouw rooster voor ${parsed.period} op ${targetDateIso}.`;

        const record = {
          userId: uId,
          username: uName,
          messageTs: msg.ts,
          messageDate: parsed.parsedDate || targetDateIso,
          period: parsed.period,
          matchedShift: null,
          reactionSuccess: false,
          status: hasAnyShift ? 'vrijcheck_disabled' : 'no_shift',
          reason,
          latencyMs: 0
        };
        db.addHistoryItem(uId, record);
        if (this.io) {
          this.io.to(`user:${uId}`).emit('bot:reaction_event', record);
        }
        runnersProcessed.push({ user: uName, userId: uId, matched: false, reason });
        return;
      }

      // Case 2: Runner has 1 or more matching shift blocks!
      const userShifts = db.getShifts(uId);
      const dayData = userShifts[targetDateIso] || {};

      for (const { blockId } of activeBlocks) {
        const emojiName = this.getEmojiForShiftBlock(user, blockId);
        if (!emojiName) continue;

        this.log('info', `🎯 SHIFT MATCH voor ${uName}! Datum: ${targetDateIso}, Blok: ${blockId} ➜ Bliksemsnel reageren met :${emojiName}:...`);
        const startTime = performance.now();
        let reactionSuccess = false;
        let errorDetail = null;

        if (isSimulation) {
          // Fast realistic reaction time in simulation (~80-140ms)
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 60) + 80));
          reactionSuccess = true;
          this.log('success', `[SIMULATIE] Reactie :${emojiName}: geplaatst voor ${uName} (${blockId})!`);
        } else {
          try {
            const res = await this.callSlackApi('reactions.add', {
              channel: this.resolvedChannelId || user.channelId || 'CAM2MJTA9',
              timestamp: msg.ts,
              name: emojiName
            }, 'POST', user);

            if (res.ok) {
              reactionSuccess = true;
              this.log('success', `🚀 Echte Slack reactie :${emojiName}: geplaatst voor ${uName} (${blockId})!`);
            } else if (res.error === 'already_reacted') {
              reactionSuccess = true;
              this.log('info', `${uName} had al eerder gereageerd met :${emojiName}:.`);
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

        const reactionStatus = {
          success: reactionSuccess,
          emoji: emojiName,
          timestamp: new Date().toISOString(),
          latencyMs,
          messageTs: msg.ts,
          period: parsed.period,
          error: errorDetail
        };

        if (typeof dayData === 'object' && dayData[blockId]) {
          dayData[blockId] = {
            ...dayData[blockId],
            reactionStatus
          };
        } else {
          dayData[blockId] = {
            block: blockId,
            vrijcheckActive: true,
            reactionStatus
          };
        }
        userShifts[targetDateIso] = dayData;
        db.saveShifts(uId, userShifts);

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
        db.addHistoryItem(uId, historyRecord);

        if (this.io) {
          this.io.to(`user:${uId}`).emit('shifts:updated', userShifts);
          this.io.to(`user:${uId}`).emit('bot:reaction_event', historyRecord);
          this.io.to(`user:${uId}`).emit('history:updated', db.getHistory(uId));
        }

        runnersProcessed.push({ user: uName, userId: uId, matched: true, blockId, emojiName, reactionSuccess, latencyMs });
      }
    }));

    this.processedMessageIds.add(msg.ts);

    // Global summary emit for all listening clients
    if (this.io) {
      this.io.emit('bot:multi_reaction_summary', {
        messageTs: msg.ts,
        date: targetDateIso,
        period: parsed.period,
        runners: runnersProcessed
      });
    }

    const firstMatched = runnersProcessed.find(r => r.matched);
    return {
      parsedDate: targetDateIso,
      period: parsed.period,
      runners: runnersProcessed,
      matchedShift: firstMatched?.blockId || null,
      emoji: firstMatched?.emojiName || null,
      reactionSuccess: firstMatched ? firstMatched.reactionSuccess : false,
      status: firstMatched ? 'success' : (runnersProcessed[0]?.reason?.includes('UIT') ? 'vrijcheck_disabled' : 'no_shift'),
      reason: firstMatched ? null : runnersProcessed[0]?.reason
    };
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

    const res = await this.callSlackApi('reactions.add', {
      channel: channelId,
      timestamp: targetMessage.ts,
      name: cleanEmoji
    }, 'POST', user);

    if (res.ok || res.error === 'already_reacted') {
      return {
        ok: true,
        emoji: cleanEmoji,
        messageTs: targetMessage.ts,
        alreadyReacted: res.error === 'already_reacted'
      };
    }

    throw new Error(res.error || 'Slack reactie mislukt');
  }
}
