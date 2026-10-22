import React, { useState, useEffect } from 'react';
import { format, addDays, differenceInSeconds } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  Calendar, 
  Radio, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  Zap, 
  Sparkles,
  Flame,
  CheckCircle2,
  RefreshCw,
  Bell,
  Info
} from 'lucide-react';
import { PicnicMascot } from './PicnicMascot';
import { SHIFT_BLOCKS } from '../utils/constants';
import { getShiftForBlock } from '../utils/shiftHelpers';
import { SlackEmoji } from './SlackEmoji';

export const HomeView = ({
  onNavigate,
  botStatus,
  shifts = {},
  currentDate,
  onTestReaction
}) => {
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0, targetLabel: '' });
  const [activeTipIndex, setActiveTipIndex] = useState(0);

  const now = new Date();
  const todayFormatted = format(now, 'EEEE, d MMMM yyyy', { locale: nl });
  const capitalizedToday = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  // Dynamic greeting based on time of day
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';

  const isConnected = botStatus?.status === 'connected' || botStatus?.status === 'polling';
  const username = botStatus?.authInfo?.user || 'jayverrijt';

  // Calculate next Day-Planning release countdown
  useEffect(() => {
    const updateCountdown = () => {
      const current = new Date();
      const currentHours = current.getHours();
      const currentMinutes = current.getMinutes();
      const currentSeconds = current.getSeconds();
      const currentTotalSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds;

      const morningSeconds = 17 * 3600 + 10 * 60; // 17:10:00 (Ochtend shifts dag van tevoren)
      const afternoonSeconds = 10 * 3600 + 10 * 60; // 10:10:00 (Middag shifts dag zelf)

      let diffSec = 0;
      let label = '';

      if (currentTotalSeconds < afternoonSeconds) {
        // Before 10:10 -> Next is Afternoon release today
        diffSec = afternoonSeconds - currentTotalSeconds;
        label = 'Middag shifts (vandaag)';
      } else if (currentTotalSeconds < morningSeconds) {
        // Between 10:10 and 17:10 -> Next is Morning release today (for tomorrow)
        diffSec = morningSeconds - currentTotalSeconds;
        label = 'Ochtend shifts (voor morgen)';
      } else {
        // After 17:10 -> Next is Afternoon release tomorrow
        diffSec = (24 * 3600 - currentTotalSeconds) + afternoonSeconds;
        label = 'Middag shifts (morgen)';
      }

      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;

      setTimeRemaining({
        hours: h,
        minutes: m,
        seconds: s,
        targetLabel: label
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Runner tips carousel
  const tips = [
    'De Day-Planner post meestal rond :28s over het uur. Onze bot luistert de hele minuut door!',
    'Zowel M1 als M2 aangezet? De bot reageert direct op beide met :1-red: en :2-red:!',
    'Onze in-app bot reageert via Slack binnen 280ms — ruim 10x sneller dan met de hand!',
    'Stel je gewenste vrijcheck shifts uiterlijk om 17:08 in zodat de bot optimaal voorbereid is.'
  ];

  useEffect(() => {
    const tipInterval = setInterval(() => {
      setActiveTipIndex((prev) => (prev + 1) % tips.length);
    }, 6000);
    return () => clearInterval(tipInterval);
  }, [tips.length]);

  // Check today and tomorrow's active vrijcheck shifts
  const todayKey = format(now, 'yyyy-MM-dd');
  const tomorrowKey = format(addDays(now, 1), 'yyyy-MM-dd');

  const todayActiveShifts = SHIFT_BLOCKS
    .map(b => getShiftForBlock(shifts, todayKey, b.id))
    .filter(s => s.vrijcheckActive || s.reactionStatus?.success);

  const tomorrowActiveShifts = SHIFT_BLOCKS
    .map(b => getShiftForBlock(shifts, tomorrowKey, b.id))
    .filter(s => s.vrijcheckActive || s.reactionStatus?.success);

  const hasAnyActive = todayActiveShifts.length > 0 || tomorrowActiveShifts.length > 0;

  return (
    <div className="px-4 py-3 space-y-4 pb-28 overflow-y-auto select-none animate-fadeIn">
      {/* 1. Welcome Hero Banner */}
      <div className="bg-gradient-to-br from-[#1e3a8a]/70 via-[#16223e]/80 to-[#10121a] border border-blue-500/30 rounded-3xl p-5 relative overflow-hidden shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-bold text-blue-300 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Picnic Teamwork • Vrijcheck</span>
          </div>

          <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
            {greeting}, {username}!
          </h1>
          <p className="text-xs text-neutral-300 mt-0.5">
            {capitalizedToday}
          </p>

          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="px-4 py-2.5 rounded-2xl bg-[#3171f7] hover:bg-[#2563eb] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/30 active:scale-95 transition-all"
            >
              <Calendar className="w-4 h-4" />
              <span>Bekijk Rooster</span>
              <ChevronRight className="w-3.5 h-3.5 -mr-1" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="px-3.5 py-2.5 rounded-2xl bg-[#232736] hover:bg-[#2e3346] text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-white/10 active:scale-95 transition-all"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Slack Live</span>
            </button>
          </div>
        </div>

        {/* Mascot decoration */}
        <div className="absolute right-1 -bottom-3 w-32 h-28 opacity-80 pointer-events-none">
          <PicnicMascot className="w-full h-full" />
        </div>
      </div>

      {/* 2. Interactive Live Release Countdown Widget */}
      <div className="bg-gradient-to-br from-[#1a1c27] to-[#12131b] border border-[#2b2e40] rounded-3xl p-4.5 space-y-3 shadow-md relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Volgende Vrijcheck Release</span>
          </div>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
            {timeRemaining.targetLabel}
          </span>
        </div>

        {/* Big Countdown Timer Numbers */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-[#0e1017] border border-[#222534] rounded-2xl py-2.5 px-2">
            <div className="text-2xl font-black text-white font-mono leading-none">
              {String(timeRemaining.hours).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-neutral-400 font-bold uppercase mt-1">Uur</div>
          </div>

          <div className="bg-[#0e1017] border border-[#222534] rounded-2xl py-2.5 px-2">
            <div className="text-2xl font-black text-amber-300 font-mono leading-none">
              {String(timeRemaining.minutes).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-neutral-400 font-bold uppercase mt-1">Minuten</div>
          </div>

          <div className="bg-[#0e1017] border border-[#222534] rounded-2xl py-2.5 px-2">
            <div className="text-2xl font-black text-emerald-400 font-mono leading-none">
              {String(timeRemaining.seconds).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-neutral-400 font-bold uppercase mt-1">Seconden</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
          <span>🌅 Ochtend: <strong>17:10u</strong> (dag ervoor)</span>
          <span>☀️ Middag: <strong>10:10u</strong> (dag zelf)</span>
        </div>
      </div>

      {/* 3. Mijn Ingesteld Vrijcheck Shifts Card */}
      <div className="bg-[#181a24] border border-[#262835] rounded-3xl p-4.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Zap className="w-4 h-4 text-blue-400 fill-blue-400" />
            <span>Mijn Gecheckte Shifts</span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('schedule')}
            className="text-xs text-[#3171f7] hover:underline font-bold flex items-center gap-0.5"
          >
            <span>Rooster bekijken</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {hasAnyActive ? (
          <div className="space-y-2">
            {/* Tomorrow Active Shifts */}
            {tomorrowActiveShifts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Morgen • {format(addDays(now, 1), 'EEEE d MMM', { locale: nl })}
                </div>
                {tomorrowActiveShifts.map((shift) => (
                  <div
                    key={shift.block}
                    className="p-3 rounded-2xl bg-[#1e2333] border border-blue-500/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 font-black text-xs flex items-center justify-center border border-blue-500/30">
                        {shift.block}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {shift.startTime} - {shift.endTime}
                        </div>
                        {shift.reactionStatus?.success ? (
                          <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>✓ Vrij gereageerd ({shift.reactionStatus.latencyMs}ms)</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-blue-300 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                            <span>Vrijcheck Scherp • 17:10 release</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-white text-[11px] font-bold shadow-sm ${
                      shift.reactionStatus?.success ? 'bg-emerald-600' : 'bg-[#3171f7]'
                    }`}>
                      {shift.reactionStatus?.success ? 'Gereageerd' : 'Actief'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Today Active Shifts */}
            {todayActiveShifts.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Vandaag • {format(now, 'EEEE d MMM', { locale: nl })}
                </div>
                {todayActiveShifts.map((shift) => (
                  <div
                    key={shift.block}
                    className="p-3 rounded-2xl bg-[#1e2333] border border-blue-500/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 font-black text-xs flex items-center justify-center border border-blue-500/30">
                        {shift.block}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {shift.startTime} - {shift.endTime}
                        </div>
                        <div className="text-[10px] text-emerald-300 font-semibold">
                          {shift.reactionStatus?.success ? `✓ Vrij gereageerd (${shift.reactionStatus.latencyMs}ms)` : 'Vrijcheck Actief'}
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold shadow-sm">
                      {shift.reactionStatus?.success ? 'Gereageerd' : 'Actief'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-[#12141c] border border-[#242735] text-center space-y-2">
            <p className="text-xs text-neutral-400">
              Je hebt op dit moment geen shifts op vrijchecken staan voor vandaag of morgen.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="py-2 px-4 rounded-xl bg-[#232736] hover:bg-[#2e3346] text-neutral-200 text-xs font-bold border border-white/10 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Shifts selecteren in Rooster</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Live Bot Health & Quick Test */}
      <div className="bg-[#181a24] border border-[#262835] rounded-3xl p-4.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Picnic Slack Bot Status</span>
          </div>

          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Live Scherp</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#12141c] border border-[#222533] rounded-2xl p-2.5">
            <div className="text-[10px] text-neutral-400 font-medium">Kanaal</div>
            <div className="text-white font-bold font-mono text-xs mt-0.5 truncate">
              #nl-dist-runners-hlm
            </div>
          </div>

          <div className="bg-[#12141c] border border-[#222533] rounded-2xl p-2.5">
            <div className="text-[10px] text-neutral-400 font-medium">Gem. Reactiesnelheid</div>
            <div className="text-emerald-300 font-bold font-mono text-xs mt-0.5 truncate flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>~275 ms</span>
            </div>
          </div>
        </div>

        {onTestReaction && (
          <button
            type="button"
            onClick={onTestReaction}
            className="w-full py-2.5 px-3 rounded-2xl bg-[#1e2333] hover:bg-[#272e42] border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
            <span>Test Reactie &amp; Audio Feedback</span>
          </button>
        )}
      </div>

      {/* 5. Runner Tips Widget */}
      <div className="bg-[#14151e] border border-[#232636] rounded-2xl p-3.5 flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-amber-300">Picnic Runner Tip</div>
          <p className="text-xs text-neutral-300 mt-0.5 leading-snug">
            {tips[activeTipIndex]}
          </p>
        </div>
      </div>
    </div>
  );
};
