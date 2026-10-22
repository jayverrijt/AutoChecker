import React from 'react';
import { ChevronDown, Calendar, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameWeek } from 'date-fns';
import { nl } from 'date-fns/locale';

function formatCapitalizedWeekRange(ws, we) {
  const startDay = format(ws, 'd');
  const startMonth = format(ws, 'MMM', { locale: nl }).replace('.', '');
  const endDay = format(we, 'd');
  const endMonth = format(we, 'MMM', { locale: nl }).replace('.', '');

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${startDay} ${cap(startMonth)} - ${endDay} ${cap(endMonth)}`;
}

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
  totalHours = '26.97',
  isLiveBotActive
}) => {
  // Format Month Year (e.g. "Oktober 2026")
  const monthYearString = format(currentDate, 'MMMM yyyy', { locale: nl });
  const capitalizedMonthYear = monthYearString.charAt(0).toUpperCase() + monthYearString.slice(1);

  // Generate 5 adjacent week tabs centered on currentDate (matching Teamwork)
  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekOffsets = [-1, 0, 1, 2, 3];

  const weekTabs = weekOffsets.map((offset) => {
    const ws = addWeeks(currentWeekStart, offset);
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const isCurrent = offset === 0;
    const label = formatCapitalizedWeekRange(ws, we);

    return {
      offset,
      startDate: ws,
      label,
      isCurrent
    };
  });

  return (
    <header className="pt-2 sm:pt-3 pb-0 bg-[#0e0f12] select-none sticky top-0 z-20 backdrop-blur-md">
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

        {/* Right Action Icons matching Teamwork: Calendar (today), Filter, Refresh */}
        <div className="flex items-center gap-3.5 text-neutral-300">
          {/* Calendar jump to today */}
          <button
            type="button"
            onClick={onGoToToday}
            className="p-1 hover:text-white transition-colors relative active:scale-90"
            title="Naar vandaag"
          >
            <Calendar className="w-5 h-5 stroke-[2]" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          </button>

          {/* Filter options */}
          <button
            type="button"
            className="p-1 hover:text-white transition-colors active:scale-90"
            title="Filter opties"
          >
            <SlidersHorizontal className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Refresh icon */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-1 hover:text-white transition-colors active:scale-90 ${
              isRefreshing ? 'animate-spin text-blue-400' : ''
            }`}
            title="Ververs Rooster"
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

      {/* Divider line under tabs */}
      <div className="border-b border-[#22242f] w-full" />

      {/* Teamwork Subheader: Week number & Scheduled hours */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#121316] border-b border-[#22242f]">
        <span className="text-sm font-bold text-white tracking-tight">
          Week {weekNumber || '43'}
        </span>
        <span className="text-xs text-neutral-400 font-medium">
          Ingeroosterd: <strong className="text-white font-bold">{totalHours}u</strong>
        </span>
      </div>
    </header>
  );
};
