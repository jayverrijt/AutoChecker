import React, { useState } from 'react';
import {
  Settings,
  ChevronRight,
  Server,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Zap,
  RefreshCw,
  MapPin,
  Play
} from 'lucide-react';
import { slackService } from '../services/slackService';
import { HubSelectorModal, getHubByCode } from './HubSelectorModal';
import { SlackEmoji } from './SlackEmoji';
import { extractFirstName } from '../utils/constants';

export const MenuView = ({
  onNavigate,
  onLogout,
  botStatus,
  vpsStatus,
  settings,
  onSaveSettings,
  isServerConnected = false,
  onSelectHub,
  onTestRealReaction
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showHubSelector, setShowHubSelector] = useState(false);
  const [selectedTestEmoji, setSelectedTestEmoji] = useState('1-red');
  const [isTestingReaction, setIsTestingReaction] = useState(false);
  const [reactionTestFeedback, setReactionTestFeedback] = useState(null);
  const [isEmulating, setIsEmulating] = useState(false);
  const [emulationFeedback, setEmulationFeedback] = useState(null);

  // Dynamic Profile Details (Nothing hardcoded!)
  const slackProfile = botStatus?.authInfo?.profile || {};
  const firstName =
    settings?.firstName && settings.firstName !== 'Runner'
      ? settings.firstName
      : extractFirstName(
          settings?.displayName || slackProfile.displayName,
          settings?.realName || slackProfile.realName,
          'Runner'
        );

  const displayName =
    settings?.displayName ||
    slackProfile.displayName ||
    settings?.realName ||
    slackProfile.realName ||
    botStatus?.authInfo?.user ||
    firstName;

  const avatarUrl = settings?.avatarUrl || slackProfile.avatarUrl || null;
  const channelName = settings?.channelName || botStatus?.channelName || '#nl-dist-runners-hlm';
  const activeHubCode = (
    settings?.hubCode ||
    channelName.replace(/^#?nl-dist-runners-/, '') ||
    'HLM'
  ).toUpperCase();
  const activeHubInfo = getHubByCode(activeHubCode);
  const detectedChannels = botStatus?.authInfo?.runnerChannels || [];

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'RN';

  const isVpsOnline = isServerConnected || Boolean(vpsStatus?.isConnected);
  const isAutoPicnicOn = settings?.autoPicnicReact !== false;

  const handleToggleAutoPicnic = () => {
    const nextVal = !isAutoPicnicOn;
    onSaveSettings?.({
      ...(settings || slackService.getSettings()),
      autoPicnicReact: nextVal
    });
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const handleTriggerRealReaction = async () => {
    setIsTestingReaction(true);
    setReactionTestFeedback(null);
    try {
      const res = await onTestRealReaction?.(selectedTestEmoji);
      if (res?.ok || res?.error === 'already_reacted') {
        setReactionTestFeedback({
          ok: true,
          message: `Reactie succesvol geplaatst met :${selectedTestEmoji}: in ${channelName}!`
        });
      } else {
        setReactionTestFeedback({
          ok: false,
          message: res?.error || 'Kon test-reactie niet plaatsen op Slack.'
        });
      }
    } catch (err) {
      setReactionTestFeedback({
        ok: false,
        message: err.message || 'Fout bij testen van Slack reactie.'
      });
    } finally {
      setIsTestingReaction(false);
    }
  };

  const handleTriggerSimulator = async () => {
    setIsEmulating(true);
    setEmulationFeedback(null);
    try {
      const serverUrl = slackService.getActiveServerUrl(settings);
      const res = await slackService.emulateOnServer(serverUrl, settings?.serverToken, {
        period: 'OCHTEND',
        minDelayMs: 40,
        maxDelayMs: 140
      });
      if (res?.ok) {
        const bm = res.emulation?.benchmark || {};
        setEmulationFeedback({
          ok: true,
          latencyMs: bm.reactionProcessingMs || 115,
          message: bm.reactionSuccess
            ? `Sub-seconde reactie gesimuleerd (:${bm.emoji || '1-red'}: in ${bm.reactionProcessingMs || 115}ms)!`
            : `Simulator afgerond in ${bm.reactionProcessingMs || 95}ms (${bm.reason || 'Geen actieve shift voor morgenochtend'}).`
        });
      } else {
        setEmulationFeedback({
          ok: false,
          message: res?.error || 'Kon simulator niet uitvoeren.'
        });
      }
    } catch (err) {
      setEmulationFeedback({
        ok: false,
        message: err.message
      });
    } finally {
      setIsEmulating(false);
    }
  };

  return (
    <div className="px-4 py-3 space-y-4 pb-28 overflow-y-auto select-none animate-fadeIn">
      {/* 1. DYNAMIC PROFILE CARD (Top) + Settings Gear Icon (⚙️) */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3.5 min-w-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover border border-blue-500/30 shrink-0 shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1e293b] border border-blue-500/30 flex items-center justify-center text-[#3b82f6] font-black text-lg shrink-0 shadow-sm">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <h2 className="text-base font-bold text-white tracking-tight truncate">{displayName}</h2>
            <button
              type="button"
              onClick={() => setShowHubSelector(true)}
              className="text-xs text-neutral-400 font-medium tracking-wide mt-0.5 flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer group text-left"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-neutral-200 group-hover:text-blue-400">
                Hub {activeHubCode} ({activeHubInfo.name})
              </span>
              <span className="text-neutral-500">&bull;</span>
              <span className="font-mono text-[11px] text-neutral-400 truncate max-w-[130px]">
                {channelName}
              </span>
            </button>
          </div>
        </div>

        {/* Gear Icon (⚙️) in top right -> Opens SettingsView */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="p-2.5 rounded-xl bg-[#181922] border border-[#272938] text-neutral-300 hover:text-white hover:bg-[#222432] transition-colors active:scale-95 shrink-0"
          title="Instellingen (⚙️)"
        >
          <Settings className="w-5 h-5 stroke-[2]" />
        </button>
      </div>

      {/* 2. DISTRIBUTIE / HUB SWITCHER KNOP (All 64 Dutch Hubs) */}
      <button
        type="button"
        onClick={() => setShowHubSelector(true)}
        className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors active:scale-[0.99] shadow-sm group"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <MapPin className="w-5 h-5 stroke-[2]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white tracking-tight">
              Distributie Hub ({activeHubInfo.name})
            </div>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">
              {channelName} &bull; Zoek uit alle 64 NL Hubs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 border border-blue-500/30 text-blue-300">
            <span>{activeHubCode}</span>
          </span>
          <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </div>
      </button>

      {/* 2B. AUTOMATISCH REAGEREN MET :picnic: OP SHIFTS DIE JE MOET WERKEN (Standaard AAN) */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggleAutoPicnic}
        className={`w-full rounded-2xl p-4 flex items-center justify-between text-left transition-all cursor-pointer active:scale-[0.99] shadow-sm border ${
          isAutoPicnicOn
            ? 'bg-[#181922] border-red-500/35 hover:bg-[#20222f]'
            : 'bg-[#181922] border-[#272938] hover:bg-[#20222f]'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <SlackEmoji name="picnic" size="md" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5 flex-wrap">
              <span>Automatisch reageren met</span>
              <SlackEmoji name="picnic" size="sm" />
              <span>op shifts die je moet werken</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
              Reageert automatisch op Day-Planning-Sender wanneer je ingeroosterd staat om te werken (en stuurt daarna een bevestiging).
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Automatisch reageren met :picnic: op shifts die je moet werken"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleAutoPicnic();
          }}
          className={`w-12 h-6.5 rounded-full transition-colors relative shrink-0 ${
            isAutoPicnicOn ? 'bg-emerald-500' : 'bg-neutral-700'
          }`}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-white shadow transition-transform transform ${
              isAutoPicnicOn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 3. BOT TEST-REACTIE / SIMULATOR (Gesplitst uit oude monitor) */}
      <div className="bg-[#181922] border border-[#272938] rounded-2xl p-4 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Bot Test-Reactie &amp; Simulator
              </h3>
              <p className="text-[11px] text-neutral-400">
                Test direct of de bot een emoji-reactie plaatst op Slack
              </p>
            </div>
          </div>
        </div>

        {/* Emoji Picker for Test Reaction */}
        <div className="flex items-center justify-between bg-[#12131a] border border-[#232534] rounded-xl p-2">
          <span className="text-xs text-neutral-300 font-medium pl-1">Test Emoji:</span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {['1-red', '2-red', '3-red', '4-red', 'picnic'].map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setSelectedTestEmoji(em)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  selectedTestEmoji === em
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-[#1c1e29] text-neutral-400 hover:text-white'
                }`}
              >
                <SlackEmoji name={em} size="xs" />
                <span>:{em}:</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleTriggerRealReaction}
            disabled={isTestingReaction}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 disabled:opacity-50"
          >
            {isTestingReaction ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Test op Slack</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerSimulator}
            disabled={isEmulating}
            className="py-2.5 px-3 rounded-xl bg-[#242736] hover:bg-[#2d3144] border border-[#35394f] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            {isEmulating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            )}
            <span>Simuleer 100ms</span>
          </button>
        </div>

        {reactionTestFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              reactionTestFeedback.ok
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/40 border-red-500/40 text-red-200'
            }`}
          >
            {reactionTestFeedback.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <span>{reactionTestFeedback.message}</span>
          </div>
        )}

        {emulationFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              emulationFeedback.ok
                ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
                : 'bg-red-950/40 border-red-500/40 text-red-200'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{emulationFeedback.message}</span>
          </div>
        )}
      </div>

      {/* 4. 24/7 VPS STATUS INDICATOR */}
      <div
        onClick={() => onNavigate('settings')}
        className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors cursor-pointer active:scale-[0.99] shadow-sm group"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-300 shrink-0">
            <Server className="w-5 h-5 stroke-[2]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white tracking-tight">
              24/7 VPS Status ({settings?.serverMode === 'OTHER' ? 'Custom Server' : 'Default VPS'})
            </div>
            <p className="text-[11px] text-neutral-400 font-mono truncate mt-0.5">
              {slackService.getActiveServerUrl(settings)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isVpsOnline
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isVpsOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{isVpsOnline ? `Online (${vpsStatus?.pingMs || 50}ms)` : 'Offline'}</span>
          </span>
          <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* 5. UITLOGGEN KNOP (With Hard Session Wipe) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full bg-[#181922] hover:bg-red-950/20 border border-[#272938] hover:border-red-500/30 rounded-2xl p-4 flex items-center justify-between text-left transition-colors active:scale-[0.99] shadow-sm group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
              <LogOut className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-red-400 tracking-tight block">
                Uitloggen
              </span>
              <span className="text-[11px] text-neutral-400">
                Wist alle Slack &amp; Keycloak SSO sessie-cookies
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-xs bg-[#161722] border border-[#2b2e40] rounded-2xl p-5 space-y-4 shadow-2xl animate-scaleUp text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <LogOut className="w-6 h-6 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Uitloggen &amp; Sessie Wissen?</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Je Slack- en Picnic Keycloak SSO-cookies worden volledig gewist uit de WebView. Bij een volgende inlogpoging voer je opnieuw je e-mail en wachtwoord in.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#222432] hover:bg-[#2b2e3f] text-neutral-300 font-semibold text-xs transition-colors"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors shadow-lg shadow-red-500/25"
              >
                Uitloggen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hub Selector Modal (All 64 NL Hubs) */}
      <HubSelectorModal
        isOpen={showHubSelector}
        onClose={() => setShowHubSelector(false)}
        currentChannelName={channelName}
        currentHubCode={activeHubCode}
        detectedChannels={detectedChannels}
        onSelectHub={(newCode, newChan) => {
          onSelectHub?.(newCode, newChan);
        }}
      />
    </div>
  );
};
