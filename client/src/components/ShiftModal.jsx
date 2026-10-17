import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Zap, RotateCcw, Bell, Info } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { SHIFT_BLOCKS, SHIFT_BLOCK_MAP } from '../utils/constants';
import { SlackEmoji } from './SlackEmoji';
import { SlideToVrijcheck } from './SlideToVrijcheck';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';

export const ShiftModal = ({
  isOpen,
  onClose,
  date,
  currentShift,
  initialBlock,
  onSaveShift
}) => {
  if (!isOpen || !date) return null;

  const dateString = format(date, 'EEEE d MMMM yyyy', { locale: nl });
  const [selectedBlock, setSelectedBlock] = useState(
    initialBlock || currentShift?.block || 'none'
  );
  const [vrijcheckActive, setVrijcheckActive] = useState(
    currentShift?.vrijcheckActive !== undefined ? currentShift.vrijcheckActive : true
  );

  useEffect(() => {
    if (initialBlock) {
      setSelectedBlock(initialBlock);
    } else if (currentShift) {
      setSelectedBlock(currentShift.block || 'none');
      setVrijcheckActive(currentShift.vrijcheckActive !== undefined ? currentShift.vrijcheckActive : true);
    } else {
      setSelectedBlock('none');
      setVrijcheckActive(true);
    }
  }, [currentShift, initialBlock, isOpen]);

  const blockDef = SHIFT_BLOCK_MAP[selectedBlock];

  const handleSelectBlock = (blockId) => {
    setSelectedBlock(blockId);
    if (blockId === 'none') {
      setVrijcheckActive(false);
    } else {
      setVrijcheckActive(true);
    }
  };

  const handleConfirmSlide = () => {
    setVrijcheckActive(true);
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.7 }
    });
    sounds.playSuccess();

    // Auto save
    onSaveShift({
      block: selectedBlock,
      startTime: blockDef?.defaultTime?.split(' - ')[0] || '13:00',
      endTime: blockDef?.defaultTime?.split(' - ')[1] || '21:30',
      vrijcheckActive: true,
      reactionStatus: currentShift?.reactionStatus || null
    });
  };

  const handleDisableVrijcheck = () => {
    setVrijcheckActive(false);
    onSaveShift({
      block: selectedBlock,
      startTime: blockDef?.defaultTime?.split(' - ')[0] || '13:00',
      endTime: blockDef?.defaultTime?.split(' - ')[1] || '21:30',
      vrijcheckActive: false,
      reactionStatus: currentShift?.reactionStatus || null
    });
  };

  const handleSave = () => {
    onSaveShift({
      block: selectedBlock,
      startTime: selectedBlock === 'none' ? null : (blockDef?.defaultTime?.split(' - ')[0] || '13:00'),
      endTime: selectedBlock === 'none' ? null : (blockDef?.defaultTime?.split(' - ')[1] || '21:30'),
      vrijcheckActive: selectedBlock === 'none' ? false : vrijcheckActive,
      reactionStatus: currentShift?.reactionStatus || null
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md transition-all animate-fadeIn">
      <div
        className="w-full max-w-md bg-[#16171b] border-t sm:border border-[#292b34] sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#24252c] bg-[#1a1b20]">
          <div>
            <h3 className="text-base font-bold text-white capitalize">{dateString}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Selecteer je shift &amp; schuif om Vrijcheck te activeren
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#272832] text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Reaction status notification banner if already reacted */}
          {currentShift?.reactionStatus && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SlackEmoji name={currentShift.reactionStatus.emoji} size="md" />
                <div>
                  <div className="text-xs font-bold text-emerald-300">
                    Al gereageerd met :{currentShift.reactionStatus.emoji}:
                  </div>
                  <div className="text-[11px] text-emerald-400/80">
                    Latency: {currentShift.reactionStatus.latencyMs}ms • Geslaagd!
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  onSaveShift({ ...currentShift, reactionStatus: null });
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white bg-[#25262c] px-2.5 py-1 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          )}

          {/* 5 Blocks Selector (M1, M2, S1, S2, S3) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
              <span>Picnic Shift Block:</span>
              <span className="text-[11px] text-neutral-400 font-normal">Kies M1-S3</span>
            </label>

            <div className="grid grid-cols-5 gap-1.5">
              {SHIFT_BLOCKS.map((b) => {
                const isSelected = selectedBlock === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelectBlock(b.id)}
                    className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/30 scale-[1.02]'
                        : 'bg-[#202127] border-[#292b33] text-neutral-300 hover:bg-[#272932]'
                    }`}
                  >
                    <span className="text-sm font-black tracking-tight">{b.label}</span>
                    <div className="mt-1">
                      <SlackEmoji name={b.emoji} size="xs" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Shift Details Card */}
          {blockDef ? (
            <div className="bg-[#1e2027] border border-[#2b2e3a] rounded-2xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-base">
                    {blockDef.label}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{blockDef.period === 'OCHTEND' ? 'Ochtend Shift' : 'Middag/Avond Shift'}</span>
                      <span className="text-xs font-normal text-neutral-400">({blockDef.defaultTime})</span>
                    </div>
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                      <span>Automatische reactie:</span>
                      <SlackEmoji name={blockDef.emoji} size="sm" />
                      <span className="text-blue-300 font-mono font-bold">:{blockDef.emoji}:</span>
                    </div>
                  </div>
                </div>

                <div className="p-1 rounded-xl bg-black/30 border border-white/10">
                  <SlackEmoji name={blockDef.emoji} size="lg" />
                </div>
              </div>

              {/* Exact Timing Rule Box (17:10 for morning, 10:10 for afternoon) */}
              <div className="bg-[#17181f] border border-[#2a2d3b] rounded-xl p-3 flex items-start gap-2.5 text-xs text-neutral-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>Vrijcheck bericht om {blockDef.postTime}</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-semibold">
                      {blockDef.timingLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                    {blockDef.timingNote} De bot scant gedurende die hele minuut om direct te reageren.
                  </p>
                </div>
              </div>

              {/* Interactive Slide to Vrijcheck Slider */}
              <div className="pt-2">
                <label className="text-xs font-bold text-neutral-300 block mb-2">
                  Vrijcheck Activeren:
                </label>
                <SlideToVrijcheck
                  isActive={vrijcheckActive}
                  onConfirm={handleConfirmSlide}
                  onDisable={handleDisableVrijcheck}
                  label="Schuif om vrij te checken"
                />
              </div>
            </div>
          ) : (
            /* Option to unselect or free day */
            <div className="bg-[#1e2027] border border-[#2b2e3a] rounded-2xl p-4 text-center space-y-2">
              <span className="text-xs text-neutral-400">
                Geen shift geselecteerd voor deze dag.
              </span>
              <p className="text-[11px] text-neutral-500">
                Tik hierboven op M1, M2, S1, S2 of S3 om je shift in te stellen en Vrijcheck aan te zetten.
              </p>
            </div>
          )}

          {/* Quick Clear / Free Day Option */}
          {selectedBlock !== 'none' && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => handleSelectBlock('none')}
                className="text-xs text-neutral-400 hover:text-red-400 transition-colors py-1 px-3 rounded-lg border border-transparent hover:border-red-500/20 hover:bg-red-500/10"
              >
                Geen shift op deze dag (Vrij)
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141416] border-t border-[#25262c] flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl bg-[#24252c] text-neutral-300 hover:text-white font-semibold text-xs transition-colors"
          >
            Sluiten
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/30"
          >
            Opslaan &amp; Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
