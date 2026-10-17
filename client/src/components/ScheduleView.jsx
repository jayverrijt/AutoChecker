import React from 'react';
import { format, isSameDay, getISOWeek } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ShiftCard } from './ShiftCard';

export const ScheduleView = ({
  days,
  selectedDate,
  onSelectDate,
  shifts,
  onOpenShiftModal,
  onToggleVrijcheck
}) => {
  return (
    <div className="px-3 py-3 space-y-3 pb-24 overflow-y-auto">
      {days.map((dayDate) => {
        const dateKey = format(dayDate, 'yyyy-MM-dd');
        const dayNumber = format(dayDate, 'd');
        const dayName = format(dayDate, 'EEE', { locale: nl }).toUpperCase();
        const isSelected = isSameDay(dayDate, selectedDate);
        const shift = shifts[dateKey];

        return (
          <div
            key={dateKey}
            className="flex items-start gap-3.5 group transition-all"
          >
            {/* Left Column: Day number & Weekday (matching Image 2) */}
            <div
              onClick={() => onSelectDate(dayDate)}
              className="w-10 flex flex-col items-center pt-1.5 cursor-pointer shrink-0 select-none"
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
                className={`text-[11px] font-semibold tracking-wider mt-0.5 ${
                  isSelected ? 'text-blue-400 font-bold' : 'text-neutral-400'
                }`}
              >
                {dayName}
              </span>
            </div>

            {/* Right Column: Shift card */}
            <div className="flex-1 min-w-0">
              <ShiftCard
                shift={shift}
                date={dayDate}
                isToday={isSelected}
                onClick={() => {
                  onSelectDate(dayDate);
                  onOpenShiftModal(dayDate);
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
