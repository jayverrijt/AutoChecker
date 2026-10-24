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
  ChevronDown,
  ChevronUp,
  User,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { SlackEmoji } from './SlackEmoji';
import { slackService } from '../services/slackService';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export const SlackLiveView = ({
  botStatus,
  history,
  recentMessages = [],
  onSimulate,
  onClearHistory,
  onReconnect,
  onNavigateToSettings,
  onTestRealReaction
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState('MIDDAG');
  const [simDate, setSimDate] = useState('17-10-2026');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isTestingReal, setIsTestingReal] = useState(false);
  const [overschot1, setOverschot1] = useState(3);
  const [overschot2, setOverschot2] = useState(4);
  const [overschot3, setOverschot3] = useState(2);
  const [showSimulator, setShowSimulator] = useState(false);

  const handleTriggerRealReaction = async (emoji) => {
    if (!onTestRealReaction) return;
    setIsTestingReal(true);
    try {
      await onTestRealReaction(emoji);
    } finally {
      setIsTestingReal(false);
    }
  };

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

  const isRealSlackConnected = (botStatus?.status === 'polling' || botStatus?.status === 'connected') && Boolean(botStatus?.authInfo?.user);
  const cleanChannelName = (botStatus?.channelName || 'nl-dist-runners-hlm').replace(/^#+/, '');

  return (
    <div className="p-4 space-y-4 pb-24 overflow-y-auto">
      {/* Bot Status Banner */}
      <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${
              isRealSlackConnected 
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500' 
                : 'bg-gradient-to-tr from-purple-600 to-blue-600'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Picnic Vrijcheck Bot</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  botStatus?.connected || botStatus?.status === 'connected' || botStatus?.status === 'polling'
                    ? 'bg-blue-900/60 text-blue-300 border border-blue-500/30'
                    : slackService.isTestingMode()
                    ? 'bg-amber-900/60 text-amber-300 border border-amber-500/30'
                    : 'bg-red-900/60 text-red-300 border border-red-500/30'
                }`}>
                  {botStatus?.connected || botStatus?.status === 'connected' || botStatus?.status === 'polling'
                    ? '24/7 VPS Cloud'
                    : slackService.isTestingMode()
                    ? 'Test Modus (Debugger)'
                    : 'VPS Offline'}
                </span>
              </h2>
              <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                <Hash className="w-3 h-3 text-neutral-400" />
                <span className="font-mono">{cleanChannelName}</span>
              </div>
            </div>
          </div>

          <div>
            {isRealSlackConnected ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Actief</span>
              </span>
            ) : botStatus?.status === 'connecting' ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Verbinden...</span>
              </span>
            ) : botStatus?.status === 'error' ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                <AlertCircle className="w-3 h-3" />
                <span>Verbindingsfout</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                <Radio className="w-3 h-3 text-blue-400" />
                <span>Wacht op Token</span>
              </span>
            )}
          </div>
        </div>

        {/* Real User details if connected */}
        {isRealSlackConnected ? (
          <div className="pt-2 border-t border-[#262833] flex items-center justify-between text-xs text-neutral-300">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ingelogd als: <strong className="text-white">{botStatus.authInfo.user}</strong></span>
            </div>
            <span className="text-[11px] text-neutral-400">
              Scan elke {botStatus.pollIntervalMs || 1000}ms
            </span>
          </div>
        ) : (
          <div className="pt-2 border-t border-[#262833] flex items-center justify-between text-xs">
            <span className="text-neutral-400">Nog geen echte Slack sessie gekoppeld.</span>
            <button
              onClick={onNavigateToSettings}
              className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <span>Instellen</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {botStatus?.lastError && (
          <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300">
            {botStatus.lastError}
          </div>
        )}
      </div>

      {/* Direct Live Reaction Test on Slack */}
      {isRealSlackConnected && (
        <div className="bg-[#1a1b20] border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h3 className="text-sm font-bold text-white">Test Live Reactie op Slack</h3>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
              Echte Slack Test
            </span>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            Klik op een emoji hieronder om direct een reactie te plaatsen op het recentste bericht in <strong className="text-white font-mono">#{cleanChannelName}</strong>:
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { id: '1-red', label: ':1-red:', shift: 'M1 / S1' },
              { id: '2-red', label: ':2-red:', shift: 'M2 / S2' },
              { id: '3-red', label: ':3-red:', shift: 'S3' },
            ].map(({ id, label, shift }) => (
              <button
                key={id}
                onClick={() => handleTriggerRealReaction(id)}
                disabled={isTestingReal}
                className="py-3 px-2 rounded-xl bg-[#22242c] hover:bg-blue-600/30 active:scale-95 border border-[#303342] hover:border-blue-500/60 flex flex-col items-center justify-center gap-1.5 transition-all shadow group disabled:opacity-50"
              >
                <div className="p-1 rounded bg-black/40 group-hover:scale-110 transition-transform">
                  <SlackEmoji name={id} size="md" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white group-hover:text-blue-300">{label}</div>
                  <div className="text-[10px] text-neutral-400">{shift}</div>
                </div>
              </button>
            ))}
          </div>
          {isTestingReal && (
            <div className="text-center text-xs text-amber-300 animate-pulse font-medium pt-1">
              Bezig met plaatsen op Slack...
            </div>
          )}
        </div>
      )}

      {/* Live Channel Feed from #nl-dist-runners-hlm if available */}
      {recentMessages && recentMessages.length > 0 && (
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                Live Berichten in #{cleanChannelName}
              </h3>
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">Realtime</span>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto">
            {recentMessages.map((msg, idx) => {
              const isPlanner = msg.user === 'U062ALTD6DQ' || 
                                msg.text?.includes('*OCHTEND') || 
                                msg.text?.includes('*MIDDAG') || 
                                (msg.username && msg.username.includes('Planning'));
              const formattedTime = msg.ts ? format(new Date(parseFloat(msg.ts) * 1000), 'HH:mm:ss') : '';

              return (
                <div
                  key={msg.ts || idx}
                  className={`border p-2.5 rounded-xl text-xs space-y-1.5 transition-all ${
                    isPlanner
                      ? 'bg-blue-950/30 border-blue-500/40 shadow-sm'
                      : 'bg-[#20222a] border-[#2c2e39]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    {isPlanner ? (
                      <span className="font-bold text-blue-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                        <span>Day-Planning-Sender</span>
                        <span className="text-[10px] text-neutral-400 font-mono">({msg.user || 'Bot'})</span>
                      </span>
                    ) : (
                      <span className="font-bold text-white">{msg.user || msg.username || 'Gebruiker'}</span>
                    )}
                    <span className="font-mono text-neutral-300 font-semibold bg-black/40 px-1.5 py-0.5 rounded text-[10px]">
                      {formattedTime}
                    </span>
                  </div>
                  <p className="text-neutral-300 text-[11px] line-clamp-2 leading-relaxed">{msg.text}</p>
                </div>
              );
            })}
          </div>

          {/* Second variance timing note */}
          <div className="bg-[#15171e] border border-[#272b38] rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-neutral-300">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Seconden-variatie gedetecteerd:</span> De Day-Planner-Sender post niet op de exacte seconde (bijv. <code className="text-amber-300">:19s</code>, <code className="text-amber-300">:28s</code> of zelfs in de minuut erna). Onze bot luistert daarom de volledige release-periode non-stop elke 500ms om direct te reageren.
            </div>
          </div>
        </div>
      )}

      {/* Real-time Reaction Activity Log */}
      <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Reacties &amp; Vrijcheck Log</h3>
          </div>
          {history?.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-xs text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wis logs</span>
            </button>
          )}
        </div>

        {history && history.length > 0 ? (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
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
          <div className="p-6 text-center text-neutral-500 text-xs">
            {isRealSlackConnected
              ? 'Wachten op het eerstvolgende bericht van Day-Planning-Sender in Slack...'
              : 'Nog geen activiteit. Verbind je Slack sessie via Instellingen of doe een test hieronder.'}
          </div>
        )}
      </div>

      {/* Collapsible Manual Testing Sandbox */}
      <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowSimulator(!showSimulator)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#202128] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-sm font-bold text-white">Handmatige Test &amp; Simulatie</div>
              <div className="text-[11px] text-neutral-400">Test de bot zonder te wachten op 10:10u</div>
            </div>
          </div>
          {showSimulator ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
        </button>

        {showSimulator && (
          <div className="p-4 pt-0 space-y-4 border-t border-[#262732] mt-2">
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Periode</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="MIDDAG">MIDDAG (S1, S2, S3)</option>
                  <option value="OCHTEND">OCHTEND (M1, M2)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Datum</label>
                <input
                  type="text"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  className="w-full bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleSimulateClick}
              disabled={isSimulating}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs flex items-center justify-center gap-2 transition-all shadow"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Test Uitvoeren...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Voer Test Uit (Simuleer Bericht)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
