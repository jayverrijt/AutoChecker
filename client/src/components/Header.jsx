import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export const Header = ({
  currentDate,
  onGoToToday,
  onPrevWeek,
  onNextWeek,
  weekNumber,
  isLiveBotActive
}) => {
  const monthYearString = format(currentDate, 'MMMM yyyy', { locale: nl });
  // Capitalize first letter (e.g. "Oktober 2026")
  const capitalizedMonthYear = monthYearString.charAt(0).toUpperCase() + monthYearString.slice(1);

  return (
    <header className="relative pt-2 pb-3 px-4 bg-[#141416] border-b border-[#202126] select-none">
      {/* Hanging Picnic Lightbulb cord & bulb at the very top */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-20">
        {/* Cord / wire */}
        <div className="w-[1.5px] h-3 bg-neutral-400"></div>
        {/* Lightbulb base */}
        <div className="w-2.5 h-1.5 bg-neutral-300 rounded-sm"></div>
        {/* Lightbulb glass body */}
        <div className="relative group">
          <div className="w-6 h-7 bg-amber-400 rounded-t-full rounded-b-md shadow-[0_0_12px_rgba(251,191,36,0.8)] flex items-center justify-center">
            {/* Filament */}
            <div className="w-2.5 h-3 border-t-2 border-x-2 border-amber-600 rounded-t-full opacity-80"></div>
          </div>
          {/* Subtle pulse ring */}
          <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-amber-300"></div>
        </div>
      </div>

      {/* Top row: Month dropdown & "Vandaag" button */}
      <div className="flex items-center justify-between mt-3 pt-2">
        <button
          className="flex items-center gap-1.5 text-xl font-bold text-white hover:text-neutral-200 transition-colors"
          onClick={() => {}}
        >
          <span>{capitalizedMonthYear}</span>
          <ChevronDown className="w-5 h-5 text-neutral-400" />
        </button>

        <button
          onClick={onGoToToday}
          className="flex items-center gap-1.5 text-sm font-semibold text-neutral-200 bg-[#22242a] hover:bg-[#2b2d35] active:scale-95 px-3 py-1.5 rounded-full transition-all border border-[#2e3038]"
        >
          <Calendar className="w-4 h-4 text-blue-400" />
          <span>Vandaag</span>
        </button>
      </div>

      {/* Week header row (e.g. Week 42) */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm font-bold tracking-tight text-neutral-400">
          Week {weekNumber}
        </span>

        {/* Quick week navigation buttons */}
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <button
            onClick={onPrevWeek}
            className="px-2 py-0.5 rounded hover:bg-[#22242a] text-neutral-400 hover:text-white"
          >
            ‹ Vorige
          </button>
          <span>•</span>
          <button
            onClick={onNextWeek}
            className="px-2 py-0.5 rounded hover:bg-[#22242a] text-neutral-400 hover:text-white"
          >
            Volgende ›
          </button>
        </div>
      </div>
    </header>
  );
};
