import React, { useState } from 'react';
import { 
  Radio, 
  Settings, 
  LogOut, 
  ChevronRight, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';
import { PicnicMascot } from './PicnicMascot';
import { slackService } from '../services/slackService';

export const MenuView = ({
  onNavigate,
  onLogout,
  botStatus,
  settings,
  isServerConnected = false
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isConnected = botStatus?.status === 'connected' || botStatus?.status === 'polling';
  const username = botStatus?.authInfo?.user || 'jayverrijt';
  const channelName = settings?.channelName || botStatus?.channelName || '#nl-dist-runners-hlm';

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <div className="px-4 py-4 space-y-4 pb-28 overflow-y-auto select-none animate-fadeIn">
      {/* Top Header */}
      <div className="pt-2 pb-1">
        <h1 className="text-2xl font-black text-white tracking-tight">Menu</h1>
        <p className="text-xs text-neutral-400">Beheer je Picnic Vrijcheck bot &amp; sessies</p>
      </div>

      {/* Runner Profile Card */}
      <div className="bg-[#181a24] border border-[#262835] rounded-3xl p-4 relative overflow-hidden shadow-lg">
        <div className="flex items-center gap-3.5 relative z-10">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3171f7] to-[#1e40af] flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/30 shrink-0">
            {username.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white truncate">
                {username}
              </h2>
              {isConnected ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Verbonden</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold shrink-0">
                  <span>Niet verbonden</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-xs text-neutral-400 font-mono truncate">
                {channelName}
              </p>
              <span className="text-neutral-600 text-xs">•</span>
              {isServerConnected ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-blue-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  24/7 Cloud Daemon Actief
                </span>
              ) : slackService.isTestingMode() ? (
                <span className="text-[11px] text-amber-400 font-mono">
                  Test Modus (Debugger)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-red-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                  VPS Niet Verbonden
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mascot watermark in corner */}
        <div className="absolute right-0 -bottom-4 w-24 h-24 opacity-20 pointer-events-none">
          <PicnicMascot className="w-full h-full" />
        </div>
      </div>

      {/* Primary Navigation Menu Group */}
      <div className="bg-[#181a24] border border-[#262835] rounded-3xl overflow-hidden divide-y divide-[#242735] shadow-sm">
        {/* 1. Slack Live Monitor */}
        <button
          type="button"
          onClick={() => onNavigate('live')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#202330] transition-colors group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Slack Live Monitor</span>
                {isConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                )}
              </div>
              <div className="text-xs text-neutral-400 truncate">
                Live berichten stream, emoji logs &amp; simulaties
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-neutral-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>

        {/* 2. Instellingen */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#202330] transition-colors group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">
                Instellingen &amp; Sessie
              </div>
              <div className="text-xs text-neutral-400 truncate">
                Slack cookies (d-cookie), tokens &amp; emoji mappings
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-neutral-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>
      </div>

      {/* Release Times Quick Reference */}
      <div className="bg-[#181a24] border border-[#262835] rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>Day-Planning Release Tijden</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#12141c] border border-[#222533] rounded-2xl p-2.5">
            <div className="text-amber-300 font-bold">🌅 Ochtend (M1, M2)</div>
            <div className="text-white font-extrabold text-sm mt-0.5">17:10 uur</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Dag van tevoren</div>
          </div>

          <div className="bg-[#12141c] border border-[#222533] rounded-2xl p-2.5">
            <div className="text-blue-300 font-bold">☀️ Middag (S1-S3)</div>
            <div className="text-white font-extrabold text-sm mt-0.5">10:10 uur</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Zelfde dag</div>
          </div>
        </div>

        <p className="text-[11px] text-neutral-400 leading-tight">
          De planner post meestal rond de :28 seconden. De bot luistert de hele minuut continu op de achtergrond.
        </p>
      </div>

      {/* Logout Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full p-4 rounded-3xl bg-red-950/20 hover:bg-red-950/40 border border-red-500/25 flex items-center justify-between text-left transition-colors active:scale-[0.99] group shadow-sm"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 group-hover:scale-105 transition-transform">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-red-400">
                Uitloggen
              </div>
              <div className="text-xs text-neutral-400 truncate">
                Ontkoppel Slack sessie en wis tokens van dit toestel
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-red-500/60 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>
      </div>

      {/* Version & Copyright note */}
      <div className="text-center pt-2">
        <p className="text-[11px] text-neutral-500">
          Picnic Vrijcheck v2.4 • Copyright Jay Verrijt {new Date().getFullYear()}
        </p>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#181a24] border border-[#2e3142] rounded-3xl p-5 max-w-xs w-full space-y-4 shadow-2xl animate-slideUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Uitloggen?</h3>
                <p className="text-xs text-neutral-400">Sessie wordt verwijderd</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Weet je zeker dat je wilt uitloggen? Je opgeslagen Slack token en cookie worden gewist. Je moet opnieuw inloggen om shifts automatisch vrij te checken.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-2xl bg-[#232736] hover:bg-[#2d3246] text-neutral-300 text-xs font-bold transition-colors active:scale-95"
              >
                Annuleren
              </button>

              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/30 transition-colors active:scale-95 flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Ja, Uitloggen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
