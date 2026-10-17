import React from 'react';
import { Calendar, PlusCircle, Hourglass, CheckCircle2, Zap, AlertCircle } from 'lucide-react';
import { SlackEmoji } from './SlackEmoji';
import { SHIFT_BLOCK_MAP } from '../utils/constants';

export const ShiftCard = ({
  shift,
  date,
  isToday,
  onClick,
  onQuickToggleVrijcheck
}) => {
  const block = shift?.block || 'none';
  const blockInfo = SHIFT_BLOCK_MAP[block];
  const hasShift = block !== 'none';
  const reaction = shift?.reactionStatus;
  const isVrijcheckActive = shift?.vrijcheckActive !== false;

  // 1. NO SHIFT CASE
  if (!hasShift) {
    return (
      <div
        onClick={onClick}
        className="w-full bg-[#1e2025] hover:bg-[#252830] active:scale-[0.99] border border-[#292b33] rounded-xl px-4 py-3 cursor-pointer transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 font-medium text-sm">No shift</span>
        </div>
        <span className="text-xs text-neutral-500 group-hover:text-blue-400 font-medium transition-colors">
          + Kies M1-S3
        </span>
      </div>
    );
  }

  // 2. INGEROOSTERD (Active shift)
  const isReacted = reaction && reaction.success;

  return (
    <div
      onClick={onClick}
      className={`w-full rounded-xl p-3.5 cursor-pointer transition-all relative overflow-hidden active:scale-[0.99] shadow-sm select-none ${
        isReacted
          ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 border-2 border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
          : 'bg-[#2962ff] hover:bg-[#2457e5] border border-blue-500/30'
      }`}
    >
      {/* Top row: Icon, Time, Block Badge */}
      <div className="flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-100" />
          <span className="font-bold text-sm tracking-tight">
            {shift.startTime || blockInfo?.defaultTime?.split(' - ')[0] || '13:00'} -{' '}
            {shift.endTime || blockInfo?.defaultTime?.split(' - ')[1] || '21:30'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Block Pill */}
          <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-black px-2 py-0.5 rounded-md tracking-wider">
            {block}
          </span>
          {/* Reaction target emoji badge */}
          {blockInfo?.emoji && (
            <div className="flex items-center bg-black/30 backdrop-blur-sm rounded-md px-1.5 py-0.5 border border-white/10" title={`Reageert met :${blockInfo.emoji}:`}>
              <SlackEmoji name={blockInfo.emoji} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Middle row: Label "Ingeroosterd" */}
      <div className="mt-1 flex items-center justify-between">
        <span className="text-blue-100 text-xs font-medium">Ingeroosterd</span>

        {/* Vrijcheck status tag */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onQuickToggleVrijcheck();
          }}
          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-all ${
            isVrijcheckActive
              ? 'bg-blue-900/60 text-blue-200 border border-blue-400/40 hover:bg-blue-900'
              : 'bg-black/40 text-neutral-400 hover:text-white border border-white/10'
          }`}
          title="Klik om Vrijcheck in/uit te schakelen voor deze shift"
        >
          <Zap className={`w-3 h-3 ${isVrijcheckActive ? 'text-amber-300 fill-amber-300' : 'text-neutral-500'}`} />
          <span>{isVrijcheckActive ? 'Vrijcheck AAN' : 'Vrijcheck UIT'}</span>
        </div>
      </div>

      {/* Bottom row: Reaction feedback status */}
      {isReacted ? (
        <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center justify-between bg-black/20 rounded-lg px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="text-xs font-bold text-emerald-200 flex items-center gap-1">
              Gereageerd met <SlackEmoji name={reaction.emoji} size="sm" />
            </span>
          </div>
          <span className="text-[10px] text-emerald-100/90 font-mono">
            {reaction.latencyMs ? `${reaction.latencyMs}ms` : 'Gelukt!'}
          </span>
        </div>
      ) : reaction && reaction.success === false ? (
        <div className="mt-2.5 pt-2 border-t border-red-500/40 flex items-center justify-between bg-red-950/40 rounded-lg px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
            <span className="text-xs font-medium text-red-200">
              Reactie mislukt: {reaction.error || 'Fout'}
            </span>
          </div>
        </div>
      ) : isVrijcheckActive ? (
        <div className="mt-2 pt-1 flex items-center gap-1.5 text-[11px] text-blue-100/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Wacht op Day-Planning-Sender in #nl-dist-runners-hlm</span>
        </div>
      ) : null}
    </div>
  );
};
