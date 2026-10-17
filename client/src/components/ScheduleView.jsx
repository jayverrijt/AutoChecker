import React, { useState, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ShiftCard } from './ShiftCard';
import { Clock, Radio, Zap } from 'lucide-react';
import { isCriticalListeningWindow } from '../utils/constants';

export const ScheduleView = ({
  days,
  selectedDate,
  onSelectDate,
  shifts,
  onOpenShiftModal,
  onToggleVrijcheck
}) => {
  const [criticalWindow, setCriticalWindow] = useState(isCriticalListeningWindow());

  // Check critical window every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCriticalWindow(isCriticalListeningWindow());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="px-3 py-3 space-y-3 pb-24 overflow-y-auto">
      {/* Timing Schedule Rules Card */}
      <div className="bg-[#181920] border border-[#272934] rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Vrijcheck Slack Release Tijden</span>
          </div>
          {criticalWindow.active ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {criticalWindow.target} LUISTER-VENSTER ACTIEF
            </span>
          ) : (
            <span className="text-[10px] text-neutral-400 font-mono">#nl-dist-runners-hlm</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-[#1f212b] border border-[#2c2f3d] rounded-xl p-2.5">
            <div className="font-bold text-amber-300 flex items-center gap-1">
              <span>🌅 Ochtend (M1, M2)</span>
            </div>
            <div className="text-white font-black text-xs mt-0.5">17:10 uur</div>
            <div className="text-[10px] text-neutral-400">Dag van tevoren</div>
          </div>

          <div className="bg-[#1f212b] border border-[#2c2f3d] rounded-xl p-2.5">
            <div className="font-bold text-blue-300 flex items-center gap-1">
              <span>☀️ Middag (S1, S2, S3)</span>
            </div>
            <div className="text-white font-black text-xs mt-0.5">10:10 uur</div>
            <div className="text-[10px] text-neutral-400">Zelfde dag</div>
          </div>
        </div>

        {criticalWindow.active && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-2 flex items-center gap-2 text-[11px] text-emerald-200">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
            <span>De bot luistert deze hele minuut continu om de post op de milliseconde te vangen!</span>
          </div>
        )}
      </div>

      {/* Week Days List */}
      {days.map((dayDate) => {
        const dateKey = format(dayDate, 'yyyy-MM-dd');
        const dayNumber = format(dayDate, 'd');
        const dayName = format(dayDate, 'EEE', { locale: nl }).toUpperCase();
        const isSelected = isSameDay(dayDate, selectedDate);
        const shift = shifts[dateKey];

        return (
          <div
            key={dateKey}
            className="flex items-start gap-2.5 group transition-all"
          >
            {/* Left Column: Day number & Weekday */}
            <div
              onClick={() => onSelectDate(dayDate)}
              className="w-10 flex flex-col items-center pt-2 cursor-pointer shrink-0 select-none"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-neutral-200 group-hover:text-white'
                }`}
              >
                {dayNumber}
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wider mt-0.5 ${
                  isSelected ? 'text-blue-400 font-bold' : 'text-neutral-400'
                }`}
              >
                {dayName}
              </span>
            </div>

            {/* Right Column: Shift card with all 5 blocks M1-S3 */}
            <div className="flex-1 min-w-0">
              <ShiftCard
                shift={shift}
                date={dayDate}
                isToday={isSelected}
                onOpenBlockModal={(blockId) => {
                  onSelectDate(dayDate);
                  onOpenShiftModal(dayDate, blockId);
                }}
                onQuickToggleVrijcheck={() => onToggleVrijcheck(dateKey)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
