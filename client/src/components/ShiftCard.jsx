import React from 'react';
import { Calendar, CheckCircle2, Zap, AlertCircle, Clock } from 'lucide-react';
import { SlackEmoji } from './SlackEmoji';
import { SHIFT_BLOCKS, SHIFT_BLOCK_MAP } from '../utils/constants';

export const ShiftCard = ({
  shift,
  date,
  isToday,
  onOpenBlockModal,
  onQuickToggleVrijcheck
}) => {
  const selectedBlockId = shift?.block || 'none';
  const selectedBlockInfo = SHIFT_BLOCK_MAP[selectedBlockId];
  const hasShift = selectedBlockId !== 'none';
  const reaction = shift?.reactionStatus;
  const isVrijcheckActive = shift?.vrijcheckActive !== false;
  const isReacted = reaction && reaction.success;

  return (
    <div
      className={`w-full rounded-2xl p-3.5 transition-all border relative overflow-hidden select-none shadow-sm ${
        isReacted
          ? 'bg-gradient-to-r from-blue-900/60 via-blue-800/50 to-indigo-900/60 border-emerald-500/70 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
          : hasShift
          ? isVrijcheckActive
            ? 'bg-[#1b2234] border-blue-500/40 hover:border-blue-400'
            : 'bg-[#191b22] border-[#292b35] hover:border-neutral-700'
          : 'bg-[#18191f] border-[#262833] hover:border-[#333644]'
      }`}
    >
      {/* Top row: Status info */}
      <div className="flex items-center justify-between">
        {hasShift ? (
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight">
              {shift.startTime || selectedBlockInfo?.defaultTime?.split(' - ')[0] || '13:00'} -{' '}
              {shift.endTime || selectedBlockInfo?.defaultTime?.split(' - ')[1] || '21:30'}
            </span>
            <span className="text-[11px] text-neutral-400">
              ({selectedBlockInfo?.period === 'OCHTEND' ? 'Ochtend' : 'Middag'})
            </span>
          </div>
        ) : (
          <span className="text-xs font-semibold text-neutral-400">
            Geen shift geselecteerd
          </span>
        )}

        {hasShift && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickToggleVrijcheck();
            }}
            className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
              isVrijcheckActive
                ? 'bg-blue-600/30 text-blue-300 border border-blue-400/50 hover:bg-blue-600/40'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white'
            }`}
          >
            <Zap className={`w-3 h-3 ${isVrijcheckActive ? 'text-amber-300 fill-amber-300' : 'text-neutral-500'}`} />
            <span>{isVrijcheckActive ? 'Vrijcheck AAN' : 'Vrijcheck UIT'}</span>
          </button>
        )}
      </div>

      {/* Reaction feedback status */}
      {isReacted ? (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between bg-black/20 rounded-xl px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
              Gereageerd met <SlackEmoji name={reaction.emoji} size="xs" />
            </span>
          </div>
          <span className="text-[10px] text-emerald-200/90 font-mono">
            {reaction.latencyMs ? `${reaction.latencyMs}ms` : 'Gelukt!'}
          </span>
        </div>
      ) : hasShift && isVrijcheckActive ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-300/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>
            {selectedBlockInfo?.period === 'OCHTEND'
              ? 'Wacht op 17:10 bericht (dag tevoren)'
              : 'Wacht op 10:10 bericht (vandaag)'}
          </span>
        </div>
      ) : null}

      {/* Row of ALL 5 SHIFTS (M1, M2, S1, S2, S3) - User taps one to open Slide-to-Vrijcheck */}
      <div className="mt-2.5 pt-2 border-t border-[#252834]">
        <div className="flex items-center justify-between gap-1.5">
          {SHIFT_BLOCKS.map((b) => {
            const isThisSelected = selectedBlockId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onOpenBlockModal(b.id)}
                className={`flex-1 py-1.5 px-0.5 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 ${
                  isThisSelected
                    ? isVrijcheckActive
                      ? 'bg-gradient-to-b from-blue-600 to-indigo-600 border-blue-400 text-white shadow-md shadow-blue-600/30 font-black'
                      : 'bg-blue-600/30 border-blue-500 text-white font-bold'
                    : 'bg-[#21232c] hover:bg-[#282a35] border-[#2c2e39] text-neutral-300'
                }`}
              >
                <span className="text-xs font-black tracking-tight">{b.label}</span>
                <div className="mt-0.5 scale-90">
                  <SlackEmoji name={b.emoji} size="xs" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
