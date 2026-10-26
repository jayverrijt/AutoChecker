import React, { useState, useEffect } from 'react';
import { Browser } from '@capacitor/browser';
import { registerPlugin, Capacitor } from '@capacitor/core';
import {
  User,
  Bell,
  SlidersHorizontal,
  Link2,
  Server,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Key,
  Calendar,
  MapPin,
  Zap,
  Volume2,
  LogIn,
  Activity
} from 'lucide-react';
import {
  slackService,
  DEFAULT_PROD_SERVER_URL,
  DEFAULT_EMOJI_MAPPING
} from '../services/slackService';
import { notificationService } from '../services/notificationService';
import { HubSelectorModal, getHubByCode } from './HubSelectorModal';
import { SlackEmoji } from './SlackEmoji';
import { sounds } from '../utils/audio';

const SlackAuth = registerPlugin('SlackAuth');

export const SettingsView = ({
  settings,
  onSaveSettings,
  botStatus,
  onTestConnection,
  onSyncIcal,
  onLogout
}) => {
  // null = main settings overview list; or 'profile' | 'notifications' | 'emoji' | 'technical' | 'server'
  const [activeSubPage, setActiveSubPage] = useState(null);
  const [showHubModal, setShowHubModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [formData, setFormData] = useState({
    firstName: 'Runner',
    displayName: '',
    personalEmail: '',
    hubCode: 'HLM',
    channelName: '#nl-dist-runners-hlm',
    channelId: 'CAM2MJTA9',
    icalUrl: '',
    workspaceUrl: 'https://picnic.enterprise.slack.com',
    slackToken: '',
    slackCookie: '',
    autoReact: true,
    notify1mBefore: true,
    notifyCompletion: true,
    soundEnabled: true,
    serverMode: 'DEFAULT',
    customServerHost: '',
    customServerPort: '3001',
    serverUrl: DEFAULT_PROD_SERVER_URL,
    serverToken: '',
    emojiMapping: { ...DEFAULT_EMOJI_MAPPING }
  });

  const [saveFeedback, setSaveFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingIcal, setIsSyncingIcal] = useState(false);
  const [icalFeedback, setIcalFeedback] = useState(null);
  const [isTestingSlack, setIsTestingSlack] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState(null);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [serverTestResult, setServerTestResult] = useState(null);

  useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        ...settings,
        serverMode: settings.serverMode || 'DEFAULT',
        customServerHost: settings.customServerHost || '',
        customServerPort: settings.customServerPort || '3001',
        emojiMapping: {
          ...DEFAULT_EMOJI_MAPPING,
          ...(settings.emojiMapping || {})
        }
      }));
    }
  }, [settings]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEmojiChange = (block, emoji) => {
    setFormData((prev) => ({
      ...prev,
      emojiMapping: {
        ...prev.emojiMapping,
        [block]: emoji
      }
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaveFeedback(null);

    if (formData.personalEmail && /@teampicnic\.com$/i.test(formData.personalEmail.trim())) {
      setSaveFeedback({
        ok: false,
        message: 'Gebruik je persoonlijke e-mailadres (géén @teampicnic.com adres).'
      });
      return;
    }

    setIsSaving(true);
    try {
      const hubInfo = getHubByCode(formData.hubCode);
      const payload = {
        ...formData,
        hubCode: hubInfo.code,
        channelName: hubInfo.channel
      };
      await onSaveSettings(payload);
      sounds.enabled = formData.soundEnabled;
      sounds.playSuccess();
      setSaveFeedback({
        ok: true,
        message: 'Wijzigingen succesvol opgeslagen in de database!'
      });
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err) {
      setSaveFeedback({
        ok: false,
        message: err.message || 'Kon instellingen niet opslaan.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerIcalSync = async () => {
    if (!formData.icalUrl || !formData.icalUrl.trim()) {
      setIcalFeedback({
        ok: false,
        message: 'Plak eerst je persoonlijke Teamwork iCal-link hierboven.'
      });
      return;
    }
    setIsSyncingIcal(true);
    setIcalFeedback(null);
    try {
      await onSaveSettings(formData);
      const res = await (onSyncIcal
        ? onSyncIcal(formData.icalUrl.trim())
        : slackService.syncIcalOnServer(formData.icalUrl.trim()));
      if (res?.ok) {
        sounds.playSuccess();
        setIcalFeedback({
          ok: true,
          message: `iCal gesynchroniseerd! ${res.syncedCount ?? 0} individuele shifts ingeladen in je rooster.`
        });
      } else {
        setIcalFeedback({
          ok: false,
          message: res?.error || 'Kon iCal niet synchroniseren.'
        });
      }
    } catch (err) {
      setIcalFeedback({
        ok: false,
        message: err.message
      });
    } finally {
      setIsSyncingIcal(false);
    }
  };

  const handleOpenSlackLogin = async () => {
    const url = formData.workspaceUrl || 'https://picnic.enterprise.slack.com';
    if (Capacitor.isNativePlatform()) {
      try {
        setIsTestingSlack(true);
        const res = await SlackAuth.login({ workspaceUrl: url });
        if (res && res.token) {
          const updated = {
            ...formData,
            slackToken: res.token,
            slackCookie: res.cookie || formData.slackCookie
          };
          setFormData(updated);
          await onSaveSettings(updated);
          sounds.playSuccess();
          const testRes = await onTestConnection(updated);
          setSlackTestResult(testRes);
        }
      } catch (err) {
        const msg = typeof err === 'string' ? err : err?.message;
        setSlackTestResult({ ok: false, error: msg || 'Inloggen geannuleerd.' });
      } finally {
        setIsTestingSlack(false);
      }
      return;
    }

    try {
      await Browser.open({ url });
    } catch (_) {
      window.open(url, '_blank');
    }
  };

  const handleTestSlack = async () => {
    setIsTestingSlack(true);
    setSlackTestResult(null);
    try {
      await onSaveSettings(formData);
      const res = await onTestConnection(formData);
      setSlackTestResult(res);
      if (res?.ok) sounds.playSuccess();
    } catch (err) {
      setSlackTestResult({ ok: false, error: err.message });
    } finally {
      setIsTestingSlack(false);
    }
  };

  const handleTestServer = async () => {
    setIsTestingServer(true);
    setServerTestResult(null);
    try {
      await onSaveSettings(formData);
      const activeUrl = slackService.getActiveServerUrl(formData);
      const res = await slackService.testServerConnection(activeUrl, formData.serverToken);
      setServerTestResult(res);
      if (res?.ok) sounds.playSuccess();
    } catch (err) {
      setServerTestResult({ ok: false, error: err.message });
    } finally {
      setIsTestingServer(false);
    }
  };

  const activeHubInfo = getHubByCode(formData.hubCode);
  const hasXoxc = Boolean(formData.slackToken && formData.slackToken.startsWith('xoxc-'));
  const hasXoxd = Boolean(formData.slackCookie && formData.slackCookie.includes('xoxd-'));

  return (
    <div className="p-4 space-y-4 pb-28 overflow-y-auto select-none animate-fadeIn">
      {/* Subpage Back Bar */}
      {activeSubPage && (
        <button
          type="button"
          onClick={() => {
            setActiveSubPage(null);
            setSaveFeedback(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Terug naar Instellingen overzicht</span>
        </button>
      )}

      {/* Global Save Feedback Banner */}
      {saveFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            saveFeedback.ok
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          {saveFeedback.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{saveFeedback.message}</span>
        </div>
      )}

      {/* MAIN OVERVIEW MENU (When activeSubPage === null) */}
      {!activeSubPage && (
        <div className="space-y-2.5">
          {/* 1. Mijn gegevens */}
          <button
            type="button"
            onClick={() => setActiveSubPage('profile')}
            className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Mijn gegevens</div>
                <div className="text-[11px] text-neutral-400 truncate">
                  Voornaam ({formData.firstName}), persoonlijk e-mailadres &amp; Hub ({formData.hubCode})
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* 2. Notificaties & Alerts */}
          <button
            type="button"
            onClick={() => setActiveSubPage('notifications')}
            className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Notificaties &amp; Alerts</div>
                <div className="text-[11px] text-neutral-400 truncate">
                  1-minuut voor-alert (10:09 / 17:09), completion alert &amp; testknop
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* 3. Instellingen & Emoji Mapping */}
          <button
            type="button"
            onClick={() => setActiveSubPage('emoji')}
            className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Instellingen &amp; Emoji Mapping</div>
                <div className="text-[11px] text-neutral-400 truncate">
                  Emoji-reacties (:1-red: t/m :4-red:) voor M1-M4 &amp; S1-S4
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* 4. Technische Gegevens & Koppelingen */}
          <button
            type="button"
            onClick={() => setActiveSubPage('technical')}
            className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Technische Gegevens &amp; Koppelingen</div>
                <div className="text-[11px] text-neutral-400 truncate">
                  Teamwork iCal-link synchronisatie &amp; Slack Session Tokens
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* 5. 24/7 VPS Cloud Daemon (Server Selectie) */}
          <button
            type="button"
            onClick={() => setActiveSubPage('server')}
            className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">24/7 VPS Cloud Daemon</div>
                <div className="text-[11px] text-neutral-400 truncate">
                  Server Selectie: {formData.serverMode === 'OTHER' ? 'OTHER (Eigen Server)' : 'DEFAULT (Productie VPS)'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* 6. Uitloggen / Sessie Vergeten */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full bg-[#181922] hover:bg-red-950/20 border border-[#272938] hover:border-red-500/30 rounded-2xl p-4 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-red-400">Uitloggen / Sessie Vergeten</div>
                  <div className="text-[11px] text-neutral-400 truncate">
                    Wist alle Slack &amp; Keycloak SSO cookies uit de native WebView
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-red-400 shrink-0 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* SUBPAGE 1: MIJN GEGEVENS (STRICTLY NO ICAL LINKS & NO SLACK TOKENS/COOKIES!) */}
      {activeSubPage === 'profile' && (
        <form onSubmit={handleSave} className="bg-[#181922] border border-[#272938] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#242736] pb-3">
            <User className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Mijn gegevens</h3>
              <p className="text-[11px] text-neutral-400">Beheer je voornaam, persoonlijk e-mailadres en Hub</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">Voornaam</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="Bijv. Jay"
              className="w-full bg-[#111218] border border-[#2b2e3e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Persoonlijk e-mailadres <span className="text-neutral-500">(géén @teampicnic.com)</span>
            </label>
            <input
              type="email"
              value={formData.personalEmail || ''}
              onChange={(e) => handleChange('personalEmail', e.target.value)}
              placeholder="jouwnaam@gmail.com"
              className="w-full bg-[#111218] border border-[#2b2e3e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">Gekoppelde Picnic Hub</label>
            <button
              type="button"
              onClick={() => setShowHubModal(true)}
              className="w-full bg-[#111218] hover:bg-[#161822] border border-[#2b2e3e] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-white"
            >
              <span className="flex items-center gap-2 font-semibold">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>
                  {activeHubInfo.name} ({activeHubInfo.code})
                </span>
              </span>
              <span className="text-blue-400 font-bold">Wijzig Hub</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-[#3171f7] hover:bg-[#255fd4] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Opslaan...' : 'Gegevens Opslaan'}</span>
          </button>
        </form>
      )}

      {/* SUBPAGE 2: NOTIFICATIES & ALERTS */}
      {activeSubPage === 'notifications' && (
        <div className="bg-[#181922] border border-[#272938] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#242736] pb-3">
            <Bell className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Notificaties &amp; Alerts</h3>
              <p className="text-[11px] text-neutral-400">Meldingen om 10:09 / 17:09 en direct na vrijcheck</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#111218] border border-[#252836] cursor-pointer">
              <div className="pr-3">
                <div className="text-xs font-bold text-white">1-Minuut Vooraf Alert (10:09 &amp; 17:09)</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  &ldquo;Luisteren gestart: Bot staat scherp voor het vrijcheck-bericht om 10:10 / 17:10.&rdquo;
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.notify1mBefore !== false}
                onChange={(e) => handleChange('notify1mBefore', e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-[#111218] border border-[#252836] cursor-pointer">
              <div className="pr-3">
                <div className="text-xs font-bold text-white">Directe Bevestiging na Reactie</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  &ldquo;Reactie succesvol geplaatst! Kijk nu op Slack om te zien of je vrij hebt gekregen.&rdquo;
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.notifyCompletion !== false}
                onChange={(e) => handleChange('notifyCompletion', e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
            </label>
          </div>

          <div className="pt-2 space-y-2">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Test Notificaties op dit toestel:
            </div>
            <button
              type="button"
              onClick={() => notificationService.notifyListeningStarted({ target: '10:10 / 17:10' })}
              className="w-full py-2.5 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold text-xs flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Test 1-minuut voor-alert</span>
              </span>
              <span className="text-[10px] bg-amber-500/30 px-2 py-0.5 rounded font-mono">Test</span>
            </button>

            <button
              type="button"
              onClick={() => notificationService.notifyVrijcheckCompleted({ success: true })}
              className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 font-semibold text-xs flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Test bevestigingsnotificatie</span>
              </span>
              <span className="text-[10px] bg-emerald-500/30 px-2 py-0.5 rounded font-mono">Test</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-[#3171f7] hover:bg-[#255fd4] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Opslaan...' : 'Notificatie-voorkeuren Opslaan'}</span>
          </button>
        </div>
      )}

      {/* SUBPAGE 3: INSTELLINGEN & EMOJI MAPPING */}
      {activeSubPage === 'emoji' && (
        <form onSubmit={handleSave} className="bg-[#181922] border border-[#272938] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#242736] pb-3">
            <SlidersHorizontal className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Instellingen &amp; Emoji Mapping</h3>
              <p className="text-[11px] text-neutral-400">
                Koppel shift-blokken (M1-M4, S1-S4) aan :1-red: t/m :4-red:
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'].map((block) => {
              const currentEmoji = formData.emojiMapping?.[block] || '1-red';
              return (
                <div
                  key={block}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#111218] border border-[#252836]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-md bg-[#252834] text-white font-bold text-xs">
                      {block}
                    </span>
                    <span className="text-xs text-neutral-300">
                      {block.startsWith('M') ? 'Ochtend' : 'Middag/Avond'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {['1-red', '2-red', '3-red', '4-red'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => handleEmojiChange(block, em)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                          currentEmoji === em
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-[#1b1d28] text-neutral-400 hover:text-white'
                        }`}
                      >
                        <SlackEmoji name={em} size="xs" />
                        <span>{em.charAt(0)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#111218] border border-[#252836] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Automatisch reageren op Slack</span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoReact !== false}
                onChange={(e) => handleChange('autoReact', e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-[#111218] border border-[#252836] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">Geluidseffecten bij vrijcheck</span>
              </div>
              <input
                type="checkbox"
                checked={formData.soundEnabled !== false}
                onChange={(e) => handleChange('soundEnabled', e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-[#3171f7] hover:bg-[#255fd4] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Opslaan...' : 'Voorkeuren Opslaan'}</span>
          </button>
        </form>
      )}

      {/* SUBPAGE 4: TECHNISCHE GEGEVENS & KOPPELINGEN (iCal Link + Slack Tokens) */}
      {activeSubPage === 'technical' && (
        <div className="space-y-4">
          {/* Card A: Teamwork iCal-link Koppeling */}
          <div className="bg-[#181922] border border-[#272938] rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center gap-2.5 border-b border-[#242736] pb-3">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Teamwork iCal-link Koppeling</h3>
                <p className="text-[11px] text-neutral-400">
                  Synchroniseert en ontkoppelt automatisch gecombineerde shifts (bijv. S1-S2-S3)
                </p>
              </div>
            </div>

            {/* Step-by-step instructions from Section 3 */}
            <div className="bg-[#111218] border border-[#242736] rounded-xl p-3 space-y-1.5 text-xs text-neutral-300">
              <div className="font-bold text-white text-[11px] uppercase tracking-wider text-blue-400">
                Zo vind je jouw Teamwork iCal-link:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-300 leading-relaxed">
                <li>
                  Open de officiële <strong>Teamwork</strong> app en ga naar <strong>Menu</strong>.
                </li>
                <li>
                  Tik rechtsboven op <strong>Instellingen (⚙️)</strong>.
                </li>
                <li>
                  Kies <strong>Rooster met je agenda verbinden</strong>.
                </li>
                <li>
                  Kopieer de link (<code className="text-blue-300">https://people-planning-proxy-prod.nl.picnic...</code>) en plak deze hieronder.
                </li>
              </ol>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Jouw Teamwork iCal-link
              </label>
              <input
                type="url"
                value={formData.icalUrl || ''}
                onChange={(e) => handleChange('icalUrl', e.target.value)}
                placeholder="https://people-planning-proxy-prod.nl.picnic..."
                className="w-full bg-[#111218] border border-[#2b2e3e] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-blue-500 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleTriggerIcalSync}
              disabled={isSyncingIcal}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingIcal ? 'animate-spin' : ''}`} />
              <span>{isSyncingIcal ? 'Rooster synchroniseren...' : 'Synchroniseer iCal Nu'}</span>
            </button>

            {icalFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  icalFeedback.ok
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/50 border-red-500/40 text-red-200'
                }`}
              >
                {icalFeedback.message}
              </div>
            )}
          </div>

          {/* Card B: Slack Session Tokens */}
          <div className="bg-[#181922] border border-[#272938] rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#242736] pb-3">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Slack Session Tokens</h3>
                  <p className="text-[11px] text-neutral-400">Status en beheer van xoxc-token &amp; xoxd-cookie</p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  hasXoxc && hasXoxd
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {hasXoxc && hasXoxd ? 'Gekoppeld' : 'Incompleet'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#111218] border border-[#242736]">
                <div className="text-[10px] text-neutral-400 uppercase font-bold">Client Token (xoxc)</div>
                <div className="text-xs font-mono font-bold text-white mt-0.5 truncate">
                  {formData.slackToken ? `${formData.slackToken.slice(0, 14)}...` : 'Ontbreekt'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#111218] border border-[#242736]">
                <div className="text-[10px] text-neutral-400 uppercase font-bold">Cookie d (xoxd)</div>
                <div className="text-xs font-mono font-bold text-white mt-0.5 truncate">
                  {formData.slackCookie ? `${formData.slackCookie.slice(0, 14)}...` : 'Ontbreekt'}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Client Token (xoxc-...)</label>
              <input
                type="password"
                value={formData.slackToken || ''}
                onChange={(e) => handleChange('slackToken', e.target.value.trim())}
                placeholder="xoxc-..."
                className="w-full bg-[#111218] border border-[#2b2e3e] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Session Cookie d (xoxd-...)</label>
              <input
                type="password"
                value={formData.slackCookie || ''}
                onChange={(e) => handleChange('slackCookie', e.target.value.trim())}
                placeholder="xoxd-..."
                className="w-full bg-[#111218] border border-[#2b2e3e] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenSlackLogin}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Inloggen via SSO</span>
              </button>

              <button
                type="button"
                onClick={handleTestSlack}
                disabled={isTestingSlack}
                className="py-2.5 px-3 rounded-xl bg-[#252836] hover:bg-[#2f3344] text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSlack ? 'animate-spin' : ''}`} />
                <span>Test Slack</span>
              </button>
            </div>

            {slackTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  slackTestResult.ok
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/50 border-red-500/40 text-red-200'
                }`}
              >
                {slackTestResult.ok
                  ? `Verbonden met Slack als ${slackTestResult.auth?.user || 'Runner'}!`
                  : slackTestResult.error || 'Slack authenticatie mislukt.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBPAGE 5: 24/7 VPS CLOUD DAEMON (DEFAULT vs OTHER) */}
      {activeSubPage === 'server' && (
        <form onSubmit={handleSave} className="bg-[#181922] border border-[#272938] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#242736] pb-3">
            <Server className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">24/7 VPS Cloud Daemon</h3>
              <p className="text-[11px] text-neutral-400">Schakel tussen de centrale productie-VPS of een eigen server</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleChange('serverMode', 'DEFAULT')}
              className={`p-3 rounded-xl border text-left transition-all ${
                formData.serverMode !== 'OTHER'
                  ? 'bg-blue-600/20 border-blue-500 text-white'
                  : 'bg-[#111218] border-[#252836] text-neutral-400'
              }`}
            >
              <div className="text-xs font-bold">DEFAULT</div>
              <div className="text-[10px] opacity-80 mt-0.5 font-mono">82.165.110.152:3001</div>
            </button>

            <button
              type="button"
              onClick={() => handleChange('serverMode', 'OTHER')}
              className={`p-3 rounded-xl border text-left transition-all ${
                formData.serverMode === 'OTHER'
                  ? 'bg-blue-600/20 border-blue-500 text-white'
                  : 'bg-[#111218] border-[#252836] text-neutral-400'
              }`}
            >
              <div className="text-xs font-bold">OTHER</div>
              <div className="text-[10px] opacity-80 mt-0.5">Eigen IP / Hostname</div>
            </button>
          </div>

          {formData.serverMode === 'OTHER' ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    IP-adres of Hostname
                  </label>
                  <input
                    type="text"
                    value={formData.customServerHost || ''}
                    onChange={(e) => handleChange('customServerHost', e.target.value)}
                    placeholder="bijv. 192.168.1.50 of bot.domein.nl"
                    className="w-full bg-[#111218] border border-[#2b2e3e] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Poort</label>
                  <input
                    type="text"
                    value={formData.customServerPort || '3001'}
                    onChange={(e) => handleChange('customServerPort', e.target.value)}
                    placeholder="3001"
                    className="w-full bg-[#111218] border border-[#2b2e3e] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Server API Key (Optioneel)
                </label>
                <input
                  type="password"
                  value={formData.serverToken || ''}
                  onChange={(e) => handleChange('serverToken', e.target.value)}
                  placeholder="vc_prod_..."
                  className="w-full bg-[#111218] border border-[#2b2e3e] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-[#111218] border border-[#242736] text-xs text-neutral-300">
              Verbonden met de centrale productie-VPS op{' '}
              <code className="text-blue-300 font-mono">http://82.165.110.152:3001</code>.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleTestServer}
              disabled={isTestingServer}
              className="py-2.5 px-3 rounded-xl bg-[#252836] hover:bg-[#2f3344] text-white font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isTestingServer ? 'animate-spin' : ''}`} />
              <span>Test Verbinding</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="py-2.5 px-3 rounded-xl bg-[#3171f7] hover:bg-[#255fd4] text-white font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Opslaan</span>
            </button>
          </div>

          {serverTestResult && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                serverTestResult.ok
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/50 border-red-500/40 text-red-200'
              }`}
            >
              {serverTestResult.ok ? serverTestResult.message : serverTestResult.error}
            </div>
          )}
        </form>
      )}

      {/* Hub Selector Modal */}
      <HubSelectorModal
        isOpen={showHubModal}
        onClose={() => setShowHubModal(false)}
        currentChannelName={formData.channelName}
        currentHubCode={formData.hubCode}
        detectedChannels={botStatus?.authInfo?.runnerChannels || []}
        onSelectHub={(newCode, newChan) => {
          setFormData((prev) => ({
            ...prev,
            hubCode: newCode,
            channelName: newChan
          }));
        }}
      />

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-xs bg-[#161722] border border-[#2b2e40] rounded-2xl p-5 space-y-4 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Sessie Vergeten &amp; Uitloggen?</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Alle Slack en Keycloak SSO cookies worden gewist uit de native WebView.
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#222432] text-neutral-300 font-semibold text-xs"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout?.();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs"
              >
                Uitloggen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
