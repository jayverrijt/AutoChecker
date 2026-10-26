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
  MapPin,
  Calendar,
  ArrowRight,
  User
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { slackService } from '../services/slackService';
import { HubSelectorModal, getHubByCode } from './HubSelectorModal';
import { extractFirstName } from '../utils/constants';

const SlackAuth = registerPlugin('SlackAuth');

export const LoginView = ({
  onLoginSuccess,
  initialError = null
}) => {
  // Wizard step: 'auth' -> 'profile_hub' -> 'ical'
  const [wizardStep, setWizardStep] = useState('auth');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [showManual, setShowManual] = useState(false);
  const [showHubModal, setShowHubModal] = useState(false);

  // Manual inputs fallback
  const [manualToken, setManualToken] = useState('');
  const [manualCookie, setManualCookie] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Captured Slack & Onboarding state
  const [capturedAuth, setCapturedAuth] = useState(null);
  const [firstName, setFirstName] = useState('Runner');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [personalEmail, setPersonalEmail] = useState('');
  const [hubCode, setHubCode] = useState('HLM');
  const [detectedChannels, setDetectedChannels] = useState([]);
  const [autoHubDetected, setAutoHubDetected] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const proceedAfterSlackAuth = async (credentials) => {
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const merged = slackService.saveSettings(credentials);
      const res = await slackService.testConnection(merged);
      if (!res?.ok || !res?.auth) {
        throw new Error(res?.error || 'Slack sessie kon niet worden geverifieerd.');
      }

      const profile = res.auth.profile || {};
      const extractedFirst = extractFirstName(
        profile.displayName || merged.displayName,
        profile.realName || merged.realName || res.auth.user,
        'Runner'
      );
      const channels = res.auth.runnerChannels || [];

      setCapturedAuth({
        ...credentials,
        userId: res.auth.userId,
        username: res.auth.user
      });
      setFirstName(extractedFirst);
      setDisplayName(profile.displayName || profile.realName || res.auth.user || extractedFirst);
      setAvatarUrl(profile.avatarUrl || null);
      setDetectedChannels(channels);

      if (channels.length === 1) {
        setHubCode(channels[0].hubCode);
        setAutoHubDetected(true);
      } else if (channels.length > 1) {
        setHubCode(channels[0].hubCode);
        setAutoHubDetected(false);
      } else {
        setHubCode(merged.hubCode || 'HLM');
        setAutoHubDetected(false);
      }

      // If user already completed onboarding previously, go straight in
      if (merged.onboardingCompleted && merged.personalEmail && merged.icalUrl) {
        await onLoginSuccess({
          ...merged,
          ...credentials,
          firstName: extractedFirst,
          displayName: profile.displayName || merged.displayName,
          avatarUrl: profile.avatarUrl || merged.avatarUrl
        });
        return;
      }

      sounds.playSuccess();
      setWizardStep('profile_hub');
    } catch (err) {
      setErrorMessage(err.message || 'Kon Slack verbinding niet verifiëren');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePicnicSSOLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    const url = 'https://picnic.enterprise.slack.com';

    try {
      if (Capacitor.isNativePlatform()) {
        const res = await SlackAuth.login({ workspaceUrl: url });
        if (res && res.token) {
          await proceedAfterSlackAuth({
            slackToken: res.token,
            slackCookie: res.cookie || '',
            workspaceUrl: url
          });
          return;
        } else {
          setErrorMessage('Geen geldig token ontvangen van Slack.');
        }
      } else {
        try {
          await Browser.open({ url });
        } catch (_) {
          window.open(url, '_blank');
        }
        setShowManual(true);
        setErrorMessage('Log in via de geopende browser en plak je xoxc token en xoxd cookie hieronder.');
      }
    } catch (err) {
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
    await proceedAfterSlackAuth({
      slackToken: manualToken.trim(),
      slackCookie: manualCookie.trim()
    });
  };

  const handleProfileStepNext = (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!firstName.trim()) {
      setErrorMessage('Vul je voornaam in.');
      return;
    }
    if (!personalEmail.trim() || !personalEmail.includes('@')) {
      setErrorMessage('Vul een geldig persoonlijk e-mailadres in.');
      return;
    }
    if (/@teampicnic\.com$/i.test(personalEmail.trim())) {
      setErrorMessage('Gebruik een persoonlijk e-mailadres (expliciet géén @teampicnic.com adres).');
      return;
    }

    setWizardStep('ical');
  };

  const handleFinishOnboarding = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsCompleting(true);

    try {
      const hubObj = getHubByCode(hubCode);
      const payload = {
        ...(capturedAuth || {}),
        firstName: firstName.trim() || 'Runner',
        displayName: displayName || firstName.trim() || 'Runner',
        personalEmail: personalEmail.trim(),
        avatarUrl,
        hubCode: hubObj.code,
        channelName: hubObj.channel,
        icalUrl: icalUrl.trim(),
        onboardingCompleted: true
      };

      const onboardRes = await slackService.completeOnboarding(payload);
      if (onboardRes && onboardRes.ok === false && onboardRes.error) {
        throw new Error(onboardRes.error);
      }

      sounds.playSuccess();
      await onLoginSuccess(payload);
    } catch (err) {
      setErrorMessage(err.message || 'Kon registratie niet voltooien.');
    } finally {
      setIsCompleting(false);
    }
  };

  const activeHubObj = getHubByCode(hubCode);

  return (
    <div className="min-h-screen h-[100dvh] bg-[#0c0d11] text-neutral-100 flex flex-col justify-between p-6 select-none overflow-y-auto animate-fadeIn">
      {/* Top Branding */}
      <div className="pt-notch-safe sm:pt-6 flex flex-col items-center text-center space-y-3 max-w-sm mx-auto w-full">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#e11d48] to-[#9f1239] flex items-center justify-center shadow-xl shadow-red-500/25 border border-red-400/30">
            <Zap className="w-8 h-8 text-white fill-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0c0d11] flex items-center justify-center">
            <Radio className="w-2.5 h-2.5 text-white" />
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Teamwork Vrijcheck v2.0</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {wizardStep === 'auth'
              ? 'Welkom bij Vrijcheck'
              : wizardStep === 'profile_hub'
              ? `Hi, ${firstName}! 👋`
              : 'Teamwork Rooster Koppelen'}
          </h1>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed max-w-xs mx-auto">
            {wizardStep === 'auth'
              ? 'Log in met je Picnic Slack account om je shifts sub-seconde (100ms–180ms) vrij te checken.'
              : wizardStep === 'profile_hub'
              ? 'Controleer je persoonlijke gegevens en je gedetecteerde Picnic Hub.'
              : 'Koppel je persoonlijke Teamwork iCal-link om je ingeroosterde shifts automatisch in te laden.'}
          </p>
        </div>

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

      {/* STEP 1: SLACK AUTHENTICATION */}
      {wizardStep === 'auth' && (
        <div className="max-w-sm mx-auto w-full space-y-3.5 my-auto py-4">
          <button
            type="button"
            onClick={handlePicnicSSOLogin}
            disabled={isLoggingIn || isVerifying}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#e11d48] via-[#be123c] to-[#9f1239] hover:from-[#f43f5e] hover:to-[#be123c] text-white font-extrabold text-sm flex items-center justify-center gap-3 shadow-lg shadow-red-600/35 border border-red-400/40 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isLoggingIn || isVerifying ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Verbinden met Picnic Keycloak / Slack...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Inloggen met Picnic Slack</span>
              </>
            )}
          </button>

          <div className="bg-[#15171f] border border-[#232634] rounded-2xl p-3.5 space-y-2.5 text-xs text-neutral-300">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span>
                Plaatst sub-seconde je emoji-reactie om <strong>10:10</strong> &amp; <strong>17:10</strong>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span>Haalt automatisch je Slack profiel &amp; Hub-kanaal op</span>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="w-full text-center text-xs text-neutral-400 hover:text-neutral-200 flex items-center justify-center gap-1.5 py-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Of tokens handmatig invoeren</span>
              {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showManual && (
              <form
                onSubmit={handleManualSubmit}
                className="mt-2 p-3.5 bg-[#171922] border border-[#272a38] rounded-2xl space-y-3"
              >
                <div>
                  <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                    Slack Client Token (xoxc-...)
                  </label>
                  <input
                    type="text"
                    placeholder="xoxc-..."
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="w-full bg-[#101116] border border-[#2a2d3c] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                    Slack Cookie d (xoxd-...)
                  </label>
                  <input
                    type="text"
                    placeholder="xoxd-..."
                    value={manualCookie}
                    onChange={(e) => setManualCookie(e.target.value)}
                    className="w-full bg-[#101116] border border-[#2a2d3c] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-red-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isVerifying || !manualToken.trim()}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all disabled:opacity-50"
                >
                  {isVerifying ? 'Verifiëren...' : 'Verifieer & Ga Door'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: PERSONAL DETAILS & AUTOMATIC HUB DETECTION */}
      {wizardStep === 'profile_hub' && (
        <form onSubmit={handleProfileStepNext} className="max-w-sm mx-auto w-full space-y-3.5 my-auto py-3">
          <div className="bg-[#161822] border border-[#262938] rounded-2xl p-4 space-y-3.5">
            {/* Avatar & Slack identity */}
            <div className="flex items-center gap-3 pb-3 border-b border-[#232634]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-12 h-12 rounded-full object-cover border border-blue-500/40"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="text-xs font-bold text-emerald-400">✓ Slack Profiel Gekoppeld</div>
                <div className="text-sm font-bold text-white">{displayName || firstName}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                Voornaam (vooringevuld vanuit Slack)
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Bijv. Jay"
                className="w-full bg-[#101117] border border-[#2a2d3e] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                Persoonlijk e-mailadres <span className="text-red-400">(géén @teampicnic.com)</span>
              </label>
              <input
                type="email"
                required
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                placeholder="jouwnaam@gmail.com"
                className="w-full bg-[#101117] border border-[#2a2d3e] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Automatic Hub Detection */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                {autoHubDetected ? 'Automatisch Gedetecteerde Hub' : 'Kies jouw primaire Picnic Hub'}
              </label>

              {detectedChannels.length > 1 && (
                <div className="space-y-1.5 mb-2">
                  {detectedChannels.map((ch) => {
                    const hObj = getHubByCode(ch.hubCode);
                    const isSelected = hubCode === ch.hubCode;
                    return (
                      <button
                        key={ch.hubCode}
                        type="button"
                        onClick={() => setHubCode(ch.hubCode)}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-white font-bold'
                            : 'bg-[#101117] border-[#262938] text-neutral-300'
                        }`}
                      >
                        <span>
                          {hObj.name} ({ch.hubCode}) &bull; {ch.name}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowHubModal(true)}
                className="w-full bg-[#101117] hover:bg-[#151720] border border-[#2a2d3e] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-white"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span>
                    {activeHubObj.name} ({activeHubObj.code}) &bull; {activeHubObj.channel}
                  </span>
                </span>
                <span className="text-blue-400 font-bold">Wijzig</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-5 rounded-2xl bg-[#3171f7] hover:bg-[#255fd4] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
          >
            <span>Volgende: Teamwork iCal-link</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STEP 3: TEAMWORK ICAL-LINK KOPPELING */}
      {wizardStep === 'ical' && (
        <form onSubmit={handleFinishOnboarding} className="max-w-sm mx-auto w-full space-y-3.5 my-auto py-3">
          <div className="bg-[#161822] border border-[#262938] rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Calendar className="w-4 h-4" />
              <span>Teamwork Agenda Synchronisatie</span>
            </div>

            <div className="bg-[#101117] border border-[#242736] rounded-xl p-3 space-y-1.5 text-xs text-neutral-300">
              <div className="font-bold text-white text-[11px] uppercase tracking-wider text-blue-400">
                Stappenplan in de Teamwork app:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-300 leading-relaxed">
                <li>
                  Open de officiële <strong>Teamwork</strong> app en ga naar <strong>Menu</strong>.
                </li>
                <li>
                  Tik rechtsboven op <strong>Instellingen (⚙️)</strong>.
                </li>
                <li>
                  Kies <strong>Rooster met je agenda verbinden</strong>.
                </li>
                <li>
                  Kopieer de link (<code className="text-blue-300">https://people-planning-proxy-prod.nl.picnic...</code>) en plak deze hier.
                </li>
              </ol>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                Plak hier je Teamwork iCal-link
              </label>
              <input
                type="url"
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
                placeholder="https://people-planning-proxy-prod.nl.picnic..."
                className="w-full bg-[#101117] border border-[#2a2d3e] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-neutral-400 mt-1">
                Gecombineerde shifts (zoals M1-M2 of S1-S2-S3) worden automatisch losgekoppeld in individuele blokken.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWizardStep('profile_hub')}
              className="py-3.5 px-4 rounded-2xl bg-[#20222f] text-neutral-300 font-bold text-xs"
            >
              Terug
            </button>
            <button
              type="submit"
              disabled={isCompleting}
              className="flex-1 py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isCompleting ? 'Rooster Inladen...' : ' Setup Voltooien & Starten'}
            </button>
          </div>
        </form>
      )}

      {/* Hub Selector Modal */}
      <HubSelectorModal
        isOpen={showHubModal}
        onClose={() => setShowHubModal(false)}
        currentChannelName={activeHubObj.channel}
        currentHubCode={hubCode}
        detectedChannels={detectedChannels}
        onSelectHub={(code) => setHubCode(code)}
      />

      <div className="pt-2 pb-1 text-center text-[11px] text-neutral-500 max-w-sm mx-auto w-full">
        <p>Teamwork Vrijcheck v2.0 &bull; Alle 64 NL Hubs</p>
      </div>
    </div>
  );
};
