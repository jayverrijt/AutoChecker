import React from 'react';
import { ChevronDown, Calendar, RotateCcw } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameWeek } from 'date-fns';
import { nl } from 'date-fns/locale';

export const Header = ({
  currentDate,
  onSelectDate,
  onGoToToday,
  onOpenDatePicker,
  onPrevWeek,
  onNextWeek,
  onRefresh,
  isRefreshing = false,
  weekNumber,
  isLiveBotActive,
  isServerConnected = false
}) => {
  // Format Month Year (e.g. "November 2026")
  const monthYearString = format(currentDate, 'MMMM yyyy', { locale: nl });
  const capitalizedMonthYear = monthYearString.charAt(0).toUpperCase() + monthYearString.slice(1);

  // Generate 5 adjacent week tabs centered on currentDate (matching Teamwork)
  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekOffsets = [-1, 0, 1, 2, 3];

  const weekTabs = weekOffsets.map((offset) => {
    const ws = addWeeks(currentWeekStart, offset);
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const isCurrent = offset === 0;

    // Label e.g. "12 Okt - 18 Okt"
    const startStr = format(ws, 'd MMM', { locale: nl }).replace('.', '');
    const endStr = format(we, 'd MMM', { locale: nl }).replace('.', '');
    const label = `${startStr} - ${endStr}`;

    return {
      offset,
      startDate: ws,
      label,
      isCurrent
    };
  });

  return (
    <header className="pt-3.5 sm:pt-4 pb-0 bg-[#0e0f12] select-none sticky top-0 z-20 backdrop-blur-md">
      {/* Top row: Month Dropdown & Header Action Icons (Matches Teamwork screenshot exactly) */}
      <div className="flex items-center justify-between px-4 pb-2">
        {/* Month Dropdown -> Opens DatePickerModal */}
        <div
          onClick={onOpenDatePicker}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 active:scale-95 transition-all"
          title="Kies een datum"
        >
          <span className="text-xl font-bold text-white tracking-tight">
            {capitalizedMonthYear}
          </span>
          <ChevronDown className="w-5 h-5 text-neutral-400 stroke-[2.5]" />
        </div>

        {/* Right Action Icons: Calendar (jump to today) & Refresh */}
        <div className="flex items-center gap-2.5 text-neutral-300">
          {/* 24/7 Cloud status badge */}
          {isServerConnected ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>24/7 Server</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-neutral-400 text-[10px] font-medium">
              <span>Lokaal</span>
            </span>
          )}

          {/* Calendar jump to today */}
          <button
            type="button"
            onClick={onGoToToday}
            className="p-1.5 hover:text-white transition-colors relative active:scale-90"
            title="Naar vandaag"
          >
            <Calendar className="w-5 h-5 stroke-[2]" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          </button>

          {/* Refresh icon */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-1.5 hover:text-white transition-colors active:scale-90 ${
              isRefreshing ? 'animate-spin text-blue-400' : ''
            }`}
            title="Ververs Slack & Rooster"
          >
            <RotateCcw className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
      </div>

      {/* Week Tabs Strip (Matches Teamwork screenshot: text tabs with active bottom blue indicator bar) */}
      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar px-4 pt-1">
        {weekTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => onSelectDate(tab.startDate)}
            className={`text-sm tracking-tight whitespace-nowrap transition-colors relative pb-2.5 font-medium ${
              tab.isCurrent
                ? 'text-white font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.isCurrent && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#3171f7] rounded-full animate-fadeIn" />
            )}
          </button>
        ))}
      </div>

      {/* Horizontal divider line running across under week tabs */}
      <div className="border-b border-[#22242f] w-full" />
    </header>
  );
};
