import React, { useRef, useState, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { Calendar, Zap } from 'lucide-react';
import { SHIFT_BLOCKS } from '../utils/constants';
import { formatDay2Letters, getShiftForBlock } from '../utils/shiftHelpers';
import { SlackEmoji } from './SlackEmoji';

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
      className={`px-3.5 py-1 pb-28 overflow-y-auto select-none scroll-smooth transition-all ${swipeAnimation}`}
    >
      {/* Days List with Sticky Date Headers & 5 Stacked Shift Cards */}
      <div className="divide-y divide-[#22242f]">
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
                isToday ? 'bg-blue-950/15 -mx-1.5 px-1.5 rounded-2xl' : ''
              }`}
            >
              {/* Left Column: Big Day Number + 2 Letters Weekday (MA, DI, WO, DO, VR, ZA, ZO) */}
              <div
                onClick={() => onSelectDate(dayDate)}
                className="w-9 sm:w-10 pt-1 flex flex-col items-center cursor-pointer shrink-0 select-none group sticky top-2 z-10"
              >
                <span
                  className={`text-xl sm:text-2xl font-black leading-none tracking-tight transition-transform group-active:scale-90 ${
                    isToday ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  {dayNumber}
                </span>
                <span
                  className={`text-[11px] font-black tracking-wider uppercase mt-1 transition-colors ${
                    isToday ? 'text-blue-400 font-extrabold' : 'text-neutral-400 group-hover:text-neutral-200'
                  }`}
                >
                  {dayName2}
                </span>
              </div>

              {/* Right Column: Exactly 5 Stacked Shift Cards (M1, M2, S1, S2, S3) with scroll animations */}
              <div className="flex-1 min-w-0 space-y-2">
                {SHIFT_BLOCKS.map((blockDef, index) => {
                  const shift = getShiftForBlock(shifts, dateKey, blockDef.id);
                  const isActive = shift.vrijcheckActive === true;
                  const isReacted = shift.reactionStatus?.success;
                  const timeDisplay = `${shift.startTime || blockDef.defaultTime.split(' - ')[0]} - ${shift.endTime || blockDef.defaultTime.split(' - ')[1]}`;

                  return (
                    <div
                      key={blockDef.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        onSelectDate(dayDate);
                        onOpenShiftModal(dayDate, shift, blockDef.id);
                      }}
                      style={{
                        animationDelay: `${index * 35}ms`
                      }}
                      className={`w-full rounded-2xl p-2.5 sm:p-3 flex items-center justify-between cursor-pointer border transition-all duration-150 active:scale-[0.98] select-none animate-slideUp shadow-sm hover:shadow-md ${
                        isReacted
                          ? 'bg-gradient-to-r from-emerald-600/90 to-teal-700/90 border-emerald-400/80 text-white'
                          : isActive
                          ? 'bg-[#2b68ee] hover:bg-[#3270f5] border-blue-400 text-white shadow-md shadow-blue-600/25 ring-1 ring-blue-400/40'
                          : 'bg-[#181a22] hover:bg-[#20232e] border-[#262835] text-neutral-200'
                      }`}
                    >
                      {/* Left: Calendar icon + Time range + Status Subtitle */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-2 rounded-xl shrink-0 transition-colors ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-[#222533] text-neutral-400'
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                            <span>{timeDisplay}</span>
                          </div>

                          <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-[11px]">
                            {isReacted ? (
                              <span className="text-emerald-100 font-semibold flex items-center gap-1">
                                ✓ Vrij gereageerd ({shift.reactionStatus.latencyMs}ms)
                              </span>
                            ) : isActive ? (
                              <span className="text-amber-200 font-bold flex items-center gap-1 animate-pulse">
                                <Zap className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                                <span>Vrijcheck Scherp • {blockDef.postTime}</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400 font-medium truncate">
                                {blockDef.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Badge with [M1] / [M2] / [S1] / [S2] / [S3] and emoji */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                        <div className="scale-90">
                          <SlackEmoji name={blockDef.emoji} size="xs" />
                        </div>
                        <div
                          className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-black text-xs tracking-wide transition-colors ${
                            isReacted
                              ? 'bg-black/30 text-white border border-emerald-300/40'
                              : isActive
                              ? 'bg-black/25 text-white border border-white/30'
                              : 'bg-[#242735] text-neutral-300 border border-[#313546]'
                          }`}
                        >
                          {blockDef.label}
                        </div>
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
