import React from 'react';
import { ChevronDown, Calendar, RotateCcw } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
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
  weekNumber
}) => {
  const monthYearString = format(currentDate, 'MMMM yyyy', { locale: nl });
  const capitalizedMonthYear = monthYearString.charAt(0).toUpperCase() + monthYearString.slice(1);

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
    <header className="pt-notch-safe pb-0 bg-[#0e0f12] select-none sticky top-0 z-20 backdrop-blur-md">
      {/* Top row: Month Dropdown & Only 2 Header Action Icons (Agenda/Vandaag & Reload) */}
      <div className="flex items-center justify-between px-4 pb-2">
        <div
          onClick={onOpenDatePicker}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 active:scale-95 transition-all"
          title="Kies een datum"
        >
          <span className="text-xl font-bold text-white tracking-tight">{capitalizedMonthYear}</span>
          <ChevronDown className="w-5 h-5 text-neutral-400 stroke-[2.5]" />
        </div>

        {/* Right Action Icons: ONLY Calendar (jump to today) and Reload (ververs iCal/shifts) */}
        <div className="flex items-center gap-3.5 text-neutral-300">
          <button
            type="button"
            onClick={onGoToToday}
            className="p-1 hover:text-white transition-colors relative active:scale-90"
            title="Naar vandaag"
          >
            <Calendar className="w-5 h-5 stroke-[2]" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-1 hover:text-white transition-colors active:scale-90 ${
              isRefreshing ? 'animate-spin text-blue-400' : ''
            }`}
            title="Ververs iCal & Rooster"
          >
            <RotateCcw className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
      </div>

      {/* Week Tabs Strip */}
      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar px-4 pt-1">
        {weekTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => onSelectDate(tab.startDate)}
            className={`text-sm tracking-tight whitespace-nowrap transition-colors relative pb-2.5 font-medium ${
              tab.isCurrent ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.isCurrent && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#3171f7] rounded-full animate-fadeIn" />
            )}
          </button>
        ))}
      </div>

      <div className="border-b border-[#22242f] w-full" />

      <div className="flex items-center px-4 py-2 bg-[#121316] border-b border-[#22242f]">
        <span className="text-sm font-bold text-white tracking-tight">Week {weekNumber || '43'}</span>
      </div>
    </header>
  );
};
