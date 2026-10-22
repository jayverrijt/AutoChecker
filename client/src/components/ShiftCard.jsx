import React from 'react';
import { Calendar, CalendarX, Zap, Check } from 'lucide-react';
import { getBlockInfo } from '../utils/constants';

export const ShiftCard = ({
  shift,
  date,
  isVrij = false,
  vrijTime = '07:00 - 23:00',
  isGeenShift = false,
  onClick,
  onQuickToggleVrijcheck
}) => {
  // 1. Geen shift Card (Matches Screenshot 1 e.g. 4 WO, 5 DO)
  if (isGeenShift || (!shift && !isVrij)) {
    return (
      <div
        onClick={onClick}
        className="w-full bg-[#383a42] hover:bg-[#40434b] active:scale-[0.99] border border-white/5 rounded-2xl px-4 py-3.5 flex items-center justify-between cursor-pointer transition-all select-none shadow-sm"
      >
        <span className="text-sm font-semibold text-neutral-300">
          Geen shift
        </span>
      </div>
    );
  }

  // 2. Vrij Card (Matches Screenshot 1 e.g. 8 ZO)
  if (isVrij) {
    return (
      <div
        onClick={onClick}
        className="w-full bg-[#383a42] hover:bg-[#40434b] active:scale-[0.99] border border-white/5 rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all select-none shadow-sm"
      >
        <div className="flex items-center gap-3">
          <CalendarX className="w-5 h-5 text-neutral-300 stroke-[2.2]" />
          <div>
            <div className="font-bold text-white text-sm tracking-tight leading-tight">
              {vrijTime}
            </div>
            <div className="text-xs text-neutral-300 font-medium mt-0.5">
              Vrij
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Ingeroosterd Shift Card (Matches Screenshot 1 e.g. 6 VR, 7 ZA)
  const blockDef = getBlockInfo(shift.block);
  const startTime = shift.startTime || blockDef?.defaultTime?.split(' - ')[0] || '10:15';
  const endTime = shift.endTime || blockDef?.defaultTime?.split(' - ')[1] || '13:00';
  const isVrijcheckActive = shift.vrijcheckActive !== false;
  const reactionStatus = shift.reactionStatus;

  return (
    <div
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-3.5 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] select-none shadow-md relative overflow-hidden group ${
        reactionStatus?.success
          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white shadow-emerald-500/20'
          : 'bg-[#3171f7] hover:bg-[#2b65de] text-white shadow-blue-500/20'
      }`}
    >
      {/* Left side: Calendar icon + Time + Ingeroosterd */}
      <div className="flex items-center gap-3">
        <Calendar className="w-5 h-5 text-white stroke-[2.3] shrink-0" />
        <div>
          <div className="font-bold text-white text-base tracking-tight leading-tight">
            {startTime} - {endTime}
          </div>
          <div className="text-xs text-white/90 font-medium mt-0.5 flex items-center gap-1.5">
            <span>Ingeroosterd</span>
            {isVrijcheckActive && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-bold">
                <Zap className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                <span>Vrijcheck</span>
              </span>
            )}
            {reactionStatus?.success && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500 px-1.5 py-0.2 rounded-full font-bold">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                <span>Gereageerd</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Dark Pill with Shift Block (e.g. M2, S1, S1-S2-S3) */}
      <div className="flex items-center gap-2">
        <div className="bg-[#182a52] text-white font-bold text-xs px-2.5 py-1.5 rounded-lg tracking-wide border border-white/10 shadow-inner">
          {shift.block}
        </div>
      </div>
    </div>
  );
};
