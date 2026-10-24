import React, { useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { 
  LogIn, 
  KeyRound, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Radio, 
  Zap,
  Lock
} from 'lucide-react';
import { PicnicMascot } from './PicnicMascot';
import { sounds } from '../utils/audio';

const SlackAuth = registerPlugin('SlackAuth');

export const LoginView = ({
  onLoginSuccess,
  initialError = null
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [showManual, setShowManual] = useState(false);

  // Manual inputs fallback
  const [manualToken, setManualToken] = useState('');
  const [manualCookie, setManualCookie] = useState('');
  const [manualChannel, setManualChannel] = useState('#nl-dist-runners-hlm');
  const [isVerifying, setIsVerifying] = useState(false);

  const handlePicnicSSOLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    const url = 'https://picnic.enterprise.slack.com';

    try {
      if (Capacitor.isNativePlatform()) {
        const res = await SlackAuth.login({ workspaceUrl: url });
        if (res && res.token) {
          sounds.playSuccess();
          await onLoginSuccess({
            slackToken: res.token,
            slackCookie: res.cookie || '',
            workspaceUrl: url
          });
          return;
        } else {
          setErrorMessage('Geen geldig token ontvangen van Slack.');
        }
      } else {
        // Desktop browser fallback
        try {
          await Browser.open({ url });
        } catch (e) {
          window.open(url, '_blank');
        }
        setShowManual(true);
        setErrorMessage('Log in via de geopende browser en plak je xoxc token hieronder.');
      }
    } catch (err) {
      console.warn('Login error:', err);
      const msg = typeof err === 'string' ? err : err?.message || 'Inloggen mislukt';
      if (!msg.includes('geannuleerd')) {
        setErrorMessage(msg);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualToken.trim()) {
      setErrorMessage('Vul een geldig Slack token in (begint met xoxc-)');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      await onLoginSuccess({
        slackToken: manualToken.trim(),
        slackCookie: manualCookie.trim(),
        channelName: manualChannel.trim() || '#nl-dist-runners-hlm'
      });
      sounds.playSuccess();
    } catch (err) {
      setErrorMessage(err.message || 'Kon verbinding niet verifiëren');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen h-[100dvh] bg-[#0c0d11] text-neutral-100 flex flex-col justify-between p-6 select-none overflow-y-auto animate-fadeIn">
      {/* Top Section: Picnic Branding & Hero */}
      <div className="pt-notch-safe sm:pt-8 flex flex-col items-center text-center space-y-4 max-w-sm mx-auto w-full">
        {/* Animated App Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#e11d48] to-[#9f1239] flex items-center justify-center shadow-xl shadow-red-500/25 border border-red-400/30">
            <Zap className="w-10 h-10 text-white fill-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0c0d11] flex items-center justify-center">
            <Radio className="w-3 h-3 text-white" />
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Picnic Teamwork • Vrijcheck</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Welkom bij Vrijcheck
          </h1>
          <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
            Log eenmalig in met je Picnic Slack account om je shifts automatisch op de milliseconde vrij te checken.
          </p>
        </div>

        {/* Error notification if session expired */}
        {errorMessage && (
          <div className="w-full p-3.5 rounded-2xl bg-red-950/70 border border-red-500/40 text-left flex items-start gap-2.5 animate-slideUp">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200">
              <span className="font-bold block">Let op:</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Middle Section: Primary Login Actions */}
      <div className="max-w-sm mx-auto w-full space-y-3.5 my-auto py-4">
        {/* Big Picnic Keycloak Login Button */}
        <button
          type="button"
          onClick={handlePicnicSSOLogin}
          disabled={isLoggingIn}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#e11d48] via-[#be123c] to-[#9f1239] hover:from-[#f43f5e] hover:to-[#be123c] text-white font-extrabold text-sm flex items-center justify-center gap-3 shadow-lg shadow-red-600/35 border border-red-400/40 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {isLoggingIn ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Verbinden met Picnic Keycloak...</span>
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              <span>Inloggen met Picnic Slack</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-neutral-400">
          Opent het officiële Picnic SSO inlogscherm via onze veilige in-app Chromium container.
        </p>

        {/* Feature Highlights */}
        <div className="bg-[#15171f] border border-[#232634] rounded-2xl p-3.5 space-y-2.5 text-xs text-neutral-300">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span>Reageert direct om <strong>17:10</strong> en <strong>10:10</strong></span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span>Tokens blijven 100% lokaal beveiligd op dit toestel</span>
          </div>
        </div>

        {/* Manual Input Toggle */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowManual(!showManual)}
            className="w-full text-center text-xs text-neutral-400 hover:text-neutral-200 flex items-center justify-center gap-1.5 py-1.5 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Of tokens handmatig invoeren</span>
            {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showManual && (
            <form onSubmit={handleManualSubmit} className="mt-3 p-3.5 bg-[#171922] border border-[#272a38] rounded-2xl space-y-3 animate-slideUp">
              <div>
                <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                  Slack xoxc Token
                </label>
                <input
                  type="text"
                  placeholder="xoxc-..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full bg-[#101116] border border-[#2a2d3c] rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                  Slack d-cookie (xoxd)
                </label>
                <input
                  type="text"
                  placeholder="xoxd-..."
                  value={manualCookie}
                  onChange={(e) => setManualCookie(e.target.value)}
                  className="w-full bg-[#101116] border border-[#2a2d3c] rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono focus:border-red-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || !manualToken.trim()}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs border border-neutral-700 transition-all disabled:opacity-50"
              >
                {isVerifying ? 'Verifiëren...' : 'Opslaan & Doorgaan'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Mascot & Footer */}
      <div className="pt-2 pb-2 text-center text-[11px] text-neutral-500 max-w-sm mx-auto w-full">
        <p>Picnic Vrijcheck v2.4 • Copyright Jay Verrijt {new Date().getFullYear()}</p>
      </div>
    </div>
  );
};
