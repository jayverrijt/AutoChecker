import React, { useRef, useState, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { Check, AlertCircle } from 'lucide-react';
import { formatDay2Letters, getScheduledDayBlocks } from '../utils/shiftHelpers';

export const ScheduleView = ({
  days,
  selectedDate,
  onSelectDate,
  shifts,
  onToggleVrijcheck,
  onPrevWeek,
  onNextWeek
}) => {
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const [swipeAnimation, setSwipeAnimation] = useState('');

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

    if (Math.abs(deltaX) > 45 && Math.abs(deltaY) < Math.abs(deltaX) * 0.8) {
      if (deltaX < 0) {
        if (onNextWeek) {
          try {
            navigator.vibrate?.(20);
          } catch (_) {}
          setSwipeAnimation('animate-slideInRight');
          onNextWeek();
        }
      } else {
        if (onPrevWeek) {
          try {
            navigator.vibrate?.(20);
          } catch (_) {}
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
      <div className="divide-y divide-[#232532]">
        {days.map((dayDate) => {
          const dateKey = format(dayDate, 'yyyy-MM-dd');
          const dayNumber = format(dayDate, 'd');
          const dayName2 = formatDay2Letters(dayDate);
          const isToday = isSameDay(dayDate, selectedDate);
          const scheduledBlocks = getScheduledDayBlocks(shifts, dateKey);

          return (
            <div
              key={dateKey}
              id={`day-${dateKey}`}
              className={`py-3 flex items-start gap-3 sm:gap-4 transition-colors ${
                isToday ? 'bg-blue-950/10 -mx-1.5 px-1.5 rounded-xl' : ''
              }`}
            >
              {/* Left Column: Day Number + 2 Letters Weekday */}
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

              {/* Right Column: ONLY actually scheduled (and uncoupled) shifts from iCal */}
              <div className="flex-1 min-w-0 space-y-2">
                {scheduledBlocks.length > 0 ? (
                  scheduledBlocks.map(({ blockDef, shift }) => {
                    const isChecked = Boolean(shift?.vrijcheckActive);
                    const status =
                      shift?.vrijcheckStatus ||
                      (shift?.reactionStatus?.success
                        ? 'SUCCESS'
                        : shift?.reactionStatus && !shift?.reactionStatus.success
                        ? 'FAILED'
                        : isChecked
                        ? 'STANDBY'
                        : null);
                    const isSuccess = status === 'SUCCESS';
                    const isFailed = status === 'FAILED';
                    const timeLabel =
                      shift?.startTime && shift?.endTime
                        ? `${shift.startTime} - ${shift.endTime}`
                        : blockDef.defaultTime;

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
                          isSuccess
                            ? 'bg-[#10241b] border-emerald-500/70 text-white'
                            : isFailed
                            ? 'bg-red-950/30 border-red-500/60 text-white'
                            : isChecked
                            ? 'bg-[#152038] border-blue-500 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-500/40'
                            : 'bg-[#15161b] hover:bg-[#1a1b22] border-[#383a46] text-white'
                        }`}
                      >
                        {/* Left: Square Checkbox + Time */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSuccess
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : isFailed
                                ? 'bg-red-600 border-red-500 text-white'
                                : isChecked
                                ? 'bg-[#3171f7] border-[#3171f7] text-white'
                                : 'border-white bg-transparent'
                            }`}
                          >
                            {(isChecked || isSuccess || isFailed) && (
                              <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-base font-bold text-white tracking-tight leading-none">
                              {timeLabel}
                            </div>

                            {isSuccess ? (
                              <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                                ✓ Reactie succesvol geplaatst ({shift?.reactionStatus?.latencyMs || 110}ms)
                              </div>
                            ) : isFailed ? (
                              <div className="text-[10px] text-red-400 font-semibold mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>Mislukt: {shift?.reactionStatus?.error || 'Technische fout'}</span>
                              </div>
                            ) : isChecked ? (
                              <div className="text-[10px] text-blue-300 font-semibold mt-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                                <span>Standby • {blockDef.postTime} vrijcheck</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Right: Type & Shift Block Badges */}
                        <div className="shrink-0 ml-3 flex items-center gap-1.5">
                          <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-[#252834] text-neutral-300">
                            Trip
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide transition-colors inline-block ${
                              isSuccess
                                ? 'bg-emerald-600 text-white'
                                : isFailed
                                ? 'bg-red-600 text-white'
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
                  })
                ) : (
                  <div className="w-full rounded-xl px-4 py-3.5 bg-[#121318] border border-[#222430] text-xs text-neutral-400 font-medium">
                    Geen ingeroosterde shifts
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
