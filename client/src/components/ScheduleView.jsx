import React, { useRef, useState, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { Calendar, Zap, Plus } from 'lucide-react';
import { formatDay2Letters, getDayShifts } from '../utils/shiftHelpers';

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
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
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
      className={`px-3.5 py-2 pb-28 overflow-y-auto select-none scroll-smooth transition-all ${swipeAnimation}`}
    >
      {/* Days List matching Teamwork 1-to-1 */}
      <div className="divide-y divide-[#22242f]">
        {days.map((dayDate) => {
          const dateKey = format(dayDate, 'yyyy-MM-dd');
          const dayNumber = format(dayDate, 'd');
          const dayName2 = formatDay2Letters(dayDate);
          const isToday = isSameDay(dayDate, selectedDate);
          const dayShifts = getDayShifts(shifts, dateKey);

          return (
            <div
              key={dateKey}
              id={`day-${dateKey}`}
              className={`py-3 flex items-start gap-3 sm:gap-4 transition-colors ${
                isToday ? 'bg-blue-950/10 -mx-1.5 px-1.5 rounded-xl' : ''
              }`}
            >
              {/* Left Column: Day Number + 2 Letters Weekday (MA, DI, WO, DO, VR, ZA, ZO) */}
              <div
                onClick={() => onSelectDate(dayDate)}
                className="w-8 sm:w-9 pt-1 flex flex-col items-center cursor-pointer shrink-0 select-none group sticky top-2 z-10"
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

              {/* Right Column: Only the runner's actual scheduled shifts or "Geen shift" */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {dayShifts.length > 0 ? (
                  dayShifts.map((shift) => {
                    const isRt = shift.isRt || shift.block === 'RT';
                    const isVrijcheck = Boolean(shift.vrijcheckActive);
                    const isReacted = Boolean(shift.reactionStatus?.success);

                    return (
                      <div
                        key={shift.id || `${dateKey}-${shift.block}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onSelectDate(dayDate);
                          onOpenShiftModal(dayDate, shift, shift.block);
                        }}
                        className={`w-full rounded-xl px-3.5 py-2.5 sm:py-3 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] select-none shadow-sm ${
                          isReacted
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white'
                            : 'bg-[#214aa2] hover:bg-[#2552b3] text-white'
                        }`}
                      >
                        {/* Left: Calendar icon + Time range + Status */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="text-white/80 p-0.5 shrink-0">
                            <Calendar className="w-4 h-4 stroke-[2]" />
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white tracking-tight leading-snug truncate">
                              {shift.startTime} - {shift.endTime}
                            </div>

                            <div className="text-xs text-blue-200/80 font-medium leading-none mt-0.5 flex items-center gap-1.5">
                              {isReacted ? (
                                <span className="text-emerald-200 font-bold">
                                  ✓ Voltooid ({shift.reactionStatus.latencyMs}ms)
                                </span>
                              ) : isVrijcheck ? (
                                <span className="text-amber-300 font-bold flex items-center gap-1 animate-pulse">
                                  <Zap className="w-3 h-3 fill-amber-300" />
                                  Vrijcheck actief
                                </span>
                              ) : (
                                <span>{shift.status || 'Voltooid'}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Badge Pill (e.g. S2, S3, S1-S2-S3, RT) */}
                        <div className="shrink-0 ml-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wide shadow-sm inline-block ${
                              isRt
                                ? 'bg-[#a22a7f] text-white'
                                : 'bg-[#2e5bbd] text-white'
                            }`}
                          >
                            {shift.block}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Geen shift Card (Matches Teamwork Screenshot 2 e.g. 21 WO) */
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectDate(dayDate);
                      onOpenShiftModal(dayDate, null, 'M2');
                    }}
                    className="w-full bg-[#1c1d22] hover:bg-[#23242c] active:scale-[0.99] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all select-none shadow-sm"
                  >
                    <span className="text-xs sm:text-sm font-medium text-neutral-400">
                      Geen shift
                    </span>
                    <Plus className="w-3.5 h-3.5 text-neutral-500 opacity-60" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
