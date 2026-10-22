/**
 * DayPlannerSender Emulator for Vrijcheck 24/7 Server
 * 
 * Accurately simulates the Picnic Day-Planning-Sender bot in Slack,
 * including authentic template formatting, variable post times (e.g., 10:10:28 / 17:10:19),
 * and configurable random millisecond delays to benchmark reaction speed.
 */

export class DayPlannerEmulator {
  constructor(botManager) {
    this.botManager = botManager;
  }

  /**
   * Generates a Picnic Day-Planning-Sender message formatted exactly like real Slack posts.
   * 
   * @param {Object} options
   * @param {'OCHTEND'|'MIDDAG'} options.period Shift period
   * @param {string} options.date Formatted as DD-MM-YYYY (e.g. '18-10-2026')
   * @param {Object} [options.overschotten] Over-capacity runners count per shift
   */
  generateMessageText({ period = 'OCHTEND', date, overschotten = null }) {
    const today = new Date();
    const formattedDate = date || `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    
    const defaultOverschotten = period === 'OCHTEND'
      ? { shift1: 3, shift2: 4 }
      : { shift1: 2, shift2: 3, shift3: 1 };
    
    const counts = overschotten || defaultOverschotten;
    const confirmTime = period === 'OCHTEND' ? '07:00u' : '11:00u';

    let overschotLines = `Shift 1: ${counts.shift1 ?? 2}\nShift 2: ${counts.shift2 ?? 3}`;
    if (counts.shift3 !== undefined) {
      overschotLines += `\nShift 3: ${counts.shift3}`;
    }

    return `:picnic: ${period} ${formattedDate}

Graag voor ${confirmTime} bevestigen dat je komt d.m.v. 

Ziek melden?
De ziekmeld-procedure staat in de Bookmarks!

Tekorten
Geen tekort

Overschotten
${overschotLines}

Check je vrij? Als iedereen gecheckt heeft, hoor je uiterlijk 1,5 uur voor aanvang van je shift of je thuis kan blijven!
Vraag de R+ om een taak 
• EPV's wassen
• Hub vegen
• Kantine schoonmaken
• Koeling schoonmaken

R+: @Martijn ${period === 'OCHTEND' ? '06:30 - 15:00' : '13:00 - 21:30'}
TD/SD: @Shakira van Asperen

Nog vragen? Check de bookmarks in dit kanaal en/of de RunnerWiki @channel`;
  }

  /**
   * Emulates a live Slack post from Day-Planning-Sender with optional random millisecond delay.
   * 
   * @param {Object} options
   * @param {'OCHTEND'|'MIDDAG'} options.period
   * @param {string} options.date DD-MM-YYYY
   * @param {number} [options.minDelayMs=40] Minimum simulated network jitter (ms)
   * @param {number} [options.maxDelayMs=180] Maximum simulated network jitter (ms)
   * @param {boolean} [options.isSimulation=true] Whether this triggers real Slack or simulated response
   */
  async emulatePost(options = {}) {
    const {
      period = 'OCHTEND',
      date,
      minDelayMs = 40,
      maxDelayMs = 180,
      isSimulation = true
    } = options;

    // Simulate realistic posting jitter (Day-Planning-Sender latency variance)
    const randomJitter = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
    const postStart = performance.now();

    const text = this.generateMessageText({ period, date, overschotten: options.overschotten });
    const fakeTs = (Date.now() / 1000).toFixed(6);

    const fakeSlackMessage = {
      ts: fakeTs,
      user: 'U062ALTD6DQ',
      username: 'Day-Planning-Sender',
      text,
      channel: this.botManager?.resolvedChannelId || 'CAM2MJTA9'
    };

    // Wait for the simulated network jitter before processing
    await new Promise(resolve => setTimeout(resolve, randomJitter));

    const detectionTime = performance.now();
    const result = await this.botManager.processMessage(fakeSlackMessage, isSimulation);
    const completedTime = performance.now();

    const benchmark = {
      simulatedJitterMs: randomJitter,
      detectionLatencyMs: Math.round(detectionTime - postStart),
      reactionProcessingMs: Math.round(completedTime - detectionTime),
      totalReactionTimeMs: Math.round(completedTime - postStart),
      period,
      targetDate: date,
      matchedShift: result?.matchedShift || null,
      emoji: result?.emoji || null,
      reactionSuccess: Boolean(result?.reactionSuccess),
      status: result?.status || 'processed',
      reason: result?.reason || result?.details || null
    };

    return {
      message: fakeSlackMessage,
      result,
      benchmark
    };
  }
}
