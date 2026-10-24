import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.hasPermission = false;
    this.CHANNEL_ID = 'vrijcheck_alerts';
  }

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      if (Capacitor.isNativePlatform()) {
        const check = await LocalNotifications.checkPermissions();
        if (check.display !== 'granted') {
          const req = await LocalNotifications.requestPermissions();
          this.hasPermission = req.display === 'granted';
        } else {
          this.hasPermission = true;
        }

        // Create high-importance Android channel for heads-up alert
        try {
          await LocalNotifications.createChannel({
            id: this.CHANNEL_ID,
            name: 'Picnic Vrijcheck Meldingen',
            description: 'Meldingen wanneer de Vrijcheck API 1m van tevoren luistert en wanneer een vrijcheck is voltooid',
            importance: 5, // High importance (heads-up pop up)
            visibility: 1, // Public on lockscreen
            sound: 'beep.wav',
            vibration: true,
            lights: true,
            lightColor: '#3171f7'
          });
        } catch (cErr) {
          // Channel creation is Android only; iOS ignores gracefully
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          const p = await Notification.requestPermission();
          this.hasPermission = p === 'granted';
        } else {
          this.hasPermission = Notification.permission === 'granted';
        }
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS] Init/Permission error:', err);
    }
  }

  async requestPermission() {
    try {
      if (Capacitor.isNativePlatform()) {
        const req = await LocalNotifications.requestPermissions();
        this.hasPermission = req.display === 'granted';
        return this.hasPermission;
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        const p = await Notification.requestPermission();
        this.hasPermission = p === 'granted';
        return this.hasPermission;
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS] Request permission error:', err);
    }
    return false;
  }

  /**
   * Universal notification trigger (Native heads-up banner + Web notification)
   */
  async showNotification({ title, body, id = null, extra = {} }) {
    await this.init();

    const notifId = id || Math.floor(Date.now() % 100000);

    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title,
              body,
              channelId: this.CHANNEL_ID,
              smallIcon: 'ic_launcher',
              iconColor: '#3171f7',
              extra,
              schedule: { at: new Date(Date.now() + 100) } // immediate
            }
          ]
        });
        return true;
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon.png',
          badge: '/favicon.png'
        });
        return true;
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS] Error presenting notification:', err);
    }
    return false;
  }

  /**
   * 1 Minute Before: Trigger when API starts listening for the Slack message
   */
  async notifyListeningStarted({ target = '17:10', channel = '#nl-dist-runners-hlm', period = 'de shift' } = {}) {
    return this.showNotification({
      title: '⚡ Vrijcheck Luistermodus Gestart',
      body: `De API is 1m van tevoren begonnen met luisteren naar het Slack bericht in ${channel} (${target}).`,
      id: 10101
    });
  }

  /**
   * Completed: Trigger when reaction has finished / completed, instructing user to check Slack
   */
  async notifyVrijcheckCompleted({ success = true, emoji = '1-red', error = null } = {}) {
    if (success) {
      return this.showNotification({
        title: '✅ Vrijcheck Voltooid!',
        body: `Vrijcheck voltooid met :${emoji}:! Kijk nu op Slack om je shift te controleren.`,
        id: 20202
      });
    } else {
      return this.showNotification({
        title: '⚠️ Vrijcheck Mislukt',
        body: `Vrijcheck kon niet worden voltooid (${error || 'geen reactie'}). Kijk nu op Slack!`,
        id: 20203
      });
    }
  }

  /**
   * Schedule advance notifications in native OS alarms for future shifts
   * Runs 1m before 17:10 (17:09) and 1m before 10:10 (10:09)
   */
  async scheduleAdvanceShiftAlerts(shifts = {}, channel = '#nl-dist-runners-hlm') {
    if (!Capacitor.isNativePlatform()) return;
    await this.init();

    try {
      const pending = await LocalNotifications.getPending();
      // Cancel previous scheduled advance alarms (IDs starting with 90000+)
      const toCancel = pending.notifications
        .filter(n => n.id >= 90000 && n.id < 99999)
        .map(n => ({ id: n.id }));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }

      const now = new Date();
      const scheduledNotifications = [];
      let alertCounter = 90001;

      // Scan all days in shifts
      for (const [dateStr, dayData] of Object.entries(shifts)) {
        if (!dayData) continue;
        const [year, month, day] = dateStr.split('-').map(Number);
        if (!year || !month || !day) continue;

        // Morning shifts (M1, M2): checked at 17:10 on day - 1, alert at 17:09:00
        const hasMorning = (dayData.M1?.vrijcheckActive || dayData.M2?.vrijcheckActive);
        if (hasMorning) {
          const alertDate = new Date(year, month - 1, day - 1, 17, 9, 0, 0);
          if (alertDate.getTime() > now.getTime()) {
            scheduledNotifications.push({
              id: alertCounter++,
              title: '⚡ Vrijcheck Luistermodus Gestart',
              body: `De API is 1m van tevoren begonnen met luisteren voor de ochtend-shifts in ${channel}.`,
              channelId: this.CHANNEL_ID,
              schedule: { at: alertDate },
              smallIcon: 'ic_launcher',
              iconColor: '#3171f7'
            });
          }
        }

        // Afternoon shifts (S1, S2, S3): checked at 10:10 on day, alert at 10:09:00
        const hasAfternoon = (dayData.S1?.vrijcheckActive || dayData.S2?.vrijcheckActive || dayData.S3?.vrijcheckActive);
        if (hasAfternoon) {
          const alertDate = new Date(year, month - 1, day, 10, 9, 0, 0);
          if (alertDate.getTime() > now.getTime()) {
            scheduledNotifications.push({
              id: alertCounter++,
              title: '⚡ Vrijcheck Luistermodus Gestart',
              body: `De API is 1m van tevoren begonnen met luisteren voor de middag-shifts in ${channel}.`,
              channelId: this.CHANNEL_ID,
              schedule: { at: alertDate },
              smallIcon: 'ic_launcher',
              iconColor: '#3171f7'
            });
          }
        }
      }

      if (scheduledNotifications.length > 0) {
        await LocalNotifications.schedule({ notifications: scheduledNotifications });
        console.log(`[NOTIFICATIONS] ${scheduledNotifications.length} vooruit-geplande 1m-notificaties ingesteld`);
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS] Fout bij vooruit-plannen van notificaties:', err);
    }
  }
}

export const notificationService = new NotificationService();
