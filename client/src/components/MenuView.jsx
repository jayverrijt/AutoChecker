import React, { useState } from 'react';
import { 
  User, 
  Settings, 
  ChevronRight, 
  Server, 
  Radio, 
  SlidersHorizontal, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Clock, 
  Zap,
  X,
  RefreshCw,
  Hash,
  ExternalLink,
  MapPin
} from 'lucide-react';
import { slackService } from '../services/slackService';
import { HubSelectorModal } from './HubSelectorModal';

export const MenuView = ({
  onNavigate,
  onLogout,
  botStatus,
  vpsStatus,
  settings,
  isServerConnected = false,
  onSelectHub
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showVpsDetails, setShowVpsDetails] = useState(false);
  const [showHubSelector, setShowHubSelector] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  // Extract runner details from Slack profile / settings
  const rawUsername = settings?.username || botStatus?.authInfo?.user || 'jayverrijt';
  const slackProfile = botStatus?.authInfo?.profile || {};
  let displayName = settings?.realName || slackProfile.realName || settings?.displayName;
  if (!displayName) {
    if (rawUsername.toLowerCase().includes('jay')) {
      displayName = 'Jay Verrijt';
    } else {
      const cleanName = rawUsername.replace(/[0-9_-]/g, ' ').trim();
      displayName = cleanName ? cleanName.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : 'Jay Verrijt';
    }
  }

  const avatarUrl = settings?.avatarUrl || slackProfile.avatarUrl || null;
  const channelName = settings?.channelName || botStatus?.channelName || '#nl-dist-runners-hlm';
  const activeHubCode = (settings?.hubCode || channelName.replace(/^#?nl-dist-runners-/, '') || 'HLM').toUpperCase();
  const detectedChannels = botStatus?.authInfo?.runnerChannels || [];
  
  // Initials (JV)
  const initials = settings?.initials || (displayName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()) || 'JV';

  // Hub Code replaces Runner Code
  const isVpsOnline = isServerConnected || Boolean(vpsStatus?.isConnected);

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <div className="px-4 py-3 space-y-4 pb-28 overflow-y-auto select-none animate-fadeIn">
      {/* 1. TOP PROFILE ROW: Avatar, Name, Hub Code (replaces runnerCode) & Settings Gear */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Avatar Circle: Real Slack Profile Avatar with JV fallback */}
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={displayName} 
              className="w-12 h-12 rounded-full object-cover border border-blue-500/30 shrink-0 shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1e293b] border border-blue-500/30 flex items-center justify-center text-[#3b82f6] font-black text-lg shrink-0 shadow-sm">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <h2 className="text-base font-bold text-white tracking-tight truncate">
              {displayName}
            </h2>
            {/* Replaces Personeelsnummer with Hub Code */}
            <button
              type="button"
              onClick={() => setShowHubSelector(true)}
              className="text-xs text-neutral-400 font-medium tracking-wide mt-0.5 flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer group text-left"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-neutral-200 group-hover:text-blue-400">Hub {activeHubCode}</span>
              <span className="text-neutral-500">•</span>
              <span className="font-mono text-[11px] text-neutral-400 truncate max-w-[130px]">{channelName}</span>
            </button>
          </div>
        </div>

        {/* Gear Icon in top right */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors active:scale-95 shrink-0"
          title="Instellingen"
        >
          <Settings className="w-5 h-5 stroke-[2]" />
        </button>
      </div>

      {/* 2. GROUP 1: Mijn gegevens & 24/7 VPS Daemon (Exact Teamwork Card Style from Screenshot 2) */}
      <div className="space-y-2.5">
        {/* Card 1: Mijn gegevens */}
        <button
          type="button"
          onClick={() => setShowUserDetails(true)}
          className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors active:scale-[0.99] shadow-sm group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-6 h-6 flex items-center justify-center text-neutral-300 shrink-0">
              <User className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white tracking-tight">
                Mijn gegevens
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>

        {/* Card 2: 24/7 VPS Daemon Status */}
        <button
          type="button"
          onClick={() => setShowVpsDetails(true)}
          className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors active:scale-[0.99] shadow-sm group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-6 h-6 flex items-center justify-center text-neutral-300 shrink-0">
              <Server className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <span>24/7 VPS Cloud Daemon</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isVpsOnline
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isVpsOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isVpsOnline ? `Online (${vpsStatus?.pingMs || 50}ms)` : 'Offline'}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </div>
        </button>
      </div>

      {/* 3. GROUP 2: Hub Wisselen (Menu Optie 3), Slack Live Monitor & Instellingen */}
      <div className="space-y-2.5 pt-1">
        {/* Card 3: Distributie Hub Wisselen (Menu Optie 3) */}
        <button
          type="button"
          onClick={() => setShowHubSelector(true)}
          className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors active:scale-[0.99] shadow-sm group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-6 h-6 flex items-center justify-center text-blue-400 shrink-0">
              <MapPin className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Distributie Hub</span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">
                {channelName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 border border-blue-500/30 text-blue-300">
              <span>Hub {activeHubCode}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </div>
        </button>

        {/* Card 4: Slack Live Monitor */}
        <button
          type="button"
          onClick={() => onNavigate('live')}
          className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors active:scale-[0.99] shadow-sm group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-6 h-6 flex items-center justify-center text-neutral-300 shrink-0">
              <Radio className="w-5 h-5 stroke-[2] animate-pulse text-emerald-400" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white tracking-tight">
                Slack Live Monitor &amp; Simulator
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>

        {/* Card 5: Instellingen & Emoji Mapping */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="w-full bg-[#181922] hover:bg-[#20222f] border border-[#272938] rounded-2xl p-4 flex items-center justify-between text-left transition-colors active:scale-[0.99] shadow-sm group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-6 h-6 flex items-center justify-center text-neutral-300 shrink-0">
              <SlidersHorizontal className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white tracking-tight">
                Instellingen &amp; Emoji Mapping
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>
      </div>

      {/* 4. GROUP 3: Uitloggen */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full bg-[#181922] hover:bg-red-950/20 border border-[#272938] hover:border-red-500/30 rounded-2xl p-4 flex items-center justify-between text-left transition-colors active:scale-[0.99] shadow-sm group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-6 h-6 flex items-center justify-center text-red-400 shrink-0">
              <LogOut className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-red-400 tracking-tight">
                Uitloggen
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>
      </div>

      {/* MODAL 1: Mijn Gegevens Details Modal */}
      {showUserDetails && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowUserDetails(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#161722] border border-[#2b2e40] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-slideUp select-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#242738]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Mijn gegevens</h3>
                  <p className="text-[11px] text-neutral-400">Picnic Slack Identiteit</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowUserDetails(false)}
                className="w-8 h-8 rounded-xl bg-[#222534] hover:bg-[#2b2f42] text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Volledige Naam</span>
                <span className="text-white font-bold">{displayName}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Runner Code</span>
                <span className="text-blue-300 font-mono font-bold">{runnerCode}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Slack Account</span>
                <span className="text-white font-mono font-bold">@{rawUsername}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Slack Kanaal</span>
                <span className="text-emerald-300 font-mono font-bold">{channelName}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Sessie Status</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                  Geverifieerd &amp; Actief
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowUserDetails(false);
                onNavigate('settings');
              }}
              className="w-full py-2.5 rounded-xl bg-[#3171f7] hover:bg-[#255fd4] text-white text-xs font-bold transition-all shadow"
            >
              Bewerk Instellingen
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: 24/7 VPS Daemon Details Modal */}
      {showVpsDetails && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowVpsDetails(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#161722] border border-[#2b2e40] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-slideUp select-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#242738]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">24/7 Cloud Daemon</h3>
                  <p className="text-[11px] text-neutral-400">Centrale Runner Engine</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowVpsDetails(false)}
                className="w-8 h-8 rounded-xl bg-[#222534] hover:bg-[#2b2f42] text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Server Host</span>
                <span className="text-white font-mono font-bold">82.165.110.152:3001</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Netwerk Latency</span>
                <span className="text-emerald-300 font-mono font-bold">{vpsStatus?.pingMs || 50}ms</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Kanaal Monitor</span>
                <span className="text-blue-300 font-mono font-bold">{channelName}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0f1015] border border-[#20222f] flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Luistermodus</span>
                <span className="text-white font-bold">24/7 Autonoom</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowVpsDetails(false);
                onNavigate('live');
              }}
              className="w-full py-2.5 rounded-xl bg-[#3171f7] hover:bg-[#255fd4] text-white text-xs font-bold transition-all shadow"
            >
              Open Slack Live Monitor
            </button>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            className="w-full max-w-xs bg-[#161722] border border-[#2b2e40] rounded-2xl p-5 space-y-4 shadow-2xl animate-scaleUp text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <LogOut className="w-6 h-6 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Weet je het zeker?</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Je Slack credentials worden van dit apparaat gewist.
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

      {/* Hub Selector Modal */}
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
