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
import { nl } from 'date-fns/locale';
import { Header } from './components/Header';
import { ScheduleView } from './components/ScheduleView';
import { HomeView } from './components/HomeView';
import { MenuView } from './components/MenuView';
import { LoginView } from './components/LoginView';
import { ShiftModal } from './components/ShiftModal';
import { DatePickerModal } from './components/DatePickerModal';
import { SlackLiveView } from './components/SlackLiveView';
import { SettingsView } from './components/SettingsView';
import { BottomNav } from './components/BottomNav';
import { SlackEmoji } from './components/SlackEmoji';
import { sounds } from './utils/audio';
import { Smartphone, Monitor, CheckCircle2, Zap, ChevronLeft } from 'lucide-react';
import { slackService, DEFAULT_PROD_SERVER_URL, DEFAULT_PROD_SERVER_TOKEN } from './services/slackService';
import { getShiftForBlock, saveShiftBlock, toggleVrijcheckForBlock } from './utils/shiftHelpers';

const SOCKET_URL = DEFAULT_PROD_SERVER_URL;


export function App() {
  const [socket, setSocket] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule'); // 'home' | 'schedule' | 'menu' | 'live' | 'settings'
  
  // Authentication gate state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Default to today / current week
  const initialDate = new Date();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const [shifts, setShifts] = useState({});
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

  // Date picker modal & Refresh state
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

  const refreshVpsStatus = async () => {
    const currentSettings = settings || slackService.getSettings();
    const serverUrl = currentSettings?.serverUrl || DEFAULT_PROD_SERVER_URL;
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
  }, [settings?.serverUrl, settings?.serverToken]);

  // Configure native Android status bar with dark background
  useEffect(() => {
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

          // 0. If DatePickerModal is open, close it!
          if (isDatePickerOpenRef.current) {
            setIsDatePickerOpen(false);
            return;
          }

          // 1. If ShiftModal is open, close the modal instead of exiting the app!
          if (isModalOpenRef.current) {
            setIsModalOpen(false);
            return;
          }

          // 2. If on Slack Live or Settings sub-tab, go back to Menu!
          if (activeTabRef.current === 'live' || activeTabRef.current === 'settings') {
            setActiveTab('menu');
            return;
          }

          // 3. If on Menu or Home tab, go back to Rooster tab!
          if (activeTabRef.current === 'menu' || activeTabRef.current === 'home') {
            setActiveTab('schedule');
            return;
          }

          // 4. Only if on the Schedule tab with no modal open, exit the app
          CapApp.exitApp();
        });
      } catch (err) {
        console.warn('Capacitor App backButton listener inactive in web mode', err);
      }
    };

    setupBackHandler();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);


  // Helper to start the local Vrijcheck background poller
  const startVrijcheckPoller = () => {
    slackService.startPolling((event) => {
      if (event.reactionSuccess) {
        sounds.playSuccess();

        setToast({
          type: 'success',
          title: '🎉 Vrijcheck Geslaagd!',
          message: `Gereageerd met :${event.emoji}: (${event.latencyMs || 0}ms)`,
          emoji: event.emoji
        });

        setHasUnreadReaction(true);
        setShifts(slackService.getShifts());
        setTimeout(() => setToast(null), 5000);
      }
    });
  };


  // Initialize Authentication & Standalone Services on launch
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

          // Only start local background poller if debugger/test mode is active
          if (slackService.isTestingMode()) {
            startVrijcheckPoller();
          }
        } else {
          // Token is revoked or session is expired
          setIsAuthenticated(false);
          setAuthError('Je Picnic Slack sessie is verlopen. Log opnieuw in om door te gaan.');
        }
      } catch (err) {
        console.warn('Auth check error:', err);
        if (isMounted) {
          if (token) {
            setIsAuthenticated(true);
            if (slackService.isTestingMode()) {
              startVrijcheckPoller();
            }
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

    // Listen to local status updates
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

  // Connect to Socket.io backend if running
  useEffect(() => {
    let s = null;
    const currentSettings = settings || slackService.getSettings();
    const serverUrl = (currentSettings?.serverUrl || '').trim() || DEFAULT_PROD_SERVER_URL;
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
        console.log('[SOCKET] Verbonden met 24/7 Vrijcheck backend:', serverUrl);
        setIsServerConnected(true);
      });

      s.on('disconnect', () => {
        console.log('[SOCKET] Verbinding met 24/7 server verbroken');
        setIsServerConnected(false);
      });

      s.on('connect_error', (err) => {
        console.warn('[SOCKET] Fout bij verbinden met server:', err.message);
        setIsServerConnected(false);
      });

      s.on('shifts:updated', (data) => {
        if (data && typeof data === 'object' && !data.error && Object.keys(data).length > 0) {
          setShifts(data);
          slackService.saveShifts(data);
        }
      });

      s.on('settings:updated', (data) => {
        setSettings(data);
        slackService.saveSettings(data);
        if (data.soundEnabled !== undefined) {
          sounds.enabled = data.soundEnabled;
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

      s.on('bot:reaction_event', (event) => {
        if (event.reactionSuccess) {
          sounds.playSuccess();

          setToast({
            type: 'success',
            title: '🎉 Vrijcheck Geslaagd!',
            message: `Gereageerd met :${event.emoji}: (${event.latencyMs || 0}ms)`,
            emoji: event.emoji
          });

          setHasUnreadReaction(true);
        } else if (event.status === 'period_mismatch' || event.status === 'no_shift') {
          setToast({
            type: 'info',
            title: 'Bericht Ontvangen',
            message: event.reason || 'Geen actie vereist voor deze shift.'
          });
        } else {
          setToast({
            type: 'error',
            title: 'Vrijcheck Mislukt',
            message: event.details || event.reason || 'Onbekende fout'
          });
        }

        setTimeout(() => setToast(null), 5000);
      });

      setSocket(s);

      const authHeaders = {
        'x-api-key': serverToken,
        'x-user-id': slackService.getUserId()
      };

      // Initial fetch with auth header
      fetch(`${serverUrl}/api/shifts`, { headers: authHeaders })
        .then((r) => r.json())
        .then((data) => {
          if (data && typeof data === 'object' && !data.error && Object.keys(data).length > 0) {
            setShifts(data);
            slackService.saveShifts(data);
          } else {
            // Server has no shifts recorded yet for this user: sync local shifts up to server!
            const local = slackService.getShifts();
            if (local && Object.keys(local).length > 0) {
              slackService.saveShifts(local);
            }
          }
        })
        .catch(() => {});

      fetch(`${serverUrl}/api/settings`, { headers: authHeaders })
        .then((r) => r.json())
        .then((data) => {
          setSettings(data);
          if (data.soundEnabled !== undefined) sounds.enabled = data.soundEnabled;
        })
        .catch(() => {});

      fetch(`${serverUrl}/api/status`, { headers: authHeaders })
        .then((r) => r.json())
        .then(setBotStatus)
        .catch(() => {});

      fetch(`${serverUrl}/api/history`, { headers: authHeaders })
        .then((r) => r.json())
        .then(setHistory)
        .catch(() => {});
    } catch (e) {
      console.warn('Socket connection error:', e);
      setIsServerConnected(false);
    }

    return () => {
      if (s) {
        s.disconnect();
      }
    };
  }, [settings?.serverUrl, settings?.serverToken]);


  // Compute 7 days of the currently viewed week (starts Monday)
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
    try { navigator.vibrate?.(15); } catch (_) {}
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
    try { navigator.vibrate?.(15); } catch (_) {}
    sounds.playPop?.();

    try {
      // 1. Refresh shifts from local storage
      const refreshedShifts = slackService.getShifts();
      setShifts(refreshedShifts);

      // 2. Test Slack connection and fetch newest messages
      const currentSettings = settings || slackService.getSettings();
      const res = await slackService.testConnection(currentSettings);
      if (res?.ok) {
        if (res.auth) {
          setBotStatus((prev) => ({
            ...prev,
            status: 'connected',
            authInfo: res.auth,
            channelName: currentSettings.channelName,
            channelId: currentSettings.channelId
          }));
        }
        if (res.recentMessages && res.recentMessages.length > 0) {
          setRecentMessages(res.recentMessages);
        }
      }

      setToast({
        type: 'success',
        title: 'Ververst!',
        message: 'Rooster en Slack berichten zijn bijgewerkt.'
      });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.warn('Refresh error:', err);
      setToast({
        type: 'info',
        title: 'Ververst',
        message: 'Lokale gegevens opnieuw geladen.'
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
    slackService.saveShifts(updated);

    const currentSettings = settings || slackService.getSettings();
    const serverUrl = (currentSettings?.serverUrl || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const serverToken = currentSettings?.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    try {
      await fetch(`${serverUrl}/api/shifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': slackService.getUserId()
        },
        body: JSON.stringify({ dateKey, blockId, shift: shiftData })
      });
    } catch (err) {}
  };

  const handleQuickToggleVrijcheck = async (dateKey, blockId) => {
    const updated = toggleVrijcheckForBlock(shifts, dateKey, blockId);
    setShifts(updated);
    slackService.saveShifts(updated);

    const currentSettings = settings || slackService.getSettings();
    const serverUrl = (currentSettings?.serverUrl || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const serverToken = currentSettings?.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    try {
      await fetch(`${serverUrl}/api/shifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': slackService.getUserId()
        },
        body: JSON.stringify({ dateKey, blockId, shift: updated[dateKey]?.[blockId] })
      });
    } catch (err) {}
  };

  const handleSimulate = async (simPayload) => {
    const currentSettings = settings || slackService.getSettings();
    const serverUrl = (currentSettings?.serverUrl || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const serverToken = currentSettings?.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    try {
      const res = await fetch(`${serverUrl}/api/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': slackService.getUserId()
        },
        body: JSON.stringify(simPayload)
      });
      return await res.json();
    } catch (err) {
      console.error('Error simulating message:', err);
    }
  };

  const handleClearHistory = async () => {
    const currentSettings = settings || slackService.getSettings();
    const serverUrl = (currentSettings?.serverUrl || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const serverToken = currentSettings?.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    try {
      await fetch(`${serverUrl}/api/history/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': slackService.getUserId()
        }
      });
      setHistory([]);
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    const merged = slackService.saveSettings(newSettings);
    setSettings(merged);

    const currentSettings = merged || slackService.getSettings();
    const serverUrl = (currentSettings?.serverUrl || DEFAULT_PROD_SERVER_URL).replace(/\/+$/, '');
    const serverToken = currentSettings?.serverToken || DEFAULT_PROD_SERVER_TOKEN;

    try {
      const res = await fetch(`${serverUrl}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverToken,
          'x-user-id': slackService.getUserId()
        },
        body: JSON.stringify(newSettings)
      });
      const updated = await res.json();
      if (updated && !updated.error) setSettings(updated);
    } catch (err) {}
  };

  const handleReconnect = async () => {
    try {
      const res = await slackService.testConnection(settings);
      if (res?.ok && res?.auth) {
        setBotStatus((prev) => ({ ...prev, status: 'connected', authInfo: res.auth }));
      }
    } catch (err) {
      console.error('Error reconnecting bot:', err);
    }
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
          title: 'Reactie Geplaatst!',
          message: `Succesvol gereageerd met :${emoji}: in #${currentSettings?.channelName || 'nl-dist-runners-hlm'}!`,
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
    setIsAuthChecking(true);
    setAuthError(null);

    try {
      const res = await slackService.testConnection(merged);
      if (res?.ok && res?.auth) {
        setBotStatus({
          status: 'connected',
          authInfo: res.auth,
          channelName: merged.channelName,
          channelId: merged.channelId
        });
        if (res.recentMessages && res.recentMessages.length > 0) {
          setRecentMessages(res.recentMessages);
        }
        setIsAuthenticated(true);
        setActiveTab('home');
        startVrijcheckPoller();

        setToast({
          type: 'success',
          title: 'Ingelogd!',
          message: `Welkom ${res.auth.user || 'Runner'}! Vrijcheck is nu actief.`
        });
        setTimeout(() => setToast(null), 4000);
      } else {
        throw new Error(res?.error || 'Sessie kon niet worden geverifieerd');
      }
    } catch (err) {
      setIsAuthenticated(false);
      setAuthError(err.message || 'Kon verbinding niet verifiëren');
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleLogout = () => {
    slackService.stopPolling();
    const cleared = slackService.logout();
    setSettings(cleared);
    setBotStatus({
      status: 'disconnected',
      hasToken: false,
      hasCookie: false,
      channelName: '#nl-dist-runners-hlm'
    });
    setRecentMessages([]);
    setIsAuthenticated(false);
    setAuthError('Je bent uitgelogd van Slack.');
  };

  // 1. Splash loader during initial session check
  if (isAuthChecking) {
    return (
      <div className="min-h-screen h-[100dvh] bg-[#0c0d11] text-white flex flex-col items-center justify-center space-y-4 select-none">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#e11d48] to-[#9f1239] flex items-center justify-center shadow-2xl shadow-red-500/30 animate-pulse border border-red-400/30">
          <Zap className="w-8 h-8 text-white fill-white" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold tracking-tight">Picnic Teamwork • Vrijcheck</h2>
          <p className="text-xs text-neutral-400 mt-1">Sessie controleren...</p>
        </div>
      </div>
    );
  }

  // 2. Authentication Gate: If not logged in or session expired, show LoginView!
  if (!isAuthenticated) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        initialError={authError}
      />
    );
  }

  return (
    <div className="min-h-screen h-[100dvh] bg-[#0a0a0c] text-neutral-100 flex flex-col items-center justify-start md:justify-center p-0 md:p-6 select-none font-sans overflow-hidden">
      {/* Desktop Top Toolbar (Frame Toggle & Info) */}
      <div className="hidden md:flex items-center justify-between w-full max-w-md mb-3 px-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-semibold text-neutral-300">
            Picnic Teamwork • Vrijcheck Bot
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#17181c] p-1 rounded-lg border border-[#272830]">
          <button
            onClick={() => setIsDeviceFrame(true)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-all ${
              isDeviceFrame
                ? 'bg-blue-600 text-white font-bold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Mobiel frame weergave"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobiel</span>
          </button>
          <button
            onClick={() => setIsDeviceFrame(false)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-all ${
              !isDeviceFrame
                ? 'bg-blue-600 text-white font-bold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Volledige breedte weergave"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Breed</span>
          </button>
        </div>
      </div>

      {/* Main Container / Mobile Device Wrapper */}
      <main
        className={`w-full bg-[#141416] transition-all relative flex flex-col overflow-hidden h-[100dvh] ${
          isDeviceFrame
            ? 'w-full md:max-w-[420px] md:h-[860px] md:rounded-[44px] md:border-[10px] md:border-[#2b2c34] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]'
            : 'w-full md:max-w-2xl md:min-h-[860px] md:rounded-3xl md:border md:border-[#2b2c34]'
        }`}
      >
        {/* Dynamic Island / Mobile Notch on Desktop Frame */}
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

        {/* Standalone VPS Offline Notice */}
        {!isVpsOnline && !slackService.isTestingMode() && (
          <div className="bg-amber-950/90 border-b border-amber-500/40 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-amber-200 z-30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
              <span className="truncate font-medium">VPS Server Niet Verbonden • Standalone vereist VPS</span>
            </div>
            <button
              type="button"
              onClick={refreshVpsStatus}
              className="px-2 py-0.5 rounded-md bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 font-bold text-[10px] shrink-0 ml-2 active:scale-95"
            >
              Opnieuw
            </button>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'home' && (
          <div className="flex-1 overflow-y-auto pt-notch-safe">
            <HomeView
              onNavigate={(tab) => setActiveTab(tab)}
              botStatus={botStatus}
              vpsStatus={vpsStatus}
              onRefreshVps={refreshVpsStatus}
              shifts={shifts}
              history={history}
              currentDate={currentDate}
              onTestReaction={() => handleTestRealReaction('3-red')}
              settings={settings}
            />
          </div>
        )}

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
              isLiveBotActive={botStatus?.status === 'polling'}
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

        {activeTab === 'menu' && (
          <div className="flex-1 overflow-y-auto pt-notch-safe">
            <MenuView
              onNavigate={(tab) => setActiveTab(tab)}
              onLogout={handleLogout}
              botStatus={botStatus}
              vpsStatus={vpsStatus}
              settings={settings}
              isServerConnected={isVpsOnline}
            />
          </div>
        )}

        {activeTab === 'live' && (
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
                <h2 className="text-sm font-bold text-white">Slack Live Monitor</h2>
              </div>
              <span className="text-xs text-neutral-400 font-mono">#nl-dist-runners-hlm</span>
            </div>
            <SlackLiveView
              botStatus={botStatus}
              history={history}
              recentMessages={recentMessages}
              onSimulate={handleSimulate}
              onClearHistory={handleClearHistory}
              onReconnect={handleReconnect}
              onNavigateToSettings={() => setActiveTab('settings')}
              onTestRealReaction={handleTestRealReaction}
              shifts={shifts}
            />
          </div>
        )}

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
                <h2 className="text-sm font-bold text-white">Instellingen &amp; Sessie</h2>
              </div>
            </div>
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onTestConnection={handleTestConnection}
              botStatus={botStatus}
            />
          </div>
        )}

        {/* Shift Selection Modal */}
        <ShiftModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          date={modalDate}
          currentShift={modalCurrentShift}
          shiftIndex={modalShiftIndex}
          onSaveShift={handleSaveShift}
        />

        {/* Date Picker Modal */}
        <DatePickerModal
          isOpen={isDatePickerOpen}
          onClose={() => setIsDatePickerOpen(false)}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDateFromPicker}
        />

        {/* Bottom Navigation Bar */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'live') setHasUnreadReaction(false);
          }}
          hasUnreadReaction={hasUnreadReaction}
        />
      </main>
    </div>
  );
}
