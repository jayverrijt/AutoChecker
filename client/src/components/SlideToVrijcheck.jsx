import React, { useState, useRef, useEffect } from 'react';
import { Zap, Check, ChevronRight, RotateCcw } from 'lucide-react';
import { sounds } from '../utils/audio';

export const SlideToVrijcheck = ({
  isActive = false,
  onConfirm,
  onDisable,
  disabled = false,
  label = 'Schuif om vrij te checken'
}) => {
  const [dragProgress, setDragProgress] = useState(isActive ? 1 : 0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(isActive);
  const trackRef = useRef(null);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setIsCompleted(isActive);
    setDragProgress(isActive ? 1 : 0);
  }, [isActive]);

  const handleStart = (clientX) => {
    if (disabled || isCompleted) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = clientX;
  };

  const handleMove = (clientX) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const thumbWidth = 48;
    const maxDistance = trackRect.width - thumbWidth - 8; // 4px padding each side
    if (maxDistance <= 0) return;

    const currentX = clientX - trackRect.left - thumbWidth / 2;
    const progress = Math.min(Math.max(currentX / maxDistance, 0), 1);
    setDragProgress(progress);

    if (progress >= 0.88 && !isCompleted) {
      triggerSuccess();
    }
  };

  const handleEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (dragProgress >= 0.88) {
      triggerSuccess();
    } else {
      // Snap back to 0
      setDragProgress(0);
    }
  };

  const triggerSuccess = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    setDragProgress(1);
    setIsCompleted(true);

    if (navigator.vibrate) {
      navigator.vibrate([40, 30, 80]);
    }
    sounds.playSuccess();

    if (onConfirm) {
      onConfirm();
    }
  };

  const handleReset = (e) => {
    e.stopPropagation();
    setIsCompleted(false);
    setDragProgress(0);
    if (onDisable) {
      onDisable();
    }
  };

  // Touch handlers
  const onTouchStart = (e) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e) => handleMove(e.touches[0].clientX);
  const onTouchEnd = handleEnd;

  // Mouse handlers (for desktop testing)
  const onMouseDown = (e) => {
    handleStart(e.clientX);
    const onMouseMove = (ev) => handleMove(ev.clientX);
    const onMouseUp = () => {
      handleEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="w-full select-none">
      {isCompleted ? (
        <div className="w-full bg-gradient-to-r from-emerald-950/80 via-teal-900/60 to-emerald-950/80 border border-emerald-500/50 rounded-2xl p-3 flex items-center justify-between shadow-lg shadow-emerald-950/30 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <span>Vrijcheck Ingeschakeld</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div className="text-[11px] text-emerald-400/80">
                Reageert automatisch op Day-Planning-Sender
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white bg-[#252834] hover:bg-[#323646] px-3 py-1.5 rounded-xl border border-white/10 transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-neutral-400" />
            <span>Uitschakelen</span>
          </button>
        </div>
      ) : (
        <div
          ref={trackRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          className="relative w-full h-14 bg-[#14151a] border border-[#2b2d39] rounded-2xl overflow-hidden cursor-pointer touch-none flex items-center p-1 shadow-inner"
        >
          {/* Fill bar following thumb */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-700/50 via-indigo-600/60 to-emerald-600/70 transition-all pointer-events-none"
            style={{
              width: `calc(${dragProgress * 100}% + 24px)`,
              transition: isDragging ? 'none' : 'width 0.25s ease-out'
            }}
          />

          {/* Shimmering label in center */}
          <div
            className="absolute inset-0 flex items-center justify-center gap-1.5 pointer-events-none text-xs font-bold tracking-wide transition-opacity"
            style={{ opacity: Math.max(1 - dragProgress * 1.5, 0) }}
          >
            <span className="bg-gradient-to-r from-neutral-400 via-white to-blue-300 bg-clip-text text-transparent">
              {label}
            </span>
            <div className="flex items-center text-blue-400/80 animate-pulse">
              <ChevronRight className="w-3.5 h-3.5 -mr-1.5" />
              <ChevronRight className="w-3.5 h-3.5 -mr-1.5" />
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Draggable thumb */}
          <div
            className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg cursor-grab active:cursor-grabbing transition-transform"
            style={{
              transform: `translateX(${dragProgress * ((trackRef.current?.offsetWidth || 300) - 56)}px)`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
              background: dragProgress >= 0.85
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)'
            }}
          >
            {dragProgress >= 0.85 ? (
              <Check className="w-5 h-5 stroke-[2.5] animate-scaleIn" />
            ) : (
              <Zap className="w-5 h-5 fill-white text-white drop-shadow" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
