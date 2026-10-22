import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Check, Zap, HelpCircle, Activity, ChevronDown, ChevronUp, RotateCcw, Info } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { SHIFT_BLOCKS, SHIFT_BLOCK_MAP, getBlockInfo } from '../utils/constants';
import { SlackEmoji } from './SlackEmoji';
import { SlideToVrijcheck } from './SlideToVrijcheck';
import { PicnicMascot } from './PicnicMascot';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';

export const ShiftModal = ({
  isOpen,
  onClose,
  date,
  currentShift,
  shiftIndex = 0,
  onSaveShift
}) => {
  if (!isOpen || !date) return null;

  // Formatted date string matching screenshot: "Zaterdag, 7 November"
  const formattedDate = format(date, 'EEEE, d MMMM', { locale: nl });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const [selectedBlock, setSelectedBlock] = useState(currentShift?.block || 'M2');
  const [startTime, setStartTime] = useState(currentShift?.startTime || '07:00');
  const [endTime, setEndTime] = useState(currentShift?.endTime || '15:30');
  const [vrijcheckActive, setVrijcheckActive] = useState(
    Boolean(currentShift?.vrijcheckActive)
  );
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  // Pull-down-to-dismiss touch gesture state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const touchStartYRef = useRef(null);
  const isDraggingRef = useRef(false);
  const scrollContainerRef = useRef(null);

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    touchStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (touchStartYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartYRef.current;

    // Check if the inner content scroll is at the very top
    const isAtTop = scrollContainerRef.current ? scrollContainerRef.current.scrollTop <= 0 : true;

    if (deltaY > 0 && isAtTop) {
      isDraggingRef.current = true;
      // Damped downward dragging
      const damped = Math.min(deltaY * 0.85, 320);
      setDragOffsetY(damped);
    } else if (deltaY < 0 && isDraggingRef.current) {
      setDragOffsetY(0);
      isDraggingRef.current = false;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartYRef.current === null) return;
    touchStartYRef.current = null;

    if (isDraggingRef.current && dragOffsetY > 70) {
      // User dragged down past threshold -> dismiss modal!
      setIsClosing(true);
      setDragOffsetY(400);
      try { navigator.vibrate?.(12); } catch (_) {}
      sounds.playPop?.();
      setTimeout(() => {
        setIsClosing(false);
        setDragOffsetY(0);
        isDraggingRef.current = false;
        onClose();
      }, 200);
    } else {
      // Snap back smoothly
      setDragOffsetY(0);
      isDraggingRef.current = false;
    }
  };

  useEffect(() => {
    if (currentShift) {
      setSelectedBlock(currentShift.block || 'M2');
      setStartTime(currentShift.startTime || '07:00');
      setEndTime(currentShift.endTime || '15:30');
      setVrijcheckActive(Boolean(currentShift.vrijcheckActive));
    } else {
      setSelectedBlock('M2');
      setStartTime('07:00');
      setEndTime('15:30');
      setVrijcheckActive(false);
    }
    setDragOffsetY(0);
    setIsClosing(false);
  }, [currentShift, isOpen]);

  const blockDef = getBlockInfo(selectedBlock) || SHIFT_BLOCK_MAP['M2'];
  const reactionStatus = currentShift?.reactionStatus;

  const handleSelectBlock = (newBlockId) => {
    setSelectedBlock(newBlockId);
    const def = getBlockInfo(newBlockId);
    if (def && def.defaultTime) {
      const parts = def.defaultTime.split(' - ');
      setStartTime(parts[0]);
      setEndTime(parts[1]);
    }
    setShowBlockPicker(false);
  };

  const handleConfirmSlide = () => {
    setVrijcheckActive(true);
    try {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) {}

    try {
      sounds.playSuccess();
    } catch (e) {}

    onSaveShift({
      ...currentShift,
      block: selectedBlock,
      startTime,
      endTime,
      vrijcheckActive: true,
      reactionStatus: currentShift?.reactionStatus || null
    }, shiftIndex);
  };

  const handleDisableVrijcheck = () => {
    setVrijcheckActive(false);
    onSaveShift({
      ...currentShift,
      block: selectedBlock,
      startTime,
      endTime,
      vrijcheckActive: false,
      reactionStatus: currentShift?.reactionStatus || null
    }, shiftIndex);
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-200 select-none ${
        isClosing ? 'opacity-0' : 'animate-fadeIn'
      }`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#111319] sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-[#232733]"
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grab Handle Bar for Pull Down Gesture */}
        <div className="bg-[#3171f7] pt-2.5 pb-0.5 flex justify-center cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1.5 bg-white/40 rounded-full" />
        </div>

        {/* Top Hero: Royal Blue with Mascot & Close Button (Matches Screenshot 2) */}
        <div className="bg-[#3171f7] pt-1 pb-1 px-4 relative flex flex-col items-center overflow-hidden">
          {/* Close button in top-left */}
          <button
            onClick={onClose}
            className="absolute top-2 left-4 text-white/90 hover:text-white transition-opacity p-1.5 rounded-full hover:bg-white/10 active:scale-95"
            aria-label="Sluiten"
          >
            <X className="w-6 h-6 stroke-[2.4]" />
          </button>

          {/* Top Title: Ingeroosterd with Calendar icon */}
          <div className="flex items-center gap-2 text-white font-bold text-base mt-0.5">
            <Calendar className="w-5 h-5 stroke-[2.2]" />
            <span>Ingeroosterd</span>
          </div>

          {/* Dancing Picnic Mascot Illustration */}
          <div className="w-full mt-1 -mb-1">
            <PicnicMascot className="w-48 h-28 mx-auto" />
          </div>
        </div>

        {/* Content Body: Dark Cards (Matches Screenshot 2) */}
        <div 
          ref={scrollContainerRef}
          className="p-4 overflow-y-auto space-y-3 flex-1 bg-[#111319]"
        >
          {/* Card 1: Time and Date */}
          <div className="bg-[#181b24] border border-[#262a38] rounded-2xl p-4">
            <div className="text-sm text-neutral-300 font-medium tracking-tight">
              {startTime} - {endTime}
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {capitalizedDate}
            </div>
          </div>

          {/* Card 2: Shift Block Pill & Title */}
          <div className="bg-[#181b24] border border-[#262a38] rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="bg-[#2c3140] text-white px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">
                  {selectedBlock}
                </span>
                <span className="text-base font-bold text-white">
                  Shift {selectedBlock}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#12141a] px-2.5 py-1 rounded-lg border border-[#2b2e3c]">
                  <SlackEmoji name={blockDef?.emoji || '2-red'} size="xs" />
                  <span className="text-xs font-mono font-bold text-blue-300">
                    :{blockDef?.emoji || '2-red'}:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBlockPicker(!showBlockPicker)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-[#252835] transition-colors"
                  title="Shift block wijzigen"
                >
                  {showBlockPicker ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Expandable Block Picker */}
            {showBlockPicker && (
              <div className="mt-3 pt-3 border-t border-[#262a38] space-y-2 animate-fadeIn">
                <div className="text-[11px] text-neutral-400 font-medium">Kies Picnic shift block:</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {SHIFT_BLOCKS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBlock(b.id)}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all ${
                        selectedBlock === b.id
                          ? 'bg-blue-600 border-blue-400 text-white font-bold shadow'
                          : 'bg-[#1e212b] border-[#292c3a] text-neutral-300 hover:bg-[#272b38]'
                      }`}
                    >
                      <span className="text-xs font-black">{b.label}</span>
                      <div className="mt-1 scale-90">
                        <SlackEmoji name={b.emoji} size="xs" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Status Report with Bullet Points (Herhalend schema & Ingeroosterd removed) */}
          <div className="bg-[#181b24] border border-[#262a38] rounded-2xl p-4 space-y-3">
            {/* Header with Activity icon and live status badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-white">
                <Activity className="w-4 h-4 text-blue-400 stroke-[2.2]" />
                <span>Status Rapport</span>
              </div>

              {reactionStatus?.success ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  <Check className="w-3.5 h-3.5" />
                  <span>Vrij gereageerd ({reactionStatus.latencyMs}ms)</span>
                </span>
              ) : vrijcheckActive ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-xs font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span>Vrijcheck Actief &amp; Scherp</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-xs font-medium border border-neutral-700">
                  Uitgeschakeld
                </span>
              )}
            </div>

            {/* Bullet points detailing what has been done & what needs to be done */}
            <div className="space-y-2 text-xs text-neutral-300 bg-[#12141a] p-3.5 rounded-xl border border-[#232733]">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold text-sm leading-none mt-0.5">•</span>
                <span className="leading-relaxed">
                  <strong className="text-white">Timing van de planner:</strong> Day-Planning-Sender post op Slack rond{' '}
                  <span className="text-amber-300 font-semibold">{blockDef?.postTime || '17:10'} uur</span>{' '}
                  ({blockDef?.timingLabel || 'dag van tevoren'}). De seconden variëren altijd (bijv.{' '}
                  <code className="text-amber-300 bg-amber-950/40 px-1 py-0.2 rounded">:19s</code>,{' '}
                  <code className="text-amber-300 bg-amber-950/40 px-1 py-0.2 rounded">:28s</code>).
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold text-sm leading-none mt-0.5">•</span>
                <span className="leading-relaxed">
                  <strong className="text-white">Bot actie:</strong> Luistert non-stop tijdens het gehele 2,5-minuten tijdvak (elke 500ms) om direct op de milliseconde te reageren zodra het bericht arriveert.
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold text-sm leading-none mt-0.5">•</span>
                <span className="leading-relaxed">
                  <strong className="text-white">Doel reactie:</strong> Reageert automatisch met{' '}
                  <span className="text-blue-300 font-mono font-bold">:{blockDef?.emoji || '2-red'}:</span> in{' '}
                  <span className="text-neutral-200 font-semibold">#nl-dist-runners-hlm</span>.
                </span>
              </div>

              {/* Status summary banner */}
              {reactionStatus?.success ? (
                <div className="mt-2.5 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-emerald-300 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Reactie geplaatst met :{reactionStatus.emoji}:</span>
                  </span>
                  <span className="font-mono text-xs text-emerald-400 font-bold">
                    {reactionStatus.latencyMs}ms
                  </span>
                </div>
              ) : vrijcheckActive ? (
                <div className="mt-2.5 pt-2.5 border-t border-blue-500/20 text-blue-200 text-[11px] font-medium flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Vrijcheck staat scherp! De bot reageert direct zodra de planner post.</span>
                </div>
              ) : (
                <div className="mt-2.5 pt-2.5 border-t border-[#262936] text-[11px] text-neutral-400 italic">
                  Schuif hieronder om automatische vrijcheck voor deze shift in te schakelen.
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Slide to Vrijcheck Interactive Slider */}
          <div className="pt-1">
            <SlideToVrijcheck
              isActive={vrijcheckActive}
              onConfirm={handleConfirmSlide}
              onDisable={handleDisableVrijcheck}
              label="Schuif om vrij te checken"
            />
          </div>

          {/* Card 5: Hulp nodig? (Matches Screenshot 2) */}
          <div className="bg-[#181b24] border border-[#262a38] rounded-2xl p-4 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-white">Hulp nodig?</div>
              <div className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                Neem contact op met je team lead als je vragen hebt.
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Close button */}
        <div className="p-3.5 bg-[#14161f] border-t border-[#222530]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-[#252834] hover:bg-[#323646] active:scale-[0.99] text-white font-bold text-sm transition-all text-center"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
