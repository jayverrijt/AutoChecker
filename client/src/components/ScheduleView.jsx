import React, { useRef, useState, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { Check, Zap } from 'lucide-react';
import { SHIFT_BLOCKS } from '../utils/constants';
import { formatDay2Letters, getShiftForBlock } from '../utils/shiftHelpers';

export const ScheduleView = ({
  days,
  selectedDate,
  onSelectDate,
  shifts,
  onOpenShiftModal,
  onToggleVrijcheck,
  onPrevWeek,
  onNextWeek
}) => {
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const [swipeAnimation, setSwipeAnimation] = useState('');

  // Trigger smooth slide animation when days change
  useEffect(() => {
    setSwipeAnimation('animate-fadeIn');
    const t = setTimeout(() => setSwipeAnimation(''), 250);
    return () => clearTimeout(t);
  }, [days[0]?.toISOString()]);

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Primarily horizontal swipe of at least 45px
    if (Math.abs(deltaX) > 45 && Math.abs(deltaY) < Math.abs(deltaX) * 0.8) {
      if (deltaX < 0) {
        // Swiped left -> Next week
        if (onNextWeek) {
          try { navigator.vibrate?.(20); } catch (_) {}
          setSwipeAnimation('animate-slideInRight');
          onNextWeek();
        }
      } else {
        // Swiped right -> Previous week
        if (onPrevWeek) {
          try { navigator.vibrate?.(20); } catch (_) {}
          setSwipeAnimation('animate-slideInLeft');
          onPrevWeek();
        }
      }
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`px-3 sm:px-4 py-2 pb-28 overflow-y-auto select-none scroll-smooth transition-all ${swipeAnimation}`}
    >
      {/* Days List with Sticky Date Headers & exactly the 5 blocks per day */}
      <div className="divide-y divide-[#232532]">
        {days.map((dayDate) => {
          const dateKey = format(dayDate, 'yyyy-MM-dd');
          const dayNumber = format(dayDate, 'd');
          const dayName2 = formatDay2Letters(dayDate);
          const isToday = isSameDay(dayDate, selectedDate);

          return (
            <div
              key={dateKey}
              id={`day-${dateKey}`}
              className={`py-3 flex items-start gap-3 sm:gap-4 transition-colors ${
                isToday ? 'bg-blue-950/10 -mx-1.5 px-1.5 rounded-xl' : ''
              }`}
            >
              {/* Left Column: Big Day Number + 2 Letters Weekday (MA, DI, WO, DO, VR, ZA, ZO) */}
              <div
                onClick={() => onSelectDate(dayDate)}
                className="w-8 sm:w-9 pt-1.5 flex flex-col items-center cursor-pointer shrink-0 select-none group sticky top-2 z-10"
              >
                <span
                  className={`text-xl font-bold leading-none tracking-tight transition-transform group-active:scale-90 ${
                    isToday ? 'text-[#3171f7]' : 'text-white'
                  }`}
                >
                  {dayNumber}
                </span>
                <span
                  className={`text-[11px] font-bold tracking-wider uppercase mt-1 transition-colors ${
                    isToday ? 'text-[#3171f7]' : 'text-neutral-400 group-hover:text-neutral-200'
                  }`}
                >
                  {dayName2}
                </span>
              </div>

              {/* Right Column: Exactly the 5 Shift Blocks (M1, M2, S1, S2, S3) matching screenshot */}
              <div className="flex-1 min-w-0 space-y-2">
                {SHIFT_BLOCKS.map((blockDef) => {
                  const shift = getShiftForBlock(shifts, dateKey, blockDef.id);
                  const isChecked = Boolean(shift?.vrijcheckActive);
                  const isReacted = Boolean(shift?.reactionStatus?.success);

                  return (
                    <div
                      key={blockDef.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        onSelectDate(dayDate);
                        onToggleVrijcheck(dateKey, blockDef.id);
                      }}
                      className={`w-full rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] select-none border ${
                        isReacted
                          ? 'bg-[#10241b] border-emerald-500/70 text-white'
                          : isChecked
                          ? 'bg-[#152038] border-blue-500 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-500/40'
                          : 'bg-[#15161b] hover:bg-[#1a1b22] border-[#383a46] text-white'
                      }`}
                    >
                      {/* Left: Square Checkbox + Time */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Square Checkbox (matching screenshot) */}
                        <div
                          className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-all ${
                            isReacted
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : isChecked
                              ? 'bg-[#3171f7] border-[#3171f7] text-white'
                              : 'border-white bg-transparent'
                          }`}
                        >
                          {(isChecked || isReacted) && (
                            <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                          )}
                        </div>

                        {/* Shift Times */}
                        <div className="min-w-0">
                          <div className="text-base font-bold text-white tracking-tight leading-none">
                            {blockDef.defaultTime}
                          </div>

                          {isReacted ? (
                            <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                              ✓ Vrij gereageerd ({shift.reactionStatus.latencyMs}ms)
                            </div>
                          ) : isChecked ? (
                            <div className="text-[10px] text-blue-300 font-semibold mt-1 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                              <span>Vrijcheck actief • {blockDef.postTime} release</span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Right: Pill Badge (M1, M2, S1, S2, S3) */}
                      <div className="shrink-0 ml-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide transition-colors inline-block ${
                            isReacted
                              ? 'bg-emerald-600 text-white'
                              : isChecked
                              ? 'bg-[#3171f7] text-white'
                              : 'bg-[#383a45] text-white'
                          }`}
                        >
                          {blockDef.id}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
