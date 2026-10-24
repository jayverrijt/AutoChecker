import React, { useState } from 'react';
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Zap, 
  Server,
  RefreshCw,
  Check,
  XCircle,
  HelpCircle,
  Activity
} from 'lucide-react';
import { SHIFT_BLOCKS } from '../utils/constants';
import { getShiftForBlock } from '../utils/shiftHelpers';
import { SlackEmoji } from './SlackEmoji';
import { TeamworkMascot } from './TeamworkMascot';

export const HomeView = ({
  onNavigate,
  botStatus,
  vpsStatus,
  onRefreshVps,
  shifts = {},
  history = [],
  currentDate,
  onTestReaction,
  settings
}) => {
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'success' | 'failed'
  const [isPinging, setIsPinging] = useState(false);

  // Extract display name & first name for greeting
  const rawUsername = settings?.username || botStatus?.authInfo?.user || 'Jay Verrijt';
  const cleanName = rawUsername.replace(/[0-9_-]/g, ' ').trim();
  const firstName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).split(' ')[0] || 'Jay';

  // Find all shifts that have either vrijcheckActive === true or reactionStatus !== null
  const now = new Date();
  const todayKey = format(now, 'yyyy-MM-dd');
  const tomorrowKey = format(addDays(now, 1), 'yyyy-MM-dd');

  // Collect active/reacted shifts grouped by dateKey
  const groupedShifts = {};

  // 1. Scan shifts for today, tomorrow, and future days
  const allDateKeys = Object.keys(shifts).sort();
  for (const dateKey of allDateKeys) {
    const dayData = shifts[dateKey];
    if (!dayData) continue;

    const matchedBlocks = SHIFT_BLOCKS
      .map(b => getShiftForBlock(shifts, dateKey, b.id))
      .filter(s => s && (s.vrijcheckActive === true || s.reactionStatus));

    if (matchedBlocks.length > 0) {
      groupedShifts[dateKey] = matchedBlocks;
    }
  }

  // Group into "vandaag" and "komend"
  const todayShifts = groupedShifts[todayKey] || [];
  const upcomingDateKeys = Object.keys(groupedShifts).filter(d => d > todayKey);

  // VPS status helper
  const isVpsOnline = vpsStatus?.isConnected;

  const handlePing = async () => {
    if (!onRefreshVps || isPinging) return;
    setIsPinging(true);
    try {
      await onRefreshVps();
    } finally {
      setTimeout(() => setIsPinging(false), 500);
    }
  };

  // Filter history for "Wat echt vrijgecheckt is"
  const filteredHistory = history.filter(item => {
    if (historyFilter === 'success') {
      return item.reactionSuccess === true || item.status === 'success';
    }
    if (historyFilter === 'failed') {
      return item.reactionSuccess === false && item.status !== 'success';
    }
    return true;
  });

  return (
    <div className="w-full max-w-md mx-auto px-4 py-2 space-y-4 pb-28 select-none animate-fadeIn">
      {/* 1. TOP HERO: Hi, Jay 👋 with Cool Mascot (Matches Screenshot 1) */}
      <div className="flex flex-col items-center justify-center text-center pt-1 pb-2">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <span>Hi, {firstName}</span>
          <span className="text-2xl">👋</span>
        </h1>

        {/* Picnic Superhero Avocado Mascot with Shades (matches Screenshot 1) */}
        <div className="mt-2.5 mb-1.5 transform hover:scale-105 transition-transform cursor-pointer" onClick={handlePing}>
          <TeamworkMascot className="w-16 h-16" />
        </div>

        {/* Minimal VPS Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#181a24] border border-[#272938] text-[11px] font-medium text-neutral-300">
          <span className={`w-2 h-2 rounded-full ${isVpsOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>{isVpsOnline ? `24/7 VPS Actief • ${vpsStatus?.pingMs || 50}ms` : 'VPS Offline'}</span>
          <button
            type="button"
            onClick={handlePing}
            disabled={isPinging}
            className="text-neutral-400 hover:text-white p-0.5 ml-0.5"
            title="Ververs VPS status"
          >
            <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. SHIFTS VANDAAG (Exact Teamwork Card Style from Screenshot 1) */}
      {todayShifts.length > 0 && (
        <div className="bg-[#14151e] border border-[#232533] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            {/* Left Date Box: Grey rounded pill (Sat 24) */}
            <div className="w-14 h-16 rounded-2xl bg-[#323440] flex flex-col items-center justify-center shrink-0 border border-white/5 shadow-inner">
              <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                {format(now, 'EEE', { locale: nl }).replace('.', '')}
              </span>
              <span className="text-2xl font-black text-white leading-none mt-0.5 font-mono">
                {format(now, 'd')}
              </span>
            </div>

            {/* Right Side: Header in blue + Shifts with badges */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[#3b82f6] mb-2 uppercase tracking-wide">
                Shifts vandaag
              </div>

              <div className="space-y-2">
                {todayShifts.map((shift) => {
                  const hasReacted = shift.reactionStatus?.success;
                  const emoji = shift.reactionStatus?.emoji || (shift.block?.includes('3') ? '3-red' : shift.block?.includes('2') ? '2-red' : '1-red');
                  const latency = shift.reactionStatus?.latencyMs;

                  return (
                    <div key={`today-${shift.block}`} className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-white tracking-tight">
                        {shift.startTime} - {shift.endTime}
                      </div>

                      {/* Right Badges matching Teamwork layout */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Type Badge: Trip */}
                        <span className="px-2 py-0.5 rounded-md bg-[#252834] text-neutral-300 font-semibold text-[11px]">
                          Trip
                        </span>

                        {/* Shift Block: S1 / M2 */}
                        <span className="px-2 py-0.5 rounded-md bg-[#252834] text-neutral-300 font-semibold text-[11px]">
                          {shift.block}
                        </span>

                        {/* Reaction / Status Badge with Emoji */}
                        {hasReacted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">
                            <SlackEmoji name={emoji} size="xs" />
                            <span>✓ {latency ? `${latency}ms` : 'Vrij'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold text-[11px]">
                            <Zap className="w-3 h-3 fill-current text-blue-400" />
                            <span>Standby</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. KOMENDE SHIFTS (Exact Teamwork Card Style from Screenshot 1) */}
      {upcomingDateKeys.length > 0 ? (
        upcomingDateKeys.slice(0, 3).map((dateKey) => {
          const shiftDate = parseISO(dateKey);
          const dateShifts = groupedShifts[dateKey] || [];

          return (
            <div key={dateKey} className="bg-[#14151e] border border-[#232533] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                {/* Left Date Box: Grey rounded pill (e.g. Mon 26) */}
                <div className="w-14 h-16 rounded-2xl bg-[#323440] flex flex-col items-center justify-center shrink-0 border border-white/5 shadow-inner">
                  <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                    {format(shiftDate, 'EEE', { locale: nl }).replace('.', '')}
                  </span>
                  <span className="text-2xl font-black text-white leading-none mt-0.5 font-mono">
                    {format(shiftDate, 'd')}
                  </span>
                </div>

                {/* Right Side: Header in blue + Shifts with badges */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#3b82f6] mb-2 uppercase tracking-wide">
                    Komende shifts
                  </div>

                  <div className="space-y-2">
                    {dateShifts.map((shift) => {
                      const hasReacted = shift.reactionStatus?.success;
                      const emoji = shift.reactionStatus?.emoji || (shift.block?.includes('3') ? '3-red' : shift.block?.includes('2') ? '2-red' : '1-red');
                      const latency = shift.reactionStatus?.latencyMs;

                      return (
                        <div key={`${dateKey}-${shift.block}`} className="flex items-center justify-between gap-2">
                          <div className="text-sm font-bold text-white tracking-tight">
                            {shift.startTime} - {shift.endTime}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2 py-0.5 rounded-md bg-[#252834] text-neutral-300 font-semibold text-[11px]">
                              Trip
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#252834] text-neutral-300 font-semibold text-[11px]">
                              {shift.block}
                            </span>

                            {hasReacted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">
                                <SlackEmoji name={emoji} size="xs" />
                                <span>✓ {latency ? `${latency}ms` : 'Vrij'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold text-[11px]">
                                <Zap className="w-3 h-3 fill-current text-blue-400" />
                                <span>Standby</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      ) : todayShifts.length === 0 ? (
        /* Empty State: Prompt to select shifts */
        <div className="bg-[#14151e] border border-[#232533] rounded-2xl p-5 text-center space-y-3">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Geen actieve vrijchecks ingesteld voor vandaag of de komende dagen.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('schedule')}
            className="py-2.5 px-4 rounded-xl bg-[#3171f7] hover:bg-[#255fd4] text-white text-xs font-bold inline-flex items-center gap-2 active:scale-95 transition-all shadow-md"
          >
            <Calendar className="w-4 h-4" />
            <span>Kies shifts in Rooster</span>
          </button>
        </div>
      ) : null}

      {/* 4. WAT ECHT VRIJGECHECKT IS (Real Slack Reactions & Failure Logs) */}
      <div className="bg-[#14151e] border border-[#232533] rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Vrijcheck Reactie Status
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-[#1d1f2a] p-0.5 rounded-lg border border-[#292c3d]">
            <button
              type="button"
              onClick={() => setHistoryFilter('all')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                historyFilter === 'all'
                  ? 'bg-[#3171f7] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Alles
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('success')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                historyFilter === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ✓ Gelukt
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('failed')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                historyFilter === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ✖ Mislukt
            </button>
          </div>
        </div>

        {/* List of reaction events */}
        {filteredHistory.length > 0 ? (
          <div className="divide-y divide-[#1e202b] space-y-0.5">
            {filteredHistory.slice(0, 6).map((item, idx) => {
              const isSuccess = item.reactionSuccess === true || item.status === 'success';
              const emojiName = item.reactionEmoji || item.emoji || (item.matchedShift?.includes('3') ? '3-red' : item.matchedShift?.includes('2') ? '2-red' : '1-red');
              const latency = item.latencyMs || 0;
              const dateLabel = item.messageDate || format(new Date(), 'dd-MM-yyyy');
              const shiftCode = item.matchedShift || item.period || 'Shift';

              return (
                <div key={item.messageTs || idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">
                        {dateLabel} • {shiftCode}
                      </span>
                      {item.period && (
                        <span className="text-[10px] text-neutral-400 font-mono">
                          ({item.period})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                      {isSuccess ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Gereageerd met :{emojiName}:</span>
                        </span>
                      ) : (
                        <span className="text-red-400 font-medium flex items-center gap-1 truncate">
                          <XCircle className="w-3 h-3 stroke-[2.5] shrink-0" />
                          <span className="truncate">{item.reason || item.error || 'Niet gereageerd'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Emoji Icon & Latency / Status */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isSuccess && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                        <SlackEmoji name={emojiName} size="sm" />
                      </div>
                    )}

                    <div className="text-right">
                      {isSuccess ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                          {latency}ms
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/30">
                          Mislukt
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-3 text-center text-xs text-neutral-400">
            {historyFilter === 'failed'
              ? 'Geen mislukte vrijchecks gevonden. Alles verloopt vlekkeloos!'
              : 'Nog geen Slack vrijchecks geregistreerd.'}
          </div>
        )}

        <div className="pt-1 border-t border-[#1e202b] flex items-center justify-between text-[11px] text-neutral-400">
          <span>Centrale Slack luisteraar: <strong>#nl-dist-runners-hlm</strong></span>
          <button
            type="button"
            onClick={() => onNavigate('live')}
            className="text-[#3b82f6] hover:underline font-bold flex items-center gap-0.5"
          >
            <span>Live Monitor</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
