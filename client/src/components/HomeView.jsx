import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle2,
  Zap,
  RefreshCw,
  Check,
  XCircle
} from 'lucide-react';
import { SHIFT_BLOCKS, extractFirstName } from '../utils/constants';
import { getShiftForBlock } from '../utils/shiftHelpers';
import { SlackEmoji } from './SlackEmoji';
import { TeamworkMascot } from './TeamworkMascot';

export const HomeView = ({
  onNavigate,
  botStatus,
  vpsStatus,
  onRefreshVps,
  shifts = {},
  vrijcheckRequests = [],
  settings
}) => {
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'STANDBY' | 'SUCCESS' | 'FAILED'
  const [isPinging, setIsPinging] = useState(false);

  // Bugfix #2: Dynamic first name extraction from Slack Display Name / Real Name, fallback "Runner"
  const slackProfile = botStatus?.authInfo?.profile || {};
  const firstName =
    settings?.firstName && settings.firstName !== 'Runner'
      ? settings.firstName.split(/\s+/)[0]
      : extractFirstName(
          settings?.displayName || slackProfile.displayName,
          settings?.realName || slackProfile.realName,
          'Runner'
        );

  const now = new Date();
  const todayKey = format(now, 'yyyy-MM-dd');

  // Build unified list of ONLY explicitly requested vrijchecks (STANDBY, SUCCESS, FAILED)
  // Bugfix #1 & #4: Never show unrequested shifts or fake failures!
  const requestedMap = new Map();

  if (Array.isArray(vrijcheckRequests)) {
    for (const r of vrijcheckRequests) {
      if (!r || !r.shiftDate || !r.shiftBlock) continue;
      if (!['STANDBY', 'SUCCESS', 'FAILED'].includes(r.status)) continue;
      const key = `${r.shiftDate}#${r.shiftBlock}`;
      requestedMap.set(key, {
        shiftDate: r.shiftDate,
        shiftBlock: r.shiftBlock,
        startTime: r.startTime || '14:00',
        endTime: r.endTime || '16:45',
        status: r.status,
        emoji: (r.reactionEmoji || r.reaction_emoji || '1-red').replace(/^:+|:+$/g, ''),
        latencyMs: r.latency_ms ?? r.latencyMs ?? null,
        errorMessage: r.error_message || r.errorMessage || null,
        reactedAt: r.reacted_at || r.reactedAt || null
      });
    }
  }

  for (const dateKey of Object.keys(shifts).sort()) {
    const dayData = shifts[dateKey];
    if (!dayData) continue;
    for (const b of SHIFT_BLOCKS) {
      const s = getShiftForBlock(shifts, dateKey, b.id);
      if (s && s.vrijcheckActive === true) {
        const key = `${dateKey}#${b.id}`;
        if (!requestedMap.has(key)) {
          let st = s.vrijcheckStatus || 'STANDBY';
          if (s.reactionStatus) {
            st = s.reactionStatus.success ? 'SUCCESS' : 'FAILED';
          }
          requestedMap.set(key, {
            shiftDate: dateKey,
            shiftBlock: b.id,
            startTime: s.startTime || b.defaultTime.split(' - ')[0],
            endTime: s.endTime || b.defaultTime.split(' - ')[1],
            status: st,
            emoji: s.reactionStatus?.emoji || b.emoji || '1-red',
            latencyMs: s.reactionStatus?.latencyMs || null,
            errorMessage: s.reactionStatus?.error || null,
            reactedAt: s.reactionStatus?.timestamp || null
          });
        }
      }
    }
  }

  const allRequested = Array.from(requestedMap.values()).sort((a, b) => {
    if (a.shiftDate !== b.shiftDate) return a.shiftDate.localeCompare(b.shiftDate);
    return a.shiftBlock.localeCompare(b.shiftBlock);
  });

  // Group requested shifts by date for Today & Upcoming cards
  const groupedByDate = {};
  for (const req of allRequested) {
    if (!groupedByDate[req.shiftDate]) groupedByDate[req.shiftDate] = [];
    groupedByDate[req.shiftDate].push(req);
  }

  const todayRequested = groupedByDate[todayKey] || [];
  const upcomingDateKeys = Object.keys(groupedByDate)
    .filter((d) => d > todayKey)
    .sort();

  const filteredRequests = allRequested.filter((item) => {
    if (statusFilter === 'ALL') return true;
    return item.status === statusFilter;
  });

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

  const renderStatusBadge = (req) => {
    if (req.status === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">
          <SlackEmoji name={req.emoji} size="xs" />
          <span>✓ {req.latencyMs ? `${req.latencyMs}ms` : 'Geplaatst'}</span>
        </span>
      );
    }
    if (req.status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-[11px]">
          <XCircle className="w-3 h-3 text-red-400" />
          <span>Mislukt</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold text-[11px]">
        <Zap className="w-3 h-3 fill-current text-blue-400" />
        <span>Standby</span>
      </span>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-2 space-y-4 pb-28 select-none animate-fadeIn">
      {/* 1. TOP HERO: Dynamic Greeting Hi, <Voornaam> */}
      <div className="flex flex-col items-center justify-center text-center pt-1 pb-2">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <span>Hi, {firstName}</span>
          <span className="text-2xl">👋</span>
        </h1>

        <div
          className="mt-2.5 mb-1.5 transform hover:scale-105 transition-transform cursor-pointer"
          onClick={handlePing}
        >
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

      {/* 2. AANGEVRAAGDE SHIFTS VANDAAG */}
      {todayRequested.length > 0 && (
        <div className="bg-[#14151e] border border-[#232533] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-16 rounded-2xl bg-[#323440] flex flex-col items-center justify-center shrink-0 border border-white/5 shadow-inner">
              <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                {format(now, 'EEE', { locale: nl }).replace('.', '')}
              </span>
              <span className="text-2xl font-black text-white leading-none mt-0.5 font-mono">
                {format(now, 'd')}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[#3b82f6] mb-2 uppercase tracking-wide">
                Aangevraagde shifts vandaag
              </div>

              <div className="space-y-2">
                {todayRequested.map((req) => (
                  <div key={`today-${req.shiftBlock}`} className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-white tracking-tight">
                      {req.startTime} - {req.endTime}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-[#252834] text-neutral-300 font-semibold text-[11px]">
                        Trip
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#252834] text-neutral-300 font-semibold text-[11px]">
                        {req.shiftBlock}
                      </span>
                      {renderStatusBadge(req)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. KOMENDE AANGEVRAAGDE SHIFTS */}
      {upcomingDateKeys.length > 0 ? (
        upcomingDateKeys.map((dateKey) => {
          const shiftDate = parseISO(dateKey);
          const dateRequests = groupedByDate[dateKey] || [];

          return (
            <div key={dateKey} className="bg-[#14151e] border border-[#232533] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-16 rounded-2xl bg-[#323440] flex flex-col items-center justify-center shrink-0 border border-white/5 shadow-inner">
                  <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                    {format(shiftDate, 'EEE', { locale: nl }).replace('.', '')}
                  </span>
                  <span className="text-2xl font-black text-white leading-none mt-0.5 font-mono">
                    {format(shiftDate, 'd')}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#3b82f6] mb-2 uppercase tracking-wide">
                    Komende aangevraagde shifts
                  </div>

                  <div className="space-y-2">
                    {dateRequests.map((req) => (
                      <div key={`${dateKey}-${req.shiftBlock}`} className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-white tracking-tight">
                          {req.startTime} - {req.endTime}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-md bg-[#252834] text-neutral-300 font-semibold text-[11px]">
                            Trip
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#252834] text-neutral-300 font-semibold text-[11px]">
                            {req.shiftBlock}
                          </span>
                          {renderStatusBadge(req)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      ) : todayRequested.length === 0 ? (
        <div className="bg-[#14151e] border border-[#232533] rounded-2xl p-5 text-center space-y-3">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Geen aangevraagde vrijchecks voor vandaag of de komende dagen.
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

      {/* 4. UITSLUITEND AANGEVRAAGDE SHIFTS & 3 STATUSSEN (Standby, Success, Failed) */}
      <div className="bg-[#14151e] border border-[#232533] rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Aangevraagde Vrijchecks
            </h3>
          </div>

          {/* 3 Status Filter Pills */}
          <div className="flex items-center gap-1 bg-[#1d1f2a] p-0.5 rounded-lg border border-[#292c3d]">
            {[
              { id: 'ALL', label: 'Alles', activeClass: 'bg-[#3171f7] text-white' },
              { id: 'STANDBY', label: 'Standby', activeClass: 'bg-blue-600 text-white' },
              { id: 'SUCCESS', label: 'Success', activeClass: 'bg-emerald-600 text-white' },
              { id: 'FAILED', label: 'Mislukt', activeClass: 'bg-red-600 text-white' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                  statusFilter === f.id ? f.activeClass : 'text-neutral-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRequests.length > 0 ? (
          <div className="divide-y divide-[#1e202b] space-y-0.5">
            {filteredRequests.map((req) => {
              const isSuccess = req.status === 'SUCCESS';
              const isFailed = req.status === 'FAILED';

              return (
                <div
                  key={`${req.shiftDate}-${req.shiftBlock}`}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">
                        {req.shiftDate} &bull; {req.shiftBlock}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        ({req.startTime} - {req.endTime})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                      {isSuccess ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Reactie succesvol geplaatst (:{req.emoji}:)</span>
                        </span>
                      ) : isFailed ? (
                        <span className="text-red-400 font-medium flex items-center gap-1 truncate">
                          <XCircle className="w-3 h-3 stroke-[2.5] shrink-0" />
                          <span className="truncate">
                            {req.errorMessage || 'Technische fout bij plaatsen van reactie'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-blue-300 font-medium flex items-center gap-1">
                          <Zap className="w-3 h-3 fill-current text-blue-400" />
                          <span>
                            Standby &bull; wacht op vrijcheck-moment (
                            {req.shiftBlock.startsWith('M') ? '17:10' : '10:10'})
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">{renderStatusBadge(req)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-3 text-center text-xs text-neutral-400">
            {statusFilter === 'FAILED'
              ? 'Geen mislukte vrijchecks gevonden.'
              : 'Nog geen vrijchecks aangevraagd in deze weergave.'}
          </div>
        )}

        <div className="pt-1.5 border-t border-[#1e202b] text-[10px] text-neutral-400 leading-relaxed">
          Kanaal: <strong className="text-neutral-200">{settings?.channelName || '#nl-dist-runners-hlm'}</strong> &bull;
          De bot plaatst sub-seconde je emoji-reactie op Slack; wie het eerst reageert krijgt vrij van Picnic.
        </div>
      </div>
    </div>
  );
};
