import { WebClient } from '@slack/web-api';
import { db } from './db.js';

export class SlackBotManager {
  constructor(io) {
    this.io = io;
    this.slackClient = null;
    this.pollTimer = null;
    this.lastCheckedTs = null;
    this.processedMessageIds = new Set();
    this.status = 'disconnected'; // 'connected' | 'disconnected' | 'polling' | 'error' | 'simulated'
    this.lastError = null;
    this.resolvedChannelId = null;
    this.lastActivity = null;

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
      channelName: settings.channelName,
      channelId: this.resolvedChannelId || settings.channelId,
      botSenderName: settings.botSenderName,
      autoReact: settings.autoReact,
      hasToken: Boolean(settings.slackToken && settings.slackToken.trim().length > 0),
      processedCount: this.processedMessageIds.size
    };
  }

  async initialize() {
    const settings = db.getSettings();
    if (!settings.slackToken || !settings.slackToken.trim()) {
      this.status = 'disconnected';
      this.log('info', 'Geen Slack token geconfigureerd. Slack bot staat in simulatie/wachtstand.');
      return;
    }

    try {
      this.status = 'connecting';
      this.slackClient = new WebClient(settings.slackToken.trim());
      
      // Test authentication
      const authTest = await this.slackClient.auth.test();
      this.log('success', `Slack verbinding geslaagd! Bot/Gebruiker: ${authTest.user || authTest.bot_id} (Team: ${authTest.team})`);
      
      // Resolve channel ID if not provided
      await this.resolveChannel(settings);

      this.status = 'polling';
      this.startPolling();
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message || 'Fout bij verbinden met Slack';
      this.log('error', `Slack initialisatie mislukt: ${this.lastError}`);
    }
  }

  async resolveChannel(settings) {
    if (settings.channelId && settings.channelId.startsWith('C')) {
      this.resolvedChannelId = settings.channelId;
      return;
    }

    try {
      const channelNameClean = (settings.channelName || 'nl-dist-runners-hlm').replace(/^#/, '');
      this.log('info', `Zoeken naar Slack kanaal #${channelNameClean}...`);
      
      const res = await this.slackClient.conversations.list({
        types: 'public_channel,private_channel',
        limit: 1000
      });

      const found = res.channels?.find(c => c.name === channelNameClean);
      if (found) {
        this.resolvedChannelId = found.id;
        this.log('success', `Kanaal #${channelNameClean} gevonden (ID: ${found.id})`);
        db.saveSettings({ channelId: found.id });
      } else {
        this.log('warning', `Kanaal #${channelNameClean} niet gevonden in lijst. Zorg dat de bot is uitgenodigd (/invite @bot).`);
      }
    } catch (err) {
      this.log('warning', `Kon kanaal niet automatisch resolven: ${err.message}`);
    }
  }

  startPolling() {
    this.stopPolling();
    const settings = db.getSettings();
    const interval = Math.max(1500, settings.pollIntervalMs || 2500);

    this.log('info', `Polling gestart voor #${settings.channelName} (interval: ${interval}ms)`);
    
    // Poll loop
    this.pollTimer = setInterval(async () => {
      await this.pollChannelMessages();
    }, interval);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollChannelMessages() {
    if (!this.slackClient || !this.resolvedChannelId) return;

    try {
      const query = {
        channel: this.resolvedChannelId,
        limit: 10
      };
      if (this.lastCheckedTs) {
        query.oldest = this.lastCheckedTs;
      }

      const history = await this.slackClient.conversations.history(query);
      if (!history.messages || history.messages.length === 0) return;

      // Update newest ts
      const newestMessage = history.messages[0];
      if (newestMessage && (!this.lastCheckedTs || parseFloat(newestMessage.ts) > parseFloat(this.lastCheckedTs))) {
        this.lastCheckedTs = newestMessage.ts;
      }

      // Process messages from oldest to newest
      const messagesToProcess = [...history.messages].reverse();
      for (const msg of messagesToProcess) {
        if (!this.processedMessageIds.has(msg.ts)) {
          await this.processMessage(msg);
        }
      }
    } catch (err) {
      if (err.data?.error === 'channel_not_found') {
        this.log('error', `Kanaal ${this.resolvedChannelId} niet gevonden. Controleer kanaal ID of nodig bot uit.`);
      } else {
        console.error('Error during Slack poll:', err.message);
      }
    }
  }

  /**
   * Parse message text to extract Date (DD-MM-YYYY), Shift Period (OCHTEND | MIDDAG | AVOND),
   * and surplus (Overschotten Shift 1 / Shift 2 / Shift 3)
   */
  parsePlannerMessage(text, username = '') {
    if (!text) return null;

    // Check if message is relevant (sender Day-Planning-Sender or mentions MIDDAG/OCHTEND with date and overschotten)
    const settings = db.getSettings();
    const senderMatch = username.toLowerCase().includes('day-plan') || 
                        username.toLowerCase().includes('planning') ||
                        text.includes('Graag voor') ||
                        text.includes('Overschotten') ||
                        text.includes('Check je vrij') ||
                        text.includes('HLM Planning');

    // Extract Date: e.g. 17-10-2026 or 17-10-26
    const dateMatch = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    let parsedDate = null;
    let isoDate = null;

    if (dateMatch) {
      let day = dateMatch[1].padStart(2, '0');
      let month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3];
      if (year.length === 2) year = '20' + year;
      parsedDate = `${day}-${month}-${year}`;
      isoDate = `${year}-${month}-${day}`;
    }

    // Extract Period: MIDDAG or OCHTEND or AVOND
    let period = null;
    if (/MIDDAG/i.test(text)) {
      period = 'MIDDAG';
    } else if (/OCHTEND/i.test(text)) {
      period = 'OCHTEND';
    } else if (/AVOND/i.test(text)) {
      period = 'AVOND';
    }

    // Extract Overschotten
    const overschotten = {};
    const overschotShift1 = text.match(/Shift\s*1\s*:\s*(\d+)/i);
    const overschotShift2 = text.match(/Shift\s*2\s*:\s*(\d+)/i);
    const overschotShift3 = text.match(/Shift\s*3\s*:\s*(\d+)/i);
    if (overschotShift1) overschotten.shift1 = parseInt(overschotShift1[1], 10);
    if (overschotShift2) overschotten.shift2 = parseInt(overschotShift2[1], 10);
    if (overschotShift3) overschotten.shift3 = parseInt(overschotShift3[1], 10);

    return {
      isPlannerMessage: senderMatch || Boolean(parsedDate && period),
      parsedDate,
      isoDate,
      period,
      overschotten,
      rawText: text
    };
  }

  /**
   * Determine which emoji to react with based on user's shift:
   * 1-red voor M1 en S1
   * 2-red voor M2 en S2
   * 3-red voor S3
   */
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
   * Process incoming Slack message
   */
  async processMessage(msg, isSimulation = false) {
    const settings = db.getSettings();
    const text = msg.text || '';
    const username = msg.username || msg.user || '';
    const parsed = this.parsePlannerMessage(text, username);

    if (!parsed || !parsed.isPlannerMessage) {
      return null;
    }

    this.log('info', `Day-Planning-Sender bericht gedetecteerd! Datum: ${parsed.parsedDate || 'onbekend'}, Blok: ${parsed.period || 'onbekend'}`);

    // Determine target date
    const targetDateIso = parsed.isoDate || new Date().toISOString().split('T')[0];
    const userShift = db.getShiftForDate(targetDateIso);

    if (!userShift || userShift.block === 'none') {
      const reason = `Geen actieve shift gevonden in rooster voor ${targetDateIso}. Geen vrijcheck reactie nodig.`;
      this.log('info', reason);
      
      const record = {
        messageTs: msg.ts,
        messageDate: parsed.parsedDate || targetDateIso,
        period: parsed.period,
        matchedShift: null,
        reactionSuccess: false,
        status: 'no_shift',
        reason,
        latencyMs: 0
      };
      db.addHistoryItem(record);
      this.processedMessageIds.add(msg.ts);
      this.io.emit('bot:reaction_event', record);
      return record;
    }

    // Check if shift matches the period (e.g. OCHTEND is M1/M2, MIDDAG is S1/S2/S3)
    const block = userShift.block; // 'M1', 'M2', 'S1', 'S2', 'S3'
    let isPeriodMatch = true;

    if (parsed.period === 'OCHTEND' && !['M1', 'M2'].includes(block)) {
      isPeriodMatch = false;
    } else if (parsed.period === 'MIDDAG' && !['S1', 'S2', 'S3'].includes(block)) {
      isPeriodMatch = false;
    }

    if (!isPeriodMatch) {
      const reason = `Bericht is voor ${parsed.period}, maar je bent ingeroosterd voor ${block}. Geen match.`;
      this.log('warning', reason);
      const record = {
        messageTs: msg.ts,
        messageDate: parsed.parsedDate || targetDateIso,
        period: parsed.period,
        matchedShift: block,
        reactionSuccess: false,
        status: 'period_mismatch',
        reason,
        latencyMs: 0
      };
      db.addHistoryItem(record);
      this.processedMessageIds.add(msg.ts);
      this.io.emit('bot:reaction_event', record);
      return record;
    }

    // Check if Vrijcheck is enabled for this shift
    if (userShift.vrijcheckActive === false) {
      const reason = `Vrijcheck staat uitgeschakeld voor ${block} op ${targetDateIso}.`;
      this.log('info', reason);
      const record = {
        messageTs: msg.ts,
        messageDate: parsed.parsedDate || targetDateIso,
        period: parsed.period,
        matchedShift: block,
        reactionSuccess: false,
        status: 'vrijcheck_disabled',
        reason,
        latencyMs: 0
      };
      db.addHistoryItem(record);
      this.processedMessageIds.add(msg.ts);
      this.io.emit('bot:reaction_event', record);
      return record;
    }

    // Determine target emoji
    const emojiName = this.getEmojiForShiftBlock(block);
    if (!emojiName) {
      this.log('error', `Kon geen emoji vinden voor shift block ${block}`);
      return null;
    }

    this.log('info', `Shift match gevonden! Datum: ${targetDateIso}, Blok: ${block} -> Emoji: :${emojiName}:`);

    // Execute reaction
    const startTime = Date.now();
    let reactionSuccess = false;
    let errorDetail = null;

    if (isSimulation || !this.slackClient) {
      // Simulation mode with simulated API delay (120ms - 280ms)
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 160) + 120));
      reactionSuccess = true;
      this.log('success', `[SIMULATIE] Reactie :${emojiName}: succesvol geplaatst!`);
    } else {
      try {
        const res = await this.slackClient.reactions.add({
          channel: this.resolvedChannelId || settings.channelId,
          timestamp: msg.ts,
          name: emojiName
        });
        reactionSuccess = res.ok === true;
        this.log('success', `Reactie :${emojiName}: geplaatst op Slack bericht!`);
      } catch (err) {
        if (err.data?.error === 'already_reacted') {
          reactionSuccess = true;
          this.log('info', `Reactie :${emojiName}: was al eerder geplaatst op dit bericht.`);
        } else {
          reactionSuccess = false;
          errorDetail = err.data?.error || err.message;
          this.log('error', `Fout bij toevoegen reactie :${emojiName}:: ${errorDetail}`);
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    this.processedMessageIds.add(msg.ts);

    // Update shift status in database
    const reactionStatus = {
      success: reactionSuccess,
      emoji: emojiName,
      timestamp: new Date().toISOString(),
      latencyMs,
      messageTs: msg.ts,
      period: parsed.period,
      error: errorDetail
    };

    const updatedShifts = db.updateShift(targetDateIso, {
      reactionStatus
    });

    // Record in history
    const historyItem = {
      messageTs: msg.ts,
      messageDate: parsed.parsedDate || targetDateIso,
      period: parsed.period,
      matchedShift: block,
      emoji: emojiName,
      reactionSuccess,
      latencyMs,
      status: reactionSuccess ? 'success' : 'error',
      details: reactionSuccess 
        ? `Succesvol gereageerd met :${emojiName}: op ${parsed.period || ''} bericht (${latencyMs}ms latency)` 
        : `Mislukt om te reageren met :${emojiName}:: ${errorDetail}`,
      isSimulation
    };
    db.addHistoryItem(historyItem);

    // Broadcast to UI
    this.io.emit('bot:reaction_event', historyItem);
    this.io.emit('shifts:updated', updatedShifts);

    return historyItem;
  }

  /**
   * Simulate Day-Planning-Sender posting a message
   */
  async simulateDayPlannerMessage({
    period = 'MIDDAG',
    date = '17-10-2026',
    overschotten = { shift1: 3, shift2: 4, shift3: 2 }
  }) {
    const fakeTs = (Date.now() / 1000).toFixed(6);
    const fakeMessage = {
      ts: fakeTs,
      username: 'Day-Planning-Sender',
      text: `:picnic: ${period} ${date}

 Graag voor 11:00u bevestigen dat je komt d.m.v. 

 Ziek melden?
De ziekmeld-procedure staat in de Bookmarks!

 Tekorten
Geen tekort

 Overschotten
Shift 1: ${overschotten.shift1}
Shift 2: ${overschotten.shift2}
${overschotten.shift3 ? `Shift 3: ${overschotten.shift3}` : ''}

Check je vrij? Als iedereen gecheckt heeft, hoor je uiterlijk 1,5 uur voor aanvang van je shift of je thuis kan blijven!
Vraag de R+ om een taak 
• EPV's wassen
• Hub vegen
• Kantine schoonmaken
• Koeling schoonmaken

R+: @Martijn 13:00  20:00
TD/SD: @Shakira van Asperen

 Nog vragen? Check de bookmarks in dit kanaal en/of de RunnerWiki @channel`,
      channel: this.resolvedChannelId || 'C_SIMULATED_HLM'
    };

    this.log('info', `[SIMULATIE] Day-Planning-Sender heeft een nieuw bericht geplaatst in #nl-dist-runners-hlm (${period} ${date})`);
    return await this.processMessage(fakeMessage, true);
  }
}
