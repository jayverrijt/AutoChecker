import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { appStorage } from './utils/storage';
import {
  addDays,
  startOfWeek,
  format,
  getISOWeek,
  subWeeks,
  addWeeks
} from 'date-fns';
import { Header } from './components/Header';
import { ScheduleView } from './components/ScheduleView';
import { HomeView } from './components/HomeView';
import { MenuView } from './components/MenuView';
import { LoginView } from './components/LoginView';
import { ShiftModal } from './components/ShiftModal';
import { DatePickerModal } from './components/DatePickerModal';
import { SettingsView } from './components/SettingsView';
import { BottomNav } from './components/BottomNav';
import { SlackEmoji } from './components/SlackEmoji';
import { sounds } from './utils/audio';
import { Smartphone, Monitor, CheckCircle2, Zap, ChevronLeft, AlertTriangle } from 'lucide-react';
import { slackService, DEFAULT_PROD_SERVER_URL, DEFAULT_PROD_SERVER_TOKEN } from './services/slackService';
import { notificationService } from './services/notificationService';
import { getShiftForBlock, saveShiftBlock, toggleVrijcheckForBlock } from './utils/shiftHelpers';
import { APP_VERSION } from './utils/constants';

export function App() {
  const [socket, setSocket] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule'); // 'home' | 'schedule' | 'menu' | 'settings'

  // Authentication gate state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Global Blocking Version Check state (Section 4)
  const [versionBlockInfo, setVersionBlockInfo] = useState({
    updateRequired: false,
    currentVersion: APP_VERSION,
    latestFrontendVersion: APP_VERSION
  });

  const initialDate = new Date();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const [shifts, setShifts] = useState({});
  const [vrijcheckRequests, setVrijcheckRequests] = useState([]);
  const [settings, setSettings] = useState(null);
  const [botStatus, setBotStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(initialDate);
  const [modalCurrentShift, setModalCurrentShift] = useState(null);
  const [modalShiftIndex, setModalShiftIndex] = useState(0);

  const [toast, setToast] = useState(null);
  const [hasUnreadReaction, setHasUnreadReaction] = useState(false);
  const [isDeviceFrame, setIsDeviceFrame] = useState(true);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [vpsStatus, setVpsStatus] = useState({
    isConnected: false,
    pingMs: null,
    botStatus: null,
    error: null
  });

  const isVpsOnline = isServerConnected || Boolean(vpsStatus?.isConnected);

  // Global Version Check (on startup & periodically)
  useEffect(() => {
    const runVersionCheck = async () => {
      const info = await slackService.checkFrontendUpdateRequired(settings);
      if (info.updateRequired) {
        setVersionBlockInfo(info);
      }
    };
    runVersionCheck();
    const interval = setInterval(runVersionCheck, 60000);
    return () => clearInterval(interval);
  }, [settings?.serverMode]);

  const refreshVpsStatus = async () => {
    const currentSettings = settings || slackService.getSettings();
    const serverUrl = slackService.getActiveServerUrl(currentSettings);
    const serverToken = currentSettings?.serverToken || DEFAULT_PROD_SERVER_TOKEN;
    const res = await slackService.fetchServerStatus(serverUrl, serverToken);
    if (res.ok) {
      setVpsStatus({
        isConnected: true,
        pingMs: res.pingMs,
        botStatus: res.botStatus,
        error: null
      });
      setIsServerConnected(true);
      if (res.botStatus) {
        setBotStatus(res.botStatus);
      }
    } else {
      setVpsStatus({
        isConnected: false,
        pingMs: null,
        botStatus: null,
        error: res.error
      });
      setIsServerConnected(false);
    }
  };

  useEffect(() => {
    refreshVpsStatus();
    const interval = setInterval(refreshVpsStatus, 12000);
    return () => clearInterval(interval);
  }, [settings?.serverUrl, settings?.serverMode, settings?.customServerHost, settings?.serverToken]);

  useEffect(() => {
    notificationService.init();
    if (Capacitor.isNativePlatform()) {
      try {
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.setBackgroundColor({ color: '#0e0f12' });
        StatusBar.show();
      } catch (err) {
        console.warn('Could not configure status bar', err);
      }
    }
  }, []);

  useEffect(() => {
    if (shifts && Object.keys(shifts).length > 0 && settings?.notify1mBefore !== false) {
      notificationService.scheduleAdvanceShiftAlerts(shifts, settings?.channelName || '#nl-dist-runners-hlm');
    }
  }, [shifts, settings?.channelName, settings?.notify1mBefore]);

  // Manage Android Hardware / Gesture Back Button
  const isModalOpenRef = useRef(isModalOpen);
  const isDatePickerOpenRef = useRef(isDatePickerOpen);
  const activeTabRef = useRef(activeTab);
  const lastBackTimeRef = useRef(0);

  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  useEffect(() => {
    isDatePickerOpenRef.current = isDatePickerOpen;
  }, [isDatePickerOpen]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    let listenerHandle = null;

    const setupBackHandler = async () => {
      try {
        listenerHandle = await CapApp.addListener('backButton', () => {
          const now = Date.now();
          if (now - lastBackTimeRef.current < 350) return;
          lastBackTimeRef.current = now;

          if (isDatePickerOpenRef.current) {
            setIsDatePickerOpen(false);
            return;
          }

          if (isModalOpenRef.current) {
            setIsModalOpen(false);
            return;
          }

          if (activeTabRef.current === 'settings') {
            setActiveTab('menu');
            return;
          }

          if (activeTabRef.current === 'menu' || activeTabRef.current === 'home') {
            setActiveTab('schedule');
            return;
          }

          CapApp.exitApp();
        });
      } catch (_) {}
    };

    setupBackHandler();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);

  const startVrijcheckPoller = () => {
    slackService.startPolling((event) => {
      if (event.reactionSuccess) {
        sounds.playSuccess();
        setToast({
          type: 'success',
          title: 'Reactie succesvol geplaatst!',
          message: 'Kijk nu op Slack om te zien of je vrij hebt gekregen.',
          emoji: event.emoji
        });
        setHasUnreadReaction(true);
        setShifts(slackService.getShifts());
        setTimeout(() => setToast(null), 5000);
      }
    });
  };

  // Initialize Authentication & Hydrate from MySQL Server (Single Source of Truth)
  useEffect(() => {
    let isMounted = true;

    const initAuthAndServices = async () => {
      setIsAuthChecking(true);
      await appStorage.init();
      const initialShifts = slackService.getShifts();
      const initialSettings = slackService.getSettings();
      setShifts(initialShifts);
      setSettings(initialSettings);
      if (initialSettings.soundEnabled !== undefined) {
        sounds.enabled = initialSettings.soundEnabled;
      }

      const token = initialSettings?.slackToken?.trim();

      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsAuthChecking(false);
        }
        return;
      }

      try {
        const res = await slackService.testConnection(initialSettings);
        if (!isMounted) return;

        if (res?.ok && res?.auth) {
          setBotStatus({
            status: 'connected',
            authInfo: res.auth,
            channelName: initialSettings.channelName,
            channelId: initialSettings.channelId
          });
          if (res.recentMessages && res.recentMessages.length > 0) {
            setRecentMessages(res.recentMessages);
          }
          setIsAuthenticated(true);
          setAuthError(null);

          if (slackService.isTestingMode()) {
            startVrijcheckPoller();
          }
        } else {
          setIsAuthenticated(false);
          setAuthError('Je Picnic Slack sessie is verlopen. Log opnieuw in om door te gaan.');
        }
      } catch (err) {
        if (isMounted) {
          if (token) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            setAuthError('Geen geldige sessie gevonden.');
          }
        }
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    };

    initAuthAndServices();

    const unsub = slackService.onStatusChange((st) => {
      if (st?.authInfo) {
        setBotStatus((prev) => ({ ...prev, ...st }));
      }
    });

    return () => {
      isMounted = false;
      unsub();
      slackService.stopPolling();
    };
  }, []);

  // Connect to Socket.io backend & pull Single Source of Truth from MySQL
  useEffect(() => {
    let s = null;
    const currentSettings = settings || slackService.getSettings();
    const serverUrl = slackService.getActiveServerUrl(currentSettings);
    const serverToken = (currentSettings?.serverToken || '').trim() || DEFAULT_PROD_SERVER_TOKEN;

    try {
      s = io(serverUrl, {
        transports: ['websocket', 'polling'],
        auth: {
          token: serverToken,
          userId: slackService.getUserId()
        },
        timeout: 4000
      });

      s.on('connect', () => {
        setIsServerConnected(true);
      });

      s.on('disconnect', () => {
        setIsServerConnected(false);
      });

      s.on('connect_error', () => {
        setIsServerConnected(false);
      });

      s.on('shifts:updated', (data) => {
        if (data && typeof data === 'object' && !data.error) {
          setShifts(data);
          slackService.saveShiftsLocalOnly(data);
        }
      });

      s.on('vrijcheck_requests:updated', (data) => {
        if (Array.isArray(data)) {
          setVrijcheckRequests(data);
          appStorage.setItem('vrijcheck_requests', JSON.stringify(data));
        }
      });

      s.on('settings:updated', (data) => {
        if (data && !data.error) {
          setSettings(data);
          appStorage.setItem('vrijcheck_settings', JSON.stringify(data));
          if (data.soundEnabled !== undefined) {
            sounds.enabled = data.soundEnabled;
          }
        }
      });

      s.on('bot:status', (data) => {
        setBotStatus(data);
      });

      s.on('bot:recent_messages', (data) => {
        setRecentMessages(data);
      });

      s.on('history:updated', (data) => {
        setHistory(data);
      });

      // 1 Minute Before (10:09 & 17:09)
      s.on('bot:listening_started', (event) => {
        setToast({
          type: 'info',
          title: '⚡ Luisteren gestart',
          message:
            event.message ||
            'Luisteren gestart: Bot staat scherp voor het vrijcheck-bericht om 10:10 / 17:10.'
        });
        setTimeout(() => setToast(null), 6000);

        if (currentSettings?.notify1mBefore !== false) {
          notificationService.notifyListeningStarted({
            target: event.target || '10:10 / 17:10'
          });
        }
      });

      // Directly after reaction
      s.on('bot:vrijcheck_completed', (event) => {
        if (event.reactionSuccess) {
          sounds.playSuccess();
          setToast({
            type: 'success',
            title: 'Reactie succesvol geplaatst!',
            message: 'Reactie succesvol geplaatst! Kijk nu op Slack om te zien of je vrij hebt gekregen.',
            emoji: event.emoji
          });
          setTimeout(() => setToast(null), 6000);

          if (currentSettings?.notifyCompletion !== false) {
            notificationService.notifyVrijcheckCompleted({
              success: true,
              emoji: event.emoji
            });
          }
        } else {
          setToast({
            type: 'error',
            title: '⚠️ Vrijcheck Mislukt',
            message: event.message || 'Technische fout bij het plaatsen van de reactie.'
          });
          setTimeout(() => setToast(null), 6000);

          if (currentSettings?.notifyCompletion !== false) {
            notificationService.notifyVrijcheckCompleted({
              success: false,
              error: event.error
            });
          }
        }
      });

      setSocket(s);

      const authHeaders = {
        'x-api-key': serverToken,
        'x-user-id': slackService.getUserId()
      };

      // Bugfix #1: Fetch Single Source of Truth directly from MySQL server without overwriting with stale local state!
      fetch(`${serverUrl}/api/shifts`, { headers: authHeaders })
        .then((r) => r.json())
        .then((data) => {
          if (data && typeof data === 'object' && !data.error) {
            setShifts(data);
            slackService.saveShiftsLocalOnly(data);
          }
        })
        .catch(() => {});

      fetch(`${serverUrl}/api/vrijcheck-requests`, { headers: authHeaders })
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok && Array.isArray(data.requests)) {
            setVrijcheckRequests(data.requests);
            appStorage.setItem('vrijcheck_requests', JSON.stringify(data.requests));
          }
        })
        .catch(() => {});

      fetch(`${serverUrl}/api/settings`, { headers: authHeaders })
        .then((r) => r.json())
        .then((data) => {
          if (data && !data.error) {
            setSettings((prev) => ({ ...(prev || {}), ...data }));
            if (data.soundEnabled !== undefined) sounds.enabled = data.soundEnabled;
          }
        })
        .catch(() => {});

      fetch(`${serverUrl}/api/status`, { headers: authHeaders })
        .then((r) => r.json())
        .then(setBotStatus)
        .catch(() => {});
    } catch (e) {
      setIsServerConnected(false);
    }

    return () => {
      if (s) {
        s.disconnect();
      }
    };
  }, [settings?.serverUrl, settings?.serverMode, settings?.customServerHost, settings?.serverToken, isAuthenticated]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const weekNumber = getISOWeek(currentDate);

  const handlePrevWeek = () => {
    setCurrentDate((prev) => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentDate((prev) => addWeeks(prev, 1));
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    try {
      navigator.vibrate?.(15);
    } catch (_) {}
    sounds.playPop?.();
    setTimeout(() => {
      const todayKey = format(today, 'yyyy-MM-dd');
      const el = document.getElementById(`day-${todayKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  const handleSelectDateFromPicker = (date) => {
    setCurrentDate(date);
    setSelectedDate(date);
    setIsDatePickerOpen(false);
    setTimeout(() => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const el = document.getElementById(`day-${dateKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  const handleRefreshAll = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      navigator.vibrate?.(15);
    } catch (_) {}
    sounds.playPop?.();

    try {
      const currentSettings = settings || slackService.getSettings();
      if (currentSettings?.icalUrl) {
        const syncRes = await slackService.syncIcalOnServer(currentSettings.icalUrl);
        if (syncRes?.ok && syncRes.shifts) {
          setShifts(syncRes.shifts);
        }
      }

      const requests = await slackService.fetchVrijcheckRequests();
      setVrijcheckRequests(requests);

      setToast({
        type: 'success',
        title: 'Rooster Ververst!',
        message: 'Teamwork iCal en vrijcheck-statussen zijn bijgewerkt uit de database.'
      });
      setTimeout(() => setToast(null), 3000);
    } catch (_) {
      setToast({
        type: 'info',
        title: 'Ververst',
        message: 'Gegevens opnieuw geladen.'
      });
      setTimeout(() => setToast(null), 2500);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleOpenShiftModal = (date, shift = null, blockId = 'M2') => {
    setModalDate(date);
    const dateKey = format(date, 'yyyy-MM-dd');
    const targetShift = shift || getShiftForBlock(shifts, dateKey, blockId);
    setModalCurrentShift(targetShift);
    setModalShiftIndex(blockId);
    setIsModalOpen(true);
  };

  const handleSaveShift = async (shiftData) => {
    const dateKey = format(modalDate, 'yyyy-MM-dd');
    const blockId = shiftData.block || modalShiftIndex || 'M2';
    const updated = saveShiftBlock(shifts, dateKey, blockId, shiftData);
    setShifts(updated);
    setModalCurrentShift(shiftData);
    slackService.saveShiftsLocalOnly(updated);

    await slackService.setVrijcheckRequestOnServer({
      shiftDate: dateKey,
      shiftBlock: blockId,
      active: Boolean(shiftData.vrijcheckActive),
      startTime: shiftData.startTime,
      endTime: shiftData.endTime,
      hubCode: settings?.hubCode || 'HLM'
    });
  };

  const handleQuickToggleVrijcheck = async (dateKey, blockId) => {
    const updated = toggleVrijcheckForBlock(shifts, dateKey, blockId);
    setShifts(updated);
    slackService.saveShiftsLocalOnly(updated);

    const toggledShift = updated[dateKey]?.[blockId];
    const nextActive = Boolean(toggledShift?.vrijcheckActive);

    const res = await slackService.setVrijcheckRequestOnServer({
      shiftDate: dateKey,
      shiftBlock: blockId,
      active: nextActive,
      startTime: toggledShift?.startTime,
      endTime: toggledShift?.endTime,
      hubCode: settings?.hubCode || 'HLM'
    });

    if (res?.ok) {
      if (res.shifts) setShifts(res.shifts);
      if (res.requests) setVrijcheckRequests(res.requests);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    const merged = slackService.saveSettings(newSettings);
    setSettings(merged);

    const serverUrl = slackService.getActiveServerUrl(merged);
    const serverToken = merged?.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    try {
      const res = await fetch(`${serverUrl}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': slackService.getUserId()
        },
        body: JSON.stringify(merged)
      });
      const updated = await res.json();
      if (updated && !updated.error) setSettings(updated);
    } catch (_) {}
  };

  const handleSyncIcal = async (icalUrl) => {
    const res = await slackService.syncIcalOnServer(icalUrl);
    if (res?.ok && res.shifts) {
      setShifts(res.shifts);
    }
    return res;
  };

  const handleSelectHub = async (newHubCode, newChannelName) => {
    const updatedSettings = {
      ...(settings || slackService.getSettings()),
      hubCode: newHubCode,
      channelName: newChannelName
    };
    await handleSaveSettings(updatedSettings);
    try {
      navigator.vibrate?.(20);
    } catch (_) {}
    sounds.playPop?.();
    setToast({
      type: 'success',
      title: `Hub Gewijzigd: ${newHubCode}`,
      message: `Actief Slack kanaal is nu ${newChannelName}`
    });
    setTimeout(() => setToast(null), 3500);
  };

  const handleTestConnection = async (customSettings = null) => {
    const targetSettings = customSettings || settings || slackService.getSettings();
    const res = await slackService.testConnection(targetSettings);
    if (res?.ok && res?.auth) {
      setBotStatus((prev) => ({
        ...prev,
        status: 'connected',
        authInfo: res.auth,
        channelName: targetSettings.channelName,
        channelId: targetSettings.channelId
      }));
      if (res.recentMessages && res.recentMessages.length > 0) {
        setRecentMessages(res.recentMessages);
      }
    }
    return res;
  };

  const handleTestRealReaction = async (emoji = '3-red') => {
    const currentSettings = settings || slackService.getSettings();
    const channelId = currentSettings?.channelId || 'CAM2MJTA9';
    const ts = recentMessages?.[0]?.ts || '1792224619.377119';
    try {
      const res = await slackService.addReaction(channelId, ts, emoji, currentSettings);
      if (res?.ok || res?.error === 'already_reacted') {
        sounds.playSuccess();
        setToast({
          type: 'success',
          title: 'Reactie succesvol geplaatst!',
          message: 'Reactie succesvol geplaatst! Kijk nu op Slack om te zien of je vrij hebt gekregen.',
          emoji
        });
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast({
          type: 'error',
          title: 'Reactie Mislukt',
          message: res?.error || 'Kon reactie niet plaatsen op Slack'
        });
        setTimeout(() => setToast(null), 4000);
      }
      return res;
    } catch (err) {
      setToast({
        type: 'error',
        title: 'Reactie Fout',
        message: err.message
      });
      setTimeout(() => setToast(null), 4000);
      return { ok: false, error: err.message };
    }
  };

  const handleLoginSuccess = async (newCredentials) => {
    const merged = slackService.saveSettings(newCredentials);
    setSettings(merged);
    setShifts(slackService.getShifts());
    setIsAuthenticated(true);
    setActiveTab('home');

    const reqs = await slackService.fetchVrijcheckRequests();
    setVrijcheckRequests(reqs);

    setToast({
      type: 'success',
      title: `Welkom, ${merged.firstName || 'Runner'}!`,
      message: 'Je account en Teamwork rooster zijn gekoppeld.'
    });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogout = async () => {
    slackService.stopPolling();
    const cleared = await slackService.logout();
    setSettings(cleared);
    setShifts({});
    setVrijcheckRequests([]);
    setBotStatus({
      status: 'disconnected',
      hasToken: false,
      hasCookie: false,
      channelName: '#nl-dist-runners-hlm'
    });
    setRecentMessages([]);
    setIsAuthenticated(false);
    setAuthError('Je bent uitgelogd en je Slack/Keycloak sessie is volledig gewist.');
  };

  // 0. Global Blocking Frontend Update Modal (Section 4)
  if (versionBlockInfo.updateRequired) {
    return (
      <div className="min-h-screen h-[100dvh] bg-[#0c0d11] text-white flex items-center justify-center p-6 select-none">
        <div className="w-full max-w-sm bg-[#161722] border border-red-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Update Vereist</h2>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Je gebruikt een verouderde versie van de Teamwork Vrijcheck app (v{versionBlockInfo.currentVersion}).
              Update de app naar versie <strong>v{versionBlockInfo.latestFrontendVersion}</strong> om door te gaan.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#101118] border border-[#242736] text-[11px] text-neutral-400 font-mono">
            Geïnstalleerd: v{versionBlockInfo.currentVersion} &bull; Vereist: v{versionBlockInfo.latestFrontendVersion}
          </div>
        </div>
      </div>
    );
  }

  // 1. Splash loader during initial session check
  if (isAuthChecking) {
    return (
      <div className="min-h-screen h-[100dvh] bg-[#0c0d11] text-white flex flex-col items-center justify-center space-y-4 select-none">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#e11d48] to-[#9f1239] flex items-center justify-center shadow-2xl shadow-red-500/30 animate-pulse border border-red-400/30">
          <Zap className="w-8 h-8 text-white fill-white" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold tracking-tight">Teamwork Vrijcheck</h2>
          <p className="text-xs text-neutral-400 mt-1">Sessie controleren...</p>
        </div>
      </div>
    );
  }

  // 2. Authentication Gate: Show Login & Setup Wizard
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} initialError={authError} />;
  }

  return (
    <div className="min-h-screen h-[100dvh] bg-[#0a0a0c] text-neutral-100 flex flex-col items-center justify-start md:justify-center p-0 md:p-6 select-none font-sans overflow-hidden">
      {/* Desktop Top Toolbar */}
      <div className="hidden md:flex items-center justify-between w-full max-w-md mb-3 px-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-semibold text-neutral-300">
            Teamwork Vrijcheck v{APP_VERSION}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#17181c] p-1 rounded-lg border border-[#272830]">
          <button
            onClick={() => setIsDeviceFrame(true)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-all ${
              isDeviceFrame ? 'bg-blue-600 text-white font-bold shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobiel</span>
          </button>
          <button
            onClick={() => setIsDeviceFrame(false)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-all ${
              !isDeviceFrame ? 'bg-blue-600 text-white font-bold shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Breed</span>
          </button>
        </div>
      </div>

      {/* Main Mobile Container */}
      <main
        className={`w-full bg-[#141416] transition-all relative flex flex-col overflow-hidden h-[100dvh] ${
          isDeviceFrame
            ? 'w-full md:max-w-[420px] md:h-[860px] md:rounded-[44px] md:border-[10px] md:border-[#2b2c34] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]'
            : 'w-full md:max-w-2xl md:min-h-[860px] md:rounded-3xl md:border md:border-[#2b2c34]'
        }`}
      >
        {isDeviceFrame && (
          <div className="hidden md:flex justify-center pt-3 pb-1 bg-[#141416] relative z-30">
            <div className="w-28 h-4.5 bg-black rounded-full flex items-center justify-between px-3">
              <div className="w-2 h-2 rounded-full bg-neutral-900 border border-neutral-700"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></div>
            </div>
          </div>
        )}

        {/* Global Toast Notification */}
        {toast && (
          <div className="absolute top-4 left-4 right-4 z-50 animate-bounce-subtle">
            <div
              className={`p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 ${
                toast.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-white'
                  : toast.type === 'error'
                  ? 'bg-red-950/90 border-red-500/50 text-white'
                  : 'bg-[#1f2129]/95 border-blue-500/40 text-white'
              }`}
            >
              {toast.emoji ? (
                <SlackEmoji name={toast.emoji} size="lg" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">{toast.title}</div>
                <div className="text-[11px] opacity-90 truncate">{toast.message}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Vrijchecken */}
        {activeTab === 'home' && (
          <div className="flex-1 overflow-y-auto pt-notch-safe">
            <HomeView
              onNavigate={(tab) => setActiveTab(tab)}
              botStatus={botStatus}
              vpsStatus={vpsStatus}
              onRefreshVps={refreshVpsStatus}
              shifts={shifts}
              vrijcheckRequests={vrijcheckRequests}
              history={history}
              currentDate={currentDate}
              onTestReaction={() => handleTestRealReaction('3-red')}
              settings={settings}
            />
          </div>
        )}

        {/* Tab 2: Planning / Rooster */}
        {activeTab === 'schedule' && (
          <>
            <Header
              currentDate={currentDate}
              onSelectDate={(newDate) => {
                setCurrentDate(newDate);
                setSelectedDate(newDate);
              }}
              onGoToToday={handleGoToToday}
              onOpenDatePicker={() => setIsDatePickerOpen(true)}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onRefresh={handleRefreshAll}
              isRefreshing={isRefreshing}
              weekNumber={weekNumber}
            />

            <div className="flex-1 overflow-y-auto">
              <ScheduleView
                days={weekDays}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                shifts={shifts}
                onOpenShiftModal={handleOpenShiftModal}
                onToggleVrijcheck={handleQuickToggleVrijcheck}
                onPrevWeek={handlePrevWeek}
                onNextWeek={handleNextWeek}
              />
            </div>
          </>
        )}

        {/* Tab 3: Menu */}
        {activeTab === 'menu' && (
          <div className="flex-1 overflow-y-auto pt-notch-safe">
            <MenuView
              onNavigate={(tab) => setActiveTab(tab)}
              onLogout={handleLogout}
              botStatus={botStatus}
              vpsStatus={vpsStatus}
              settings={settings}
              isServerConnected={isVpsOnline}
              onSelectHub={handleSelectHub}
              onTestRealReaction={handleTestRealReaction}
            />
          </div>
        )}

        {/* Settings Screen (Gear ⚙️ from Menu) */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto pt-notch-safe">
            <div className="px-4 py-2 border-b border-[#22242a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('menu')}
                  className="py-1.5 px-3 -ml-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1 text-xs font-bold active:scale-95 touch-manipulation cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                  <span>Menu</span>
                </button>
                <span className="text-neutral-600">|</span>
                <h2 className="text-sm font-bold text-white">Instellingen (⚙️)</h2>
              </div>
            </div>
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onTestConnection={handleTestConnection}
              onSyncIcal={handleSyncIcal}
              onLogout={handleLogout}
              botStatus={botStatus}
            />
          </div>
        )}

        <ShiftModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          date={modalDate}
          currentShift={modalCurrentShift}
          shiftIndex={modalShiftIndex}
          onSaveShift={handleSaveShift}
        />

        <DatePickerModal
          isOpen={isDatePickerOpen}
          onClose={() => setIsDatePickerOpen(false)}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDateFromPicker}
        />

        <BottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'home') setHasUnreadReaction(false);
          }}
          hasUnreadReaction={hasUnreadReaction}
        />
      </main>
    </div>
  );
}
