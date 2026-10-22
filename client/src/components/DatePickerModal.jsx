import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { sounds } from '../utils/audio';

export const DatePickerModal = ({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  if (!isOpen) return null;

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    try { navigator.vibrate?.(10); } catch (_) {}
    sounds.playPop?.();
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    try { navigator.vibrate?.(10); } catch (_) {}
    sounds.playPop?.();
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleSelectDay = (day) => {
    try { navigator.vibrate?.(15); } catch (_) {}
    sounds.playPop?.();
    onSelectDate(day);
    onClose();
  };

  const handleSelectToday = () => {
    try { navigator.vibrate?.(20); } catch (_) {}
    sounds.playSuccess?.();
    const today = new Date();
    onSelectDate(today);
    onClose();
  };

  // Generate calendar days grid (Monday-start)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDayHeaders = ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO'];
  const monthTitle = format(currentMonth, 'MMMM yyyy', { locale: nl });
  const capitalizedMonthTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#161822] border border-[#2b2e40] rounded-3xl p-5 max-w-xs sm:max-w-sm w-full space-y-4 shadow-2xl animate-scaleUp select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close button */}
        <div className="flex items-center justify-between pb-1 border-b border-[#242738]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Kies een datum</h3>
              <p className="text-[10px] text-neutral-400">Navigeer door het rooster</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#222534] hover:bg-[#2b2f42] text-neutral-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl bg-[#1e2130] hover:bg-[#272b3e] text-neutral-300 hover:text-white flex items-center justify-center border border-[#2b2f42] active:scale-90 transition-all"
            title="Vorige maand"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-sm font-black text-white tracking-tight">
            {capitalizedMonthTitle}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-xl bg-[#1e2130] hover:bg-[#272b3e] text-neutral-300 hover:text-white flex items-center justify-center border border-[#2b2f42] active:scale-90 transition-all"
            title="Volgende maand"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-neutral-500">
          {weekDayHeaders.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((day) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentToday = isToday(day);
            const isInsideMonth = isSameMonth(day, currentMonth);

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={`h-9 w-full rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative active:scale-90 ${
                  isSelected
                    ? 'bg-[#3171f7] text-white shadow-md shadow-blue-500/30'
                    : isCurrentToday
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : isInsideMonth
                    ? 'hover:bg-[#242838] text-neutral-200'
                    : 'text-neutral-600 hover:bg-[#1a1c27]'
                }`}
              >
                <span>{format(day, 'd')}</span>
                {isCurrentToday && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-blue-400 absolute bottom-1"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Actions: Jump to Today & Close */}
        <div className="pt-2 flex items-center gap-2 border-t border-[#242738]">
          <button
            type="button"
            onClick={handleSelectToday}
            className="flex-1 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Naar Vandaag</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-[#222534] hover:bg-[#2a2e40] text-neutral-300 text-xs font-bold active:scale-95 transition-all"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
