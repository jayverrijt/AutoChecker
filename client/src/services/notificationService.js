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

        try {
          await LocalNotifications.createChannel({
            id: this.CHANNEL_ID,
            name: 'Teamwork Vrijcheck Meldingen',
            description: 'Meldingen om 10:09/17:09 en direct na vrijcheck-reactie op Slack',
            importance: 5,
            visibility: 1,
            sound: 'beep.wav',
            vibration: true,
            lights: true,
            lightColor: '#3171f7'
          });
        } catch (_) {}
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
              schedule: { at: new Date(Date.now() + 100) }
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
   * 1 Minute Before (10:09 & 17:09):
   * "Luisteren gestart: Bot staat scherp voor het vrijcheck-bericht om 10:10 / 17:10."
   */
  async notifyListeningStarted({ target = '10:10 / 17:10' } = {}) {
    return this.showNotification({
      title: '⚡ Luisteren gestart',
      body: `Luisteren gestart: Bot staat scherp voor het vrijcheck-bericht om ${target}.`,
      id: 10101
    });
  }

  /**
   * Directly after reaction:
   * "Reactie succesvol geplaatst! Kijk nu op Slack om te zien of je vrij hebt gekregen."
   */
  async notifyVrijcheckCompleted({ success = true, error = null } = {}) {
    if (success) {
      return this.showNotification({
        title: '✅ Reactie succesvol geplaatst!',
        body: 'Reactie succesvol geplaatst! Kijk nu op Slack om te zien of je vrij hebt gekregen.',
        id: 20202
      });
    } else {
      return this.showNotification({
        title: '⚠️ Vrijcheck Mislukt',
        body: `Er is een technische fout opgetreden bij het plaatsen van de reactie (${error || 'onbekend'}).`,
        id: 20203
      });
    }
  }

  async scheduleAdvanceShiftAlerts(shifts = {}, channel = '#nl-dist-runners-hlm') {
    if (!Capacitor.isNativePlatform()) return;
    await this.init();

    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications
        .filter((n) => n.id >= 90000 && n.id < 99999)
        .map((n) => ({ id: n.id }));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }

      const now = new Date();
      const scheduledNotifications = [];
      let alertCounter = 90001;

      for (const [dateStr, dayData] of Object.entries(shifts)) {
        if (!dayData) continue;
        const [year, month, day] = dateStr.split('-').map(Number);
        if (!year || !month || !day) continue;

        const hasMorning =
          dayData.M1?.vrijcheckActive ||
          dayData.M2?.vrijcheckActive ||
          dayData.M3?.vrijcheckActive ||
          dayData.M4?.vrijcheckActive;
        if (hasMorning) {
          const alertDate = new Date(year, month - 1, day - 1, 17, 9, 0, 0);
          if (alertDate.getTime() > now.getTime()) {
            scheduledNotifications.push({
              id: alertCounter++,
              title: '⚡ Luisteren gestart',
              body: `Luisteren gestart: Bot staat scherp voor het vrijcheck-bericht om 17:10 (${channel}).`,
              channelId: this.CHANNEL_ID,
              schedule: { at: alertDate },
              smallIcon: 'ic_launcher',
              iconColor: '#3171f7'
            });
          }
        }

        const hasAfternoon =
          dayData.S1?.vrijcheckActive ||
          dayData.S2?.vrijcheckActive ||
          dayData.S3?.vrijcheckActive ||
          dayData.S4?.vrijcheckActive;
        if (hasAfternoon) {
          const alertDate = new Date(year, month - 1, day, 10, 9, 0, 0);
          if (alertDate.getTime() > now.getTime()) {
            scheduledNotifications.push({
              id: alertCounter++,
              title: '⚡ Luisteren gestart',
              body: `Luisteren gestart: Bot staat scherp voor het vrijcheck-bericht om 10:10 (${channel}).`,
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
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS] Fout bij vooruit-plannen van notificaties:', err);
    }
  }
}

export const notificationService = new NotificationService();
