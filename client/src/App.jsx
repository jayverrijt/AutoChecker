import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
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
import { ShiftModal } from './components/ShiftModal';
import { SlackLiveView } from './components/SlackLiveView';
import { SettingsView } from './components/SettingsView';
import { BottomNav } from './components/BottomNav';
import { SlackEmoji } from './components/SlackEmoji';
import { sounds } from './utils/audio';
import { Smartphone, Monitor, CheckCircle2, Zap } from 'lucide-react';
import { slackService } from './services/slackService';

const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : '/';


export function App() {
  const [socket, setSocket] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'live' | 'settings'
  
  // Default to 17-10-2026 (matching the Day-Planning-Sender message in screenshot)
  const initialDate = new Date(2026, 9, 17); // Month is 0-indexed: 9 = October
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const [shifts, setShifts] = useState({});
  const [settings, setSettings] = useState(null);
  const [botStatus, setBotStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(initialDate);
  const [modalInitialBlock, setModalInitialBlock] = useState(null);

  const [toast, setToast] = useState(null);
  const [hasUnreadReaction, setHasUnreadReaction] = useState(false);
  const [isDeviceFrame, setIsDeviceFrame] = useState(true);


  // Initialize Socket.io & Local Standalone Services
  useEffect(() => {
    // 1. Instantly populate from local storage so native app has data immediately
    const initialShifts = slackService.getShifts();
    const initialSettings = slackService.getSettings();
    setShifts(initialShifts);
    setSettings(initialSettings);
    if (initialSettings.soundEnabled !== undefined) {
      sounds.enabled = initialSettings.soundEnabled;
    }

    // 2. Perform connection test on launch to populate botStatus & runner username
    slackService.testConnection(initialSettings).then((res) => {
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
      }
    }).catch(console.warn);

    // 3. Listen to local status updates
    const unsub = slackService.onStatusChange((st) => {
      if (st?.authInfo) {
        setBotStatus((prev) => ({ ...prev, ...st }));
      }
    });

    // 4. Connect to Socket.io backend if running
    let s = null;
    try {
      s = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 4000
      });

      s.on('connect', () => {
        console.log('Connected to Vrijcheck backend');
      });

      s.on('shifts:updated', (data) => {
        setShifts(data);
        slackService.saveShifts(data);
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
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });

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

      // Initial fetch fallback
      fetch(`${SOCKET_URL}/api/shifts`)
        .then((r) => r.json())
        .then(setShifts)
        .catch(() => {});

      fetch(`${SOCKET_URL}/api/settings`)
        .then((r) => r.json())
        .then((data) => {
          setSettings(data);
          if (data.soundEnabled !== undefined) sounds.enabled = data.soundEnabled;
        })
        .catch(() => {});

      fetch(`${SOCKET_URL}/api/status`)
        .then((r) => r.json())
        .then(setBotStatus)
        .catch(() => {});

      fetch(`${SOCKET_URL}/api/history`)
        .then((r) => r.json())
        .then(setHistory)
        .catch(() => {});
    } catch (e) {
      console.warn('Socket init warning:', e);
    }

    return () => {
      unsub();
      if (s) s.disconnect();
    };
  }, []);


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
    setCurrentDate(initialDate);
    setSelectedDate(initialDate);
  };

  const handleOpenShiftModal = (date, blockId = null) => {
    setModalDate(date);
    setModalInitialBlock(blockId);
    setIsModalOpen(true);
  };


  const handleSaveShift = async (shiftData) => {
    const dateKey = format(modalDate, 'yyyy-MM-dd');
    const updated = {
      ...shifts,
      [dateKey]: shiftData
    };
    setShifts(updated);
    slackService.saveShifts(updated);

    try {
      await fetch(`${SOCKET_URL}/api/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateKey, shift: shiftData })
      });
    } catch (err) {}
  };

  const handleQuickToggleVrijcheck = async (dateKey) => {
    const existing = shifts[dateKey];
    if (!existing || existing.block === 'none') return;

    const updatedShift = {
      ...existing,
      vrijcheckActive: existing.vrijcheckActive === false ? true : false
    };

    const updated = {
      ...shifts,
      [dateKey]: updatedShift
    };
    setShifts(updated);
    slackService.saveShifts(updated);

    try {
      await fetch(`${SOCKET_URL}/api/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateKey, shift: updatedShift })
      });
    } catch (err) {}
  };

  const handleSimulate = async (simPayload) => {
    try {
      const res = await fetch(`${SOCKET_URL}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simPayload)
      });
      return await res.json();
    } catch (err) {
      console.error('Error simulating message:', err);
    }
  };

  const handleClearHistory = async () => {
    try {
      await fetch(`${SOCKET_URL}/api/history/clear`, { method: 'POST' });
      setHistory([]);
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    const merged = slackService.saveSettings(newSettings);
    setSettings(merged);

    try {
      const res = await fetch(`${SOCKET_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const updated = await res.json();
      if (updated) setSettings(updated);
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
        confetti({ particleCount: 60, spread: 60 });
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


  return (
    <div className="min-h-screen bg-[#0a0a0c] text-neutral-100 flex flex-col items-center justify-center p-0 md:p-6 select-none font-sans">
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
        className={`w-full bg-[#141416] transition-all relative flex flex-col overflow-hidden ${
          isDeviceFrame
            ? 'max-w-[420px] md:h-[860px] md:rounded-[44px] md:border-[10px] md:border-[#2b2c34] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]'
            : 'max-w-2xl min-h-screen md:min-h-[860px] md:rounded-3xl md:border md:border-[#2b2c34]'
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

        {/* Content based on active tab */}
        {activeTab === 'schedule' && (
          <>
            <Header
              currentDate={currentDate}
              onGoToToday={handleGoToToday}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
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
              />
            </div>
          </>
        )}

        {activeTab === 'live' && (
          <div className="flex-1 overflow-y-auto pt-2">
            <div className="px-4 py-2 border-b border-[#22242a] flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Slack Live Monitor</span>
              </h2>
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
          <div className="flex-1 overflow-y-auto pt-2">
            <div className="px-4 py-2 border-b border-[#22242a]">
              <h2 className="text-base font-bold text-white">Instellingen &amp; Sessie</h2>
              <p className="text-xs text-neutral-400">Picnic Enterprise Slack sessie &amp; blokken</p>
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
          currentShift={shifts[format(modalDate, 'yyyy-MM-dd')]}
          initialBlock={modalInitialBlock}
          onSaveShift={handleSaveShift}
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
