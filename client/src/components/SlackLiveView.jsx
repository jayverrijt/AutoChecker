import React, { useState } from 'react';
import { 
  Radio, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  RefreshCw, 
  Hash, 
  Bot,
  Zap,
  ChevronRight
} from 'lucide-react';
import { SlackEmoji } from './SlackEmoji';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export const SlackLiveView = ({
  botStatus,
  history,
  onSimulate,
  onClearHistory,
  onReconnect,
  shifts
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState('MIDDAG');
  const [simDate, setSimDate] = useState('17-10-2026');
  const [isSimulating, setIsSimulating] = useState(false);
  const [overschot1, setOverschot1] = useState(3);
  const [overschot2, setOverschot2] = useState(4);
  const [overschot3, setOverschot3] = useState(2);

  const handleSimulateClick = async () => {
    setIsSimulating(true);
    try {
      await onSimulate({
        period: selectedPeriod,
        date: simDate,
        overschotten: {
          shift1: Number(overschot1),
          shift2: Number(overschot2),
          shift3: Number(overschot3)
        }
      });
    } finally {
      setTimeout(() => setIsSimulating(false), 500);
    }
  };

  const getStatusBadge = () => {
    switch (botStatus?.status) {
      case 'polling':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Polling ({botStatus.channelName || '#nl-dist-runners-hlm'})
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Verbinden met Slack...
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            <AlertCircle className="w-3 h-3" />
            Slack Verbindingsfout
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
            <Radio className="w-3 h-3 text-blue-400" />
            Simulatiemodus Actief
          </span>
        );
    }
  };

  return (
    <div className="p-4 space-y-5 pb-24 overflow-y-auto">
      {/* Bot Status Banner */}
      <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Vrijcheck Slack Bot</span>
                <span className="text-[10px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded font-mono">
                  v1.0
                </span>
              </h2>
              <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                <Hash className="w-3 h-3 text-neutral-400" />
                <span>{botStatus?.channelName || '#nl-dist-runners-hlm'}</span>
              </div>
            </div>
          </div>

          <div>{getStatusBadge()}</div>
        </div>

        {botStatus?.lastError && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300">
            {botStatus.lastError}
          </div>
        )}
      </div>

      {/* Slack Interactive Simulation Sandbox */}
      <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Simuleer Day-Planning-Sender</h3>
          </div>
          <span className="text-[11px] text-neutral-400">Test direct reactiesnelheid</span>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Periode</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white font-medium outline-none focus:border-blue-500"
            >
              <option value="MIDDAG">MIDDAG (S1, S2, S3)</option>
              <option value="OCHTEND">OCHTEND (M1, M2)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-400 block mb-1">Datum (DD-MM-YYYY)</label>
            <input
              type="text"
              value={simDate}
              onChange={(e) => setSimDate(e.target.value)}
              className="w-full bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
              placeholder="17-10-2026"
            />
          </div>
        </div>

        {/* Overschotten inputs */}
        <div className="bg-[#141418] p-3 rounded-xl border border-[#242530] space-y-2">
          <div className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
            <span>Overschotten (Plaatsen vrij):</span>
            <span className="text-[11px] text-neutral-500">Volgens foto</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#1e1f26] p-2 rounded-lg text-center border border-[#282a35]">
              <div className="text-[11px] text-neutral-400 font-medium">Shift 1 (:1-red:)</div>
              <input
                type="number"
                value={overschot1}
                onChange={(e) => setOverschot1(e.target.value)}
                className="w-full text-center bg-transparent text-sm font-bold text-white outline-none mt-1"
              />
            </div>

            <div className="bg-[#1e1f26] p-2 rounded-lg text-center border border-[#282a35]">
              <div className="text-[11px] text-neutral-400 font-medium">Shift 2 (:2-red:)</div>
              <input
                type="number"
                value={overschot2}
                onChange={(e) => setOverschot2(e.target.value)}
                className="w-full text-center bg-transparent text-sm font-bold text-white outline-none mt-1"
              />
            </div>

            <div className="bg-[#1e1f26] p-2 rounded-lg text-center border border-[#282a35]">
              <div className="text-[11px] text-neutral-400 font-medium">Shift 3 (:3-red:)</div>
              <input
                type="number"
                value={overschot3}
                onChange={(e) => setOverschot3(e.target.value)}
                className="w-full text-center bg-transparent text-sm font-bold text-white outline-none mt-1"
              />
            </div>
          </div>
        </div>

        {/* Realistic Slack Message Preview (Exact layout of Image 1) */}
        <div className="bg-[#1e1f24] border border-[#2b2c36] rounded-xl p-3.5 space-y-2.5 text-xs text-neutral-200 font-sans shadow-inner">
          <div className="flex items-center gap-2">
            {/* Day planning sender avatar */}
            <div className="w-8 h-8 rounded-lg bg-neutral-200 flex items-center justify-center text-red-600 font-black text-xs shadow-sm">
              <span className="text-[10px]">📅</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Day-Planning-Sender</span>
              <span className="bg-[#2d2f3a] text-neutral-400 text-[10px] px-1 py-0.2 rounded uppercase font-semibold">
                APP
              </span>
              <span className="text-neutral-500 text-[11px]">10:10 AM</span>
            </div>
          </div>

          <div className="pl-10 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-1.5 font-bold text-sm text-white">
              <SlackEmoji name="picnic" size="sm" />
              <span>
                {selectedPeriod} {simDate}
              </span>
            </div>

            <div className="text-neutral-300 space-y-1">
              <div>⏰ Graag voor 11:00u bevestigen dat je komt d.m.v. ✅</div>
              <div>🤕 Ziek melden? De ziekmeld-procedure staat in de Bookmarks!</div>
              <div className="font-semibold text-white pt-1">🚨 Tekorten</div>
              <div className="text-neutral-400">Geen tekort</div>
              <div className="font-semibold text-white pt-1">⬆️ Overschotten</div>
              <div>Shift 1: {overschot1}</div>
              <div>Shift 2: {overschot2}</div>
              {overschot3 > 0 && <div>Shift 3: {overschot3}</div>}
              <div className="text-neutral-400 pt-1 text-[11px]">
                Check je vrij? Als iedereen gecheckt heeft, hoor je uiterlijk 1,5 uur voor aanvang van je shift of je thuis kan blijven!
              </div>
            </div>

            {/* Reactions preview */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <div className="flex items-center gap-1.5 bg-[#2a2c36] hover:bg-[#343644] px-2 py-1 rounded-md border border-[#3b3e4e]">
                <SlackEmoji name="1-red" size="sm" />
                <span className="text-[11px] font-semibold text-neutral-300">4</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#2a2c36] hover:bg-[#343644] px-2 py-1 rounded-md border border-[#3b3e4e]">
                <SlackEmoji name="picnic" size="sm" />
                <span className="text-[11px] font-semibold text-neutral-300">17</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#2a2c36] hover:bg-[#343644] px-2 py-1 rounded-md border border-[#3b3e4e]">
                <SlackEmoji name="2-red" size="sm" />
                <span className="text-[11px] font-semibold text-neutral-300">3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trigger Simulation Button */}
        <button
          onClick={handleSimulateClick}
          disabled={isSimulating}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] font-bold text-white text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
        >
          {isSimulating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Versturen &amp; Reageren...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Verzend gesimuleerd bericht in Slack</span>
            </>
          )}
        </button>
      </div>

      {/* Real-time Reaction Activity Log */}
      <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Bot Activiteit &amp; Reacties</h3>
          </div>
          {history?.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-xs text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Wis logs
            </button>
          )}
        </div>

        {/* History items */}
        {history && history.length > 0 ? (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {history.map((item) => {
              const isSuccess = item.reactionSuccess || item.status === 'success';
              return (
                <div
                  key={item.id || item.timestamp}
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    isSuccess
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                      : 'bg-[#21232b] border-[#2c2e39] text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      {isSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                      )}
                      <span>
                        {item.matchedShift ? `Shift ${item.matchedShift}` : 'Bericht ontvangen'}
                      </span>
                      {item.emoji && <SlackEmoji name={item.emoji} size="sm" />}
                    </div>

                    <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-[11px]">
                      {item.latencyMs ? <span>{item.latencyMs}ms</span> : null}
                      <span>•</span>
                      <span>
                        {item.timestamp ? format(new Date(item.timestamp), 'HH:mm:ss') : ''}
                      </span>
                    </div>
                  </div>

                  <p className="text-neutral-300 text-[11px] leading-relaxed">
                    {item.details || item.reason || 'Geen details'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-neutral-500 text-xs">
            Nog geen Slack activiteit geregistreerd. Simuleer een bericht of wacht op Day-Planning-Sender!
          </div>
        )}
      </div>
    </div>
  );
};
