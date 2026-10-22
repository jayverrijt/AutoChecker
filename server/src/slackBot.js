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

    // Load history of processed messages so we don't double react on server reboot
    const history = db.getHistory();
    history.forEach(item => {
      if (item.messageTs) this.processedMessageIds.add(item.messageTs);
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

  getStatus() {
    const settings = db.getSettings();
    return {
      status: this.status,
      lastError: this.lastError,
      lastActivity: this.lastActivity,
      workspaceUrl: settings.workspaceUrl || 'https://picnic.enterprise.slack.com',
      channelName: settings.channelName,
      channelId: this.resolvedChannelId || settings.channelId,
      botSenderName: settings.botSenderName,
      autoReact: settings.autoReact,
      pollIntervalMs: settings.pollIntervalMs || 1000,
      hasToken: Boolean(settings.slackToken && settings.slackToken.trim().length > 0),
      hasCookie: Boolean(settings.slackCookie && settings.slackCookie.trim().length > 0),
      authInfo: this.authInfo,
      processedCount: this.processedMessageIds.size,
      recentMessagesCount: this.recentChannelMessages.length
    };
  }

  getApiBaseUrl() {
    const settings = db.getSettings();
    const ws = (settings.workspaceUrl || 'https://picnic.enterprise.slack.com').trim().replace(/\/+$/, '');
    return `${ws}/api`;
  }

  /**
   * Universal Slack API caller with Enterprise Grid session support (xoxc + d cookie)
   */
  async callSlackApi(endpoint, body = null, method = 'POST') {
    const settings = db.getSettings();
    const token = (settings.slackToken || '').trim();
    if (!token) {
      throw new Error('Geen Slack token geconfigureerd');
    }

    // Check if user has xoxc token without d cookie
    if (token.startsWith('xoxc-') && (!settings.slackCookie || !settings.slackCookie.trim())) {
      this.log('warning', 'Een xoxc- token vereist altijd de bijbehorende "d" (xoxd-...) sessiecookie op Enterprise Slack.');
      return {
        ok: false,
        error: 'invalid_auth: Je hebt een xoxc- token ingevuld, maar de Session Cookie "d" (xoxd-...) ontbreekt nog. Vul deze in of gebruik de "Copy as cURL" knop!'
      };
    }

    const baseUrl = this.getApiBaseUrl();
    const url = `${baseUrl}/${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };

    // Attach d cookie for Enterprise Grid xoxc session if present
    if (settings.slackCookie && settings.slackCookie.trim()) {
      let cookieVal = settings.slackCookie.trim();
      // Strip leading d: or d= or d:" or quotes
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
      // Fallback to standard slack.com/api if enterprise URL failed with network issue
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

  /**
   * Parse channel input (supports channel ID like C012345 or full link like https://picnic.enterprise.slack.com/archives/C0123456789)
   */
  extractChannelId(input) {
    if (!input) return null;
    const clean = input.trim();
    
    // Check if it's an archive URL: .../archives/C0123456789/...
    const urlMatch = clean.match(/\/archives\/([A-Z0-9]+)/i);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Check if it's already a channel ID (starts with C or G)
    if (/^[CG][A-Z0-9]{8,12}$/i.test(clean)) {
      return clean.toUpperCase();
    }

    return null;
  }

  /**
   * Test real Slack connection and channel access
   */
  async testConnection() {
    const settings = db.getSettings();
    if (!settings.slackToken) {
      return { ok: false, error: 'Geen token ingevuld. Voer eerst je xoxc of xoxp token in.' };
    }

    try {
      this.log('info', `Verbinding testen met ${settings.workspaceUrl || 'picnic.enterprise.slack.com'}...`);
      const authRes = await this.callSlackApi('auth.test', {});
      
      if (!authRes.ok) {
        this.status = 'error';
        this.lastError = authRes.error || 'Authenticatie mislukt';
        this.log('error', `Slack authenticatiefout: ${this.lastError}`);
        return { ok: false, error: this.lastError };
      }

      this.authInfo = {
        user: authRes.user,
        userId: authRes.user_id,
        team: authRes.team,
        teamId: authRes.team_id,
        url: authRes.url
      };

      this.log('success', `Verbonden met Picnic Slack als runner: ${authRes.user} (${authRes.team})!`);

      // Try resolving channel
      await this.resolveChannel(settings);

      let channelTest = null;
      if (this.resolvedChannelId) {
        const historyRes = await this.callSlackApi(
          `conversations.history?channel=${this.resolvedChannelId}&limit=5`,
          null,
          'GET'
        );

        if (historyRes.ok && historyRes.messages) {
          channelTest = {
            ok: true,
            channelId: this.resolvedChannelId,
            messageCount: historyRes.messages.length,
            latestMessage: historyRes.messages[0] ? {
              text: historyRes.messages[0].text?.slice(0, 100),
              user: historyRes.messages[0].user || historyRes.messages[0].username,
              ts: historyRes.messages[0].ts
            } : null
          };
          this.log('success', `Kanaal #${settings.channelName} succesvol gecontroleerd!`);
        } else {
          channelTest = { ok: false, error: historyRes.error };
          this.log('warning', `Kanaal #${settings.channelName} kan niet gelezen worden: ${historyRes.error}`);
        }
      }

      return {
        ok: true,
        auth: this.authInfo,
        channel: channelTest
      };
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message;
      this.log('error', `Verbindingsfout: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  async initialize() {
    const settings = db.getSettings();
    if (!settings.slackToken || !settings.slackToken.trim()) {
      this.status = 'disconnected';
      this.log('info', 'Geen Slack credentials geconfigureerd. Lokale bot staat in wachtstand.');
      return;
    }

    try {
      this.status = 'connecting';
      const authRes = await this.callSlackApi('auth.test', {});
      
      if (!authRes.ok) {
        throw new Error(authRes.error || 'Authenticatie mislukt');
      }

      this.authInfo = {
        user: authRes.user,
        userId: authRes.user_id,
        team: authRes.team,
        url: authRes.url
      };

      this.log('success', `Verbonden met Picnic Slack (${settings.workspaceUrl}) als: ${authRes.user}!`);

      await this.resolveChannel(settings);

      this.status = 'polling';
      this.startPolling();
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message || 'Fout bij verbinden met Slack';
      this.log('error', `Initialisatie mislukt: ${this.lastError}`);
    }
  }

  async resolveChannel(settings) {
    // 1. Direct channel ID in settings.channelId
    const directFromId = this.extractChannelId(settings.channelId);
    if (directFromId) {
      this.resolvedChannelId = directFromId;
      return;
    }

    // 2. Extracted from settings.channelName if user pasted a link
    const directFromName = this.extractChannelId(settings.channelName);
    if (directFromName) {
      this.resolvedChannelId = directFromName;
      db.saveSettings({ channelId: directFromName });
      return;
    }

    // Known HLM channel fallback
    if ((settings.channelName || '').toLowerCase().includes('hlm')) {
      this.resolvedChannelId = 'CAM2MJTA9';
      db.saveSettings({ channelId: 'CAM2MJTA9' });
      return;
    }

    // 3. Try searching by channel name in conversations.list
    try {
      const channelNameClean = (settings.channelName || 'nl-dist-runners-hlm').replace(/^#/, '');
      this.log('info', `Zoeken naar kanaal #${channelNameClean} op Picnic Slack...`);

      const res = await this.callSlackApi(
        'conversations.list?types=public_channel,private_channel&limit=1000',
        null,
        'GET'
      );

      if (res.ok && res.channels) {
        const found = res.channels.find(c => c.name === channelNameClean);
        if (found) {
          this.resolvedChannelId = found.id;
          this.log('success', `Kanaal #${channelNameClean} gevonden (ID: ${found.id})`);
          db.saveSettings({ channelId: found.id });
          return;
        }
      }
      this.log('warning', `Kon kanaal #${channelNameClean} niet automatisch vinden in lijst. Plak eventueel direct de kanaallink in Instellingen.`);
    } catch (err) {
      this.log('warning', `Fout bij opzoeken kanaal: ${err.message}`);
    }
  }

  isCriticalWindow() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();

    // 17:10 window (17:09:40 - 17:12:00) for morning shifts (seconds vary: :19, :28, etc.)
    if (h === 17 && (m === 10 || m === 11 || (m === 9 && s >= 40))) {
      return { active: true, target: '17:10', period: 'OCHTEND', delayMs: 400 };
    }
    // 10:10 window (10:09:40 - 10:12:00) for afternoon shifts (seconds vary: :19, :28, :00)
    if (h === 10 && (m === 10 || m === 11 || (m === 9 && s >= 40))) {
      return { active: true, target: '10:10', period: 'MIDDAG', delayMs: 400 };
    }
    return { active: false, delayMs: 1000 };
  }

  startPolling() {
    this.stopPolling();
    this.isPolling = true;
    const settings = db.getSettings();
    this.log('info', `24/7 Slack luister-engine actief voor #${settings.channelName} (Smart 17:10 & 10:10 venster)`);

    const loop = async () => {
      if (!this.isPolling) return;
      const windowCheck = this.isCriticalWindow();
      const delay = windowCheck.active ? (windowCheck.delayMs || 400) : Math.max(800, settings.pollIntervalMs || 1000);

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

      // Update newest timestamp
      const newestMessage = res.messages[0];
      if (newestMessage && (!this.lastCheckedTs || parseFloat(newestMessage.ts) > parseFloat(this.lastCheckedTs))) {
        this.lastCheckedTs = newestMessage.ts;
      }

      // Update recent channel messages
      this.recentChannelMessages = res.messages.slice(0, 10);
      if (this.io) {
        this.io.emit('bot:recent_messages', this.recentChannelMessages);
      }

      // Process messages from oldest to newest
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

  /**
   * Parse message text to extract Date (DD-MM-YYYY), Shift Period (OCHTEND | MIDDAG | AVOND),
   * and surplus (Overschotten Shift 1 / Shift 2 / Shift 3)
   */
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

    // Match DD-MM-YYYY or DD-MM or DD/MM/YYYY or DD/MM
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

  getEmojiForShiftBlock(block) {
    const settings = db.getSettings();
    const mapping = settings.emojiMapping || {
      M1: '1-red',
      M2: '2-red',
      S1: '1-red',
      S2: '2-red',
      S3: '3-red'
    };
    return mapping[block] || null;
  }

  /**
   * Resolves all active blocks for a given date that match the shift period
   * (supporting 5-block dictionary, array, and legacy single object formats)
   */
  resolveTargetShiftBlocks(targetDateIso, period) {
    const allShifts = db.getShifts();
    const dayData = allShifts[targetDateIso];
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

    // Format 2: Array of shifts [ { block: 'M1', vrijcheckActive: true }, ... ]
    if (matchedBlocks.length === 0 && Array.isArray(dayData)) {
      for (const item of dayData) {
        if (item && candidateBlockIds.includes(item.block) && item.vrijcheckActive === true) {
          matchedBlocks.push({ blockId: item.block, details: item });
        }
      }
    }

    // Format 3: Single shift object { block: 'M1', vrijcheckActive: true }
    if (matchedBlocks.length === 0 && dayData.block && candidateBlockIds.includes(dayData.block)) {
      if (dayData.vrijcheckActive === true) {
        matchedBlocks.push({ blockId: dayData.block, details: dayData });
      }
    }

    return matchedBlocks;
  }

  /**
   * Check if any shift exists on this day for the period, even if vrijcheck is disabled
   */
  hasAnyShiftForPeriod(targetDateIso, period) {
    const allShifts = db.getShifts();
    const dayData = allShifts[targetDateIso];
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
   * Process message and trigger real or simulated Slack reaction
   */
  async processMessage(msg, isSimulation = false) {
    const settings = db.getSettings();
    const text = msg.text || '';
    const username = msg.username || msg.user || '';
    const parsed = this.parsePlannerMessage(text, username, msg.user);

    if (!parsed || !parsed.isPlannerMessage) {
      return null;
    }

    this.log('info', `Day-Planning-Sender bericht gedetecteerd! Datum: ${parsed.parsedDate || 'onbekend'}, Blok: ${parsed.period || 'onbekend'}`);

    const targetDateIso = parsed.isoDate || new Date().toISOString().split('T')[0];
    const activeBlocks = this.resolveTargetShiftBlocks(targetDateIso, parsed.period);

    // Case 1: No active shifts with vrijcheck enabled for this period
    if (activeBlocks.length === 0) {
      const hasAnyShift = this.hasAnyShiftForPeriod(targetDateIso, parsed.period);
      const reason = hasAnyShift
        ? `Vrijcheck staat UIT voor de shifts op ${targetDateIso} (${parsed.period}). Geen reactie verzonden.`
        : `Geen actieve shift in jouw rooster voor ${parsed.period} op ${targetDateIso}.`;

      this.log('info', reason);
      
      const record = {
        messageTs: msg.ts,
        messageDate: parsed.parsedDate || targetDateIso,
        period: parsed.period,
        matchedShift: null,
        reactionSuccess: false,
        status: hasAnyShift ? 'vrijcheck_disabled' : 'no_shift',
        reason,
        latencyMs: 0
      };
      db.addHistoryItem(record);
      this.processedMessageIds.add(msg.ts);
      if (this.io) {
        this.io.emit('bot:reaction_event', record);
      }
      return record;
    }

    // Case 2: One or more matching shift blocks have vrijcheckActive === true!
    const results = [];
    const allShifts = db.getShifts();
    const dayData = allShifts[targetDateIso] || {};

    for (const { blockId } of activeBlocks) {
      const emojiName = this.getEmojiForShiftBlock(blockId);
      if (!emojiName) {
        this.log('error', `Geen emoji mapping gevonden voor ${blockId}`);
        continue;
      }

      this.log('info', `🎯 SHIFT MATCH! Datum: ${targetDateIso}, Blok: ${blockId} ➜ Bliksemsnel reageren met :${emojiName}:...`);
      const startTime = performance.now();
      let reactionSuccess = false;
      let errorDetail = null;

      if (isSimulation) {
        // Fast realistic reaction time in simulation (~80-140ms)
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 60) + 80));
        reactionSuccess = true;
        this.log('success', `[SIMULATIE] Reactie :${emojiName}: geplaatst voor ${blockId}!`);
      } else {
        try {
          const res = await this.callSlackApi('reactions.add', {
            channel: this.resolvedChannelId || settings.channelId,
            timestamp: msg.ts,
            name: emojiName
          });

          if (res.ok) {
            reactionSuccess = true;
            this.log('success', `🚀 Echte Slack reactie :${emojiName}: geplaatst op Picnic Slack voor ${blockId}!`);
          } else if (res.error === 'already_reacted') {
            reactionSuccess = true;
            this.log('info', `Je had al eerder gereageerd met :${emojiName}: op dit bericht.`);
          } else {
            reactionSuccess = false;
            errorDetail = res.error || 'Onbekende fout';
            this.log('error', `Slack reactie mislukt met fout: ${errorDetail}`);
          }
        } catch (err) {
          reactionSuccess = false;
          errorDetail = err.message;
          this.log('error', `Verbindingsfout tijdens reactie: ${errorDetail}`);
        }
      }

      const latencyMs = Math.round(performance.now() - startTime);
      this.processedMessageIds.add(msg.ts);

      const reactionStatus = {
        success: reactionSuccess,
        emoji: emojiName,
        timestamp: new Date().toISOString(),
        latencyMs,
        messageTs: msg.ts,
        period: parsed.period,
        error: errorDetail
      };

      // Save reaction status on the specific shift block
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
      allShifts[targetDateIso] = dayData;
      db.saveShifts(allShifts);

      const historyItem = {
        messageTs: msg.ts,
        messageDate: parsed.parsedDate || targetDateIso,
        period: parsed.period,
        matchedShift: blockId,
        emoji: emojiName,
        reactionSuccess,
        latencyMs,
        status: reactionSuccess ? 'success' : 'error',
        details: reactionSuccess 
          ? `Succesvol gereageerd met :${emojiName}: op ${parsed.period || ''} (${latencyMs}ms reactietijd)` 
          : `Mislukt om te reageren met :${emojiName}:: ${errorDetail}`,
        isSimulation
      };
      db.addHistoryItem(historyItem);

      if (this.io) {
        this.io.emit('bot:reaction_event', historyItem);
        this.io.emit('shifts:updated', allShifts);
      }

      results.push(historyItem);
    }

    return results[0] || null;
  }

  async simulateDayPlannerMessage({
    period = 'MIDDAG',
    date,
    overschotten
  }) {
    const formattedDate = date || (period === 'OCHTEND' ? '18-10-2026' : '17-10-2026');
    const emulationResult = await this.emulator.emulatePost({
      period,
      date: formattedDate,
      overschotten,
      isSimulation: true
    });
    return emulationResult.result;
  }

  /**
   * Directly test placing a real Slack reaction on the latest message in #nl-dist-runners-hlm
   */
  async testRealReactionOnSlack({ emoji = '3-red' } = {}) {
    const settings = db.getSettings();
    if (!this.resolvedChannelId) {
      await this.resolveChannel(settings);
    }

    if (!this.resolvedChannelId) {
      throw new Error('Geen geldig kanaal ID gevonden voor ' + settings.channelName);
    }

    // 1. Fetch latest messages from the channel
    const res = await this.callSlackApi(
      `conversations.history?channel=${this.resolvedChannelId}&limit=10`,
      null,
      'GET'
    );

    if (!res.ok || !res.messages || res.messages.length === 0) {
      throw new Error('Kon geen berichten ophalen uit kanaal om op te reageren: ' + (res.error || 'onbekend'));
    }

    // Find the latest message from Day-Planning-Sender or simply the newest message
    const targetMsg = res.messages.find(m => 
      (m.text && (m.text.includes('MIDDAG') || m.text.includes('OCHTEND') || m.text.includes('Planning') || m.text.includes('HLM'))) ||
      (m.username && m.username.includes('Planning'))
    ) || res.messages[0];

    const timestamp = targetMsg.ts;
    this.log('info', `[LIVE TEST OP SLACK] Reageren met :${emoji}: op bericht (${timestamp})...`);

    const startTime = Date.now();

    // Place reaction (if already reacted, remove first so user sees it trigger live!)
    const addRes = await this.callSlackApi('reactions.add', {
      channel: this.resolvedChannelId,
      timestamp,
      name: emoji
    });

    if (!addRes.ok && addRes.error === 'already_reacted') {
      this.log('info', `[LIVE TEST OP SLACK] Was al gereageerd met :${emoji}:. Reactie wordt hernieuwd...`);
      await this.callSlackApi('reactions.remove', {
        channel: this.resolvedChannelId,
        timestamp,
        name: emoji
      });
      await new Promise(r => setTimeout(r, 400));
      await this.callSlackApi('reactions.add', {
        channel: this.resolvedChannelId,
        timestamp,
        name: emoji
      });
    } else if (!addRes.ok) {
      throw new Error(`Slack API fout bij toevoegen reactie :${emoji}:: ${addRes.error}`);
    }

    const latencyMs = Date.now() - startTime;
    this.log('success', `[LIVE TEST OP SLACK] Gelukt! Echte reactie :${emoji}: live geplaatst op Slack! (${latencyMs}ms)`);

    // Update today's shift status in UI
    const todayIso = '2026-10-17';
    const reactionStatus = {
      success: true,
      emoji,
      timestamp: new Date().toISOString(),
      latencyMs,
      messageTs: timestamp,
      period: 'MIDDAG',
      isLiveTest: true
    };

    const updatedShifts = db.updateShift(todayIso, {
      reactionStatus
    });

    const historyItem = {
      messageTs: timestamp,
      messageDate: todayIso,
      period: 'MIDDAG',
      matchedShift: 'S3',
      emoji,
      reactionSuccess: true,
      latencyMs,
      status: 'success',
      details: `Live test op Slack: gereageerd met :${emoji}: op bericht in #${settings.channelName} (${latencyMs}ms)`,
      isSimulation: false,
      isLiveTest: true
    };
    db.addHistoryItem(historyItem);

    if (this.io) {
      this.io.emit('bot:reaction_event', historyItem);
      this.io.emit('shifts:updated', updatedShifts);
    }

    return {
      ok: true,
      emoji,
      timestamp,
      latencyMs,
      messageSnippet: targetMsg.text?.slice(0, 80)
    };
  }
}

