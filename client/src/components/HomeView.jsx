import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  Calendar, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  Zap, 
  CheckCircle2, 
  RefreshCw, 
  Server, 
  Wifi, 
  WifiOff, 
  Activity, 
  SlidersHorizontal,
  Bell
} from 'lucide-react';
import { getDayShifts } from '../utils/shiftHelpers';
import { SlackEmoji } from './SlackEmoji';

export const HomeView = ({
  onNavigate,
  botStatus,
  vpsStatus,
  onRefreshVps,
  shifts = {},
  currentDate,
  onTestReaction,
  settings
}) => {
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0, targetLabel: '' });
  const [isPinging, setIsPinging] = useState(false);

  const now = new Date();
  const todayFormatted = format(now, 'EEEE d MMMM yyyy', { locale: nl });
  const capitalizedToday = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
  const username = settings?.userName || botStatus?.authInfo?.user || 'Jay Verrijt';

  // Countdown timer for next Day-Planning release
  useEffect(() => {
    const updateCountdown = () => {
      const current = new Date();
      const currentHours = current.getHours();
      const currentMinutes = current.getMinutes();
      const currentSeconds = current.getSeconds();
      const currentTotalSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds;

      const morningSeconds = 17 * 3600 + 10 * 60; // 17:10:00 (Ochtend shifts morgen)
      const afternoonSeconds = 10 * 3600 + 10 * 60; // 10:10:00 (Middag shifts vandaag)

      let diffSec = 0;
      let label = '';

      if (currentTotalSeconds < afternoonSeconds) {
        diffSec = afternoonSeconds - currentTotalSeconds;
        label = 'Middag shifts (vandaag)';
      } else if (currentTotalSeconds < morningSeconds) {
        diffSec = morningSeconds - currentTotalSeconds;
        label = 'Ochtend shifts (voor morgen)';
      } else {
        diffSec = (24 * 3600 - currentTotalSeconds) + afternoonSeconds;
        label = 'Middag shifts (morgen)';
      }

      setTimeRemaining({
        hours: Math.floor(diffSec / 3600),
        minutes: Math.floor((diffSec % 3600) / 60),
        seconds: diffSec % 60,
        targetLabel: label
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePingClick = async () => {
    if (!onRefreshVps || isPinging) return;
    setIsPinging(true);
    try {
      await onRefreshVps();
    } finally {
      setTimeout(() => setIsPinging(false), 500);
    }
  };

  // Find active vrijcheck shifts for today & tomorrow
  const todayKey = format(now, 'yyyy-MM-dd');
  const tomorrowKey = format(addDays(now, 1), 'yyyy-MM-dd');

  const todayShifts = getDayShifts(shifts, todayKey);
  const tomorrowShifts = getDayShifts(shifts, tomorrowKey);

  const activeToday = todayShifts.filter(s => s.vrijcheckActive || s.reactionStatus?.success);
  const activeTomorrow = tomorrowShifts.filter(s => s.vrijcheckActive || s.reactionStatus?.success);
  const hasActiveShifts = activeToday.length > 0 || activeTomorrow.length > 0;

  // VPS connection state
  const isVpsOnline = vpsStatus?.isConnected;
  const vpsHost = settings?.serverUrl 
    ? settings.serverUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '') 
    : 'Niet geconfigureerd';

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3 space-y-3.5 pb-28 select-none animate-fadeIn">
      {/* 1. Profile Header Card */}
      <div className="flex items-center justify-between bg-[#161720] border border-[#242735] rounded-2xl px-4 py-3 shadow-sm">
        <div>
          <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            {capitalizedToday}
          </div>
          <div className="text-base font-bold text-white tracking-tight mt-0.5">
            {greeting}, {username}
          </div>
        </div>

        <div className="w-8 h-8 rounded-full bg-[#214aa2] text-white font-bold text-xs flex items-center justify-center border border-blue-400/30">
          JV
        </div>
      </div>

      {/* 2. PROMINENT 24/7 VPS DAEMON MONITOR CARD */}
      <div className="bg-[#161720] border border-[#272a38] rounded-2xl p-4 space-y-3 shadow-md">
        {/* Card Header: VPS Status & Live Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className={`w-4 h-4 ${isVpsOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-xs font-bold text-white tracking-tight">
              VPS 24/7 Bot Daemon
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isVpsOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online {vpsStatus?.pingMs ? `(${vpsStatus.pingMs}ms)` : ''}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>{settings?.serverUrl ? 'Verbinden...' : 'Niet Gekoppeld'}</span>
              </span>
            )}

            <button
              type="button"
              onClick={handlePingClick}
              disabled={isPinging}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:scale-90"
              title="Ping VPS Server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
          <div className="bg-[#0f1015] border border-[#20222e] rounded-xl p-2.5">
            <div className="text-[10px] text-neutral-400 font-medium">Server Host</div>
            <div className="text-white font-mono text-[11px] font-semibold truncate mt-0.5">
              {vpsHost}
            </div>
          </div>

          <div className="bg-[#0f1015] border border-[#20222e] rounded-xl p-2.5">
            <div className="text-[10px] text-neutral-400 font-medium">Kanaal Monitor</div>
            <div className="text-blue-300 font-mono text-[11px] font-semibold truncate mt-0.5">
              {settings?.channelName || '#nl-dist-runners-hlm'}
            </div>
          </div>
        </div>

        {/* Current VPS Bot Activity */}
        <div className="bg-[#0f1015] border border-[#20222e] rounded-xl p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400">Wat doet de bot nu?</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>24/7 Actief luisteren</span>
            </span>
          </div>

          <div className="text-xs text-neutral-200 font-medium">
            {vpsStatus?.botStatus?.lastReaction ? (
              <span className="text-emerald-300">
                Laatste actie: Reactie :{vpsStatus.botStatus.lastReaction.emoji}: geplaatst om {vpsStatus.botStatus.lastReaction.time || '17:10'}
              </span>
            ) : (
              <span>Standby op de VPS • Klaar om direct te reageren wanneer Day-Planning-Sender post</span>
            )}
          </div>
        </div>

        {/* Action Buttons: Test & Settings */}
        <div className="flex items-center gap-2 pt-0.5">
          {onTestReaction && (
            <button
              type="button"
              onClick={onTestReaction}
              className="flex-1 py-2 px-3 rounded-xl bg-[#214aa2] hover:bg-[#2753b5] text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Sneltest Reactie</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="py-2 px-3 rounded-xl bg-[#22242f] hover:bg-[#2c2e3d] text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1 border border-white/5 active:scale-95 transition-all"
            title="Server Instellingen"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Configuratie</span>
          </button>
        </div>
      </div>

      {/* 3. RELEASE COUNTDOWN BANNER */}
      <div className="bg-[#161720] border border-[#272a38] rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Volgend Rooster Publicatiemoment</span>
          </div>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
            {timeRemaining.targetLabel}
          </span>
        </div>

        {/* Sleek Countdown Display */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#0f1015] border border-[#20222e] rounded-xl py-2">
            <div className="text-xl font-bold text-white font-mono leading-none">
              {String(timeRemaining.hours).padStart(2, '0')}
            </div>
            <div className="text-[9px] text-neutral-400 uppercase font-medium mt-1">Uur</div>
          </div>

          <div className="bg-[#0f1015] border border-[#20222e] rounded-xl py-2">
            <div className="text-xl font-bold text-amber-300 font-mono leading-none">
              {String(timeRemaining.minutes).padStart(2, '0')}
            </div>
            <div className="text-[9px] text-neutral-400 uppercase font-medium mt-1">Min</div>
          </div>

          <div className="bg-[#0f1015] border border-[#20222e] rounded-xl py-2">
            <div className="text-xl font-bold text-emerald-400 font-mono leading-none">
              {String(timeRemaining.seconds).padStart(2, '0')}
            </div>
            <div className="text-[9px] text-neutral-400 uppercase font-medium mt-1">Sec</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
          <span>Ochtend: <strong>17:10u</strong> (dag ervoor)</span>
          <span>Middag: <strong>10:10u</strong> (dag zelf)</span>
        </div>
      </div>

      {/* 4. MIJN ACTIEVE VRIJCHECK SHIFTS */}
      <div className="bg-[#161720] border border-[#272a38] rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Zap className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
            <span>Mijn Actieve Vrijcheck Shifts</span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('schedule')}
            className="text-xs text-[#3171f7] hover:underline font-bold flex items-center gap-0.5"
          >
            <span>Rooster</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {hasActiveShifts ? (
          <div className="space-y-2">
            {/* Tomorrow Active */}
            {activeTomorrow.map((shift) => (
              <div
                key={`tomorrow-${shift.block}`}
                className="p-2.5 rounded-xl bg-[#1c2233] border border-blue-500/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#2e5bbd] text-white font-bold text-xs flex items-center justify-center">
                    {shift.block}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      Morgen • {shift.startTime} - {shift.endTime}
                    </div>
                    <div className="text-[10px] text-blue-300 font-medium">
                      {shift.reactionStatus?.success
                        ? `✓ Vrij gereageerd (${shift.reactionStatus.latencyMs}ms)`
                        : 'Vrijcheck Actief • Wacht op 17:10'}
                    </div>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                  {shift.reactionStatus?.success ? 'Gereageerd' : 'Actief'}
                </span>
              </div>
            ))}

            {/* Today Active */}
            {activeToday.map((shift) => (
              <div
                key={`today-${shift.block}`}
                className="p-2.5 rounded-xl bg-[#1c2233] border border-blue-500/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#2e5bbd] text-white font-bold text-xs flex items-center justify-center">
                    {shift.block}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      Vandaag • {shift.startTime} - {shift.endTime}
                    </div>
                    <div className="text-[10px] text-emerald-300 font-medium">
                      {shift.reactionStatus?.success
                        ? `✓ Vrij gereageerd (${shift.reactionStatus.latencyMs}ms)`
                        : 'Vrijcheck Actief'}
                    </div>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                  {shift.reactionStatus?.success ? 'Gereageerd' : 'Actief'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-[#0f1015] border border-[#20222e] text-center space-y-2">
            <p className="text-xs text-neutral-400">
              Er staan op dit moment geen shifts op vrijchecken voor vandaag of morgen.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="py-1.5 px-3.5 rounded-xl bg-[#214aa2] hover:bg-[#2552b3] text-white text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Shifts kiezen in Rooster</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
