import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Zap, RotateCcw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { SHIFT_BLOCKS } from '../utils/constants';
import { SlackEmoji } from './SlackEmoji';

export const ShiftModal = ({
  isOpen,
  onClose,
  date,
  currentShift,
  onSaveShift
}) => {
  if (!isOpen || !date) return null;

  const dateString = format(date, 'EEEE d MMMM yyyy', { locale: nl });
  const [selectedBlock, setSelectedBlock] = useState(currentShift?.block || 'none');
  const [startTime, setStartTime] = useState(currentShift?.startTime || '13:00');
  const [endTime, setEndTime] = useState(currentShift?.endTime || '21:30');
  const [vrijcheckActive, setVrijcheckActive] = useState(
    currentShift?.vrijcheckActive !== undefined ? currentShift.vrijcheckActive : true
  );

  useEffect(() => {
    if (currentShift) {
      setSelectedBlock(currentShift.block || 'none');
      setStartTime(currentShift.startTime || '13:00');
      setEndTime(currentShift.endTime || '21:30');
      setVrijcheckActive(currentShift.vrijcheckActive !== undefined ? currentShift.vrijcheckActive : true);
    } else {
      setSelectedBlock('none');
      setStartTime('13:00');
      setEndTime('21:30');
      setVrijcheckActive(true);
    }
  }, [currentShift, isOpen]);

  const handleSelectBlock = (blockId) => {
    setSelectedBlock(blockId);
    if (blockId !== 'none') {
      const blockDef = SHIFT_BLOCKS.find((b) => b.id === blockId);
      if (blockDef && blockDef.defaultTime) {
        const [s, e] = blockDef.defaultTime.split(' - ');
        setStartTime(s.trim());
        setEndTime(e.trim());
      }
    }
  };

  const handleSave = () => {
    onSaveShift({
      block: selectedBlock,
      startTime: selectedBlock === 'none' ? null : startTime,
      endTime: selectedBlock === 'none' ? null : endTime,
      vrijcheckActive: selectedBlock === 'none' ? false : vrijcheckActive,
      // Retain or clear reactionStatus
      reactionStatus: currentShift?.reactionStatus || null
    });
    onClose();
  };

  const handleResetReaction = () => {
    onSaveShift({
      ...currentShift,
      reactionStatus: null
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm transition-all animate-fadeIn">
      <div
        className="w-full max-w-md bg-[#18191d] border-t sm:border border-[#2a2b32] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#25262c]">
          <div>
            <h3 className="text-base font-bold text-white capitalize">{dateString}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Selecteer je Picnic shift block (M1-M2, S1-S3)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#24252c] text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Reaction status notification banner if already reacted */}
          {currentShift?.reactionStatus && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlackEmoji name={currentShift.reactionStatus.emoji} size="md" />
                <div>
                  <div className="text-xs font-bold text-emerald-300">
                    Al gereageerd met :{currentShift.reactionStatus.emoji}:
                  </div>
                  <div className="text-[11px] text-emerald-400/80">
                    Latency: {currentShift.reactionStatus.latencyMs}ms • Gelukt!
                  </div>
                </div>
              </div>
              <button
                onClick={handleResetReaction}
                className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white bg-[#25262c] px-2.5 py-1 rounded-md transition-colors"
                title="Reset status om opnieuw te reageren"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          )}

          {/* 5 Blocks grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Kies shift block:
            </label>

            <div className="grid grid-cols-1 gap-2">
              {SHIFT_BLOCKS.map((b) => {
                const isSelected = selectedBlock === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBlock(b.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                        : 'bg-[#202127] border-[#292b33] text-neutral-300 hover:bg-[#252730]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg font-black text-sm flex items-center justify-center ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-[#2a2c35] text-neutral-300'
                        }`}
                      >
                        {b.label}
                      </div>

                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>{b.period === 'OCHTEND' ? 'Ochtend' : 'Middag/Avond'}</span>
                          <span className="text-xs font-normal text-neutral-400">({b.defaultTime})</span>
                        </div>
                        <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                          <span>Slack reactie:</span>
                          <SlackEmoji name={b.emoji} size="sm" />
                          <span className="text-neutral-400 font-mono text-[11px]">:{b.emoji}:</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-full border border-white/10">
                        <SlackEmoji name={b.emoji} size="md" />
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'border-neutral-600 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* No Shift option */}
              <button
                onClick={() => handleSelectBlock('none')}
                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  selectedBlock === 'none'
                    ? 'bg-neutral-800 border-neutral-600 text-white'
                    : 'bg-[#202127] border-[#292b33] text-neutral-400 hover:bg-[#252730]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#2a2c35] font-bold text-sm text-neutral-400 flex items-center justify-center">
                    —
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-neutral-300">Geen shift (Vrij)</div>
                    <div className="text-xs text-neutral-500">Geen automatische Slack reactie</div>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selectedBlock === 'none'
                      ? 'bg-neutral-400 border-neutral-300 text-black'
                      : 'border-neutral-600 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </button>
            </div>
          </div>

          {/* Time & Vrijcheck toggle (only if block selected) */}
          {selectedBlock !== 'none' && (
            <div className="space-y-3 pt-2 border-t border-[#25262c]">
              <div className="flex items-center justify-between bg-[#202127] border border-[#292b33] rounded-xl p-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400">
                    <Zap className="w-4 h-4 fill-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Vrijcheck Actief</div>
                    <div className="text-xs text-neutral-400">
                      Reageer direct op Day-Planning-Sender
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vrijcheckActive}
                    onChange={(e) => setVrijcheckActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Custom time adjustments */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Starttijd</label>
                  <div className="flex items-center gap-2 bg-[#202127] border border-[#292b33] rounded-lg px-3 py-2 text-white">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="bg-transparent text-sm w-full outline-none font-mono"
                      placeholder="13:00"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Eindtijd</label>
                  <div className="flex items-center gap-2 bg-[#202127] border border-[#292b33] rounded-lg px-3 py-2 text-white">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="bg-transparent text-sm w-full outline-none font-mono"
                      placeholder="21:30"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141416] border-t border-[#25262c] flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-[#24252c] text-neutral-300 hover:text-white font-semibold text-sm transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/30"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
};
