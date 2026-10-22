import React, { useState, useEffect } from 'react';
import { Browser } from '@capacitor/browser';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { slackService, DEFAULT_PROD_SERVER_URL, DEFAULT_PROD_SERVER_TOKEN } from '../services/slackService';

const SlackAuth = registerPlugin('SlackAuth');
import { 
  Key, 
  Hash, 
  Bot, 
  Smile, 
  Volume2, 
  ShieldCheck, 
  Save, 
  RefreshCw, 
  Info,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Copy,
  Check,
  HelpCircle,
  Play,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  LogIn,
  Server,
  Zap,
  Activity,
  HardDrive
} from 'lucide-react';
import { SlackEmoji } from './SlackEmoji';
import { sounds } from '../utils/audio';

export const SettingsView = ({
  settings,
  onSaveSettings,
  botStatus,
  onTestConnection
}) => {
  const [formData, setFormData] = useState({
    workspaceUrl: 'https://picnic.enterprise.slack.com',
    slackToken: '',
    slackCookie: '',
    channelName: '#nl-dist-runners-hlm',
    channelId: '',
    botSenderName: 'Day-Planning-Sender',
    autoReact: true,
    pollIntervalMs: 1000,
    soundEnabled: true,
    serverUrl: DEFAULT_PROD_SERVER_URL,
    serverToken: DEFAULT_PROD_SERVER_TOKEN,
    emojiMapping: {
      M1: '1-red',
      M2: '2-red',
      S1: '1-red',
      S2: '2-red',
      S3: '3-red'
    }
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showHelper, setShowHelper] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // 24/7 Server state
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [serverTestResult, setServerTestResult] = useState(null);
  const [isEmulating, setIsEmulating] = useState(false);
  const [emulationResult, setEmulationResult] = useState(null);
  const [emulatePeriod, setEmulatePeriod] = useState('OCHTEND');

  const handleOpenSlackLogin = async () => {
    const url = formData.workspaceUrl || 'https://picnic.enterprise.slack.com';
    
    if (Capacitor.isNativePlatform()) {
      try {
        setIsTesting(true);
        const res = await SlackAuth.login({ workspaceUrl: url });
        if (res && res.token) {
          const updated = {
            ...formData,
            slackToken: res.token,
            slackCookie: res.cookie || formData.slackCookie
          };
          setFormData(updated);
          await onSaveSettings(updated);
          sounds.playSuccess();
          
          // Test the real connection immediately with updated credentials
          const testRes = await onTestConnection(updated);
          setTestResult(testRes);
          return;
        }
      } catch (err) {
        console.warn('SlackAuth login cancelled or error:', err);
        const msg = typeof err === 'string' ? err : err?.message;
        if (msg && msg.includes('geannuleerd')) {
          setTestResult({ ok: false, error: 'Inloggen geannuleerd.' });
          return;
        }
      } finally {
        setIsTesting(false);
      }
      return; // Never fall through to Browser.open on native devices
    }


    // Fallback for Desktop Web preview only
    try {
      await Browser.open({ url });
    } catch (e) {
      window.open(url, '_blank');
    }
  };



  useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        ...settings,
        workspaceUrl: settings.workspaceUrl || 'https://picnic.enterprise.slack.com',
        emojiMapping: {
          ...prev.emojiMapping,
          ...(settings.emojiMapping || {})
        }
      }));
    }
  }, [settings]);

  const handleChange = (field, value) => {
    let cleanVal = value;
    if (field === 'slackCookie' || field === 'slackToken') {
      cleanVal = cleanVal.trim().replace(/^["']|["']$/g, '');
    }
    setFormData((prev) => ({
      ...prev,
      [field]: cleanVal
    }));
  };

  const handleEmojiChange = (block, emoji) => {
    setFormData((prev) => ({
      ...prev,
      emojiMapping: {
        ...prev.emojiMapping,
        [block]: emoji
      }
    }));
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // First save current form data so backend uses latest inputs
      await onSaveSettings(formData);
      const res = await onTestConnection();
      setTestResult(res);
      if (res?.ok) {
        sounds.playSuccess();
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestServerConnection = async () => {
    setIsTestingServer(true);
    setServerTestResult(null);
    try {
      await onSaveSettings(formData);
      const res = await slackService.testServerConnection(formData.serverUrl, formData.serverToken);
      setServerTestResult(res);
      if (res?.ok) {
        sounds.playSuccess();
      }
    } catch (err) {
      setServerTestResult({ ok: false, error: err.message });
    } finally {
      setIsTestingServer(false);
    }
  };

  const handleRunEmulation = async () => {
    setIsEmulating(true);
    setEmulationResult(null);
    try {
      await onSaveSettings(formData);
      const res = await slackService.emulateOnServer(formData.serverUrl, formData.serverToken, {
        period: emulatePeriod,
        minDelayMs: 40,
        maxDelayMs: 160
      });
      setEmulationResult(res);
      if (res?.ok && res?.emulation?.benchmark?.reactionSuccess) {
        sounds.playSuccess();
      }
    } catch (err) {
      setEmulationResult({ ok: false, error: err.message });
    } finally {
      setIsEmulating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      sounds.enabled = formData.soundEnabled;
      sounds.playSuccess();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const [curlInput, setCurlInput] = useState('');

  const handleParseCurl = (rawText) => {
    if (!rawText || !rawText.trim()) return;

    let updated = { ...formData };
    let foundSomething = false;
    
    // Extract Token (xoxc-... or xoxp-...)
    const tokenMatch = rawText.match(/(xoxc-[A-Za-z0-9-]+|xoxp-[A-Za-z0-9-]+)/);
    if (tokenMatch) {
      updated.slackToken = tokenMatch[1];
      foundSomething = true;
    }

    // Extract Cookie d=...
    const cookieMatch = rawText.match(/[;\s'"&]d=([xoxd-]*[A-Za-z0-9%_-]+)/);
    if (cookieMatch) {
      updated.slackCookie = cookieMatch[1];
      foundSomething = true;
    }

    // Extract Channel ID (e.g. CAM2MJTA9)
    const channelMatch = rawText.match(/(?:channel[=:]["']?|archives\/|channel%22%3A%22)([A-Z0-9]{9,12})/);
    if (channelMatch) {
      updated.channelId = channelMatch[1];
      foundSomething = true;
    }

    // Extract Workspace URL
    const wsMatch = rawText.match(/https:\/\/([a-zA-Z0-9.-]+\.slack\.com)/);
    if (wsMatch) {
      updated.workspaceUrl = `https://${wsMatch[1]}`;
    }

    if (foundSomething) {
      setFormData(updated);
      sounds.playSuccess();
      setCurlInput('');
      setTestResult({
        ok: true,
        auth: { user: `Gegevens succesvol geëxtraheerd! (Token: ${updated.slackToken?.slice(0, 10)}... / Cookie: ${updated.slackCookie?.slice(0, 8)}... / Kanaal: ${updated.channelId || 'onbekend'}). Klik nu op Testen!` }
      });
    } else {
      setTestResult({
        ok: false,
        error: 'Geen Slack token of cookie gevonden in de geplakte tekst. Kopieer een verzoek met "Copy as cURL" vanuit het Network tabblad.'
      });
    }
  };

  const copyConsoleSnippet = () => {
    const code = `(() => {
  let token = null;
  try {
    const cfg = JSON.parse(localStorage.getItem('localConfig_v2') || '{}');
    if (cfg.teams) {
      const teamId = Object.keys(cfg.teams)[0];
      token = cfg.teams[teamId]?.token;
    }
  } catch (e) {}

  if (!token) {
    for (let i = 0; i < localStorage.length; i++) {
      const val = localStorage.getItem(localStorage.key(i));
      const match = val && typeof val === 'string' && val.match(/xoxc-[A-Za-z0-9-]+/);
      if (match) { token = match[0]; break; }
    }
  }

  if (!token && window.TS?.boot_data?.api_token) {
    token = window.TS.boot_data.api_token;
  }

  console.log("%c--- JOUW PICNIC SLACK CREDENTIALS ---", "color:#10b981;font-weight:bold;font-size:15px;");
  if (token) {
    console.log("%cTOKEN (xoxc):", "color:#3b82f6;font-weight:bold;", token);
    copy(token);
    alert("Token (xoxc) gevonden en gekopieerd naar je klembord!\\n\\nVoor de Cookie (d):\\nGa naar Storage/Application -> Cookies -> https://picnic.enterprise.slack.com -> zoek de cookie genaamd 'd'.");
  } else {
    console.warn("Token niet in localStorage. Gebruik de Network-tab methode (Copy as cURL op conversations.history)!");
    alert("Gebruik de Network tab: klik met rechtermuisknop op conversations.history -> Copy as cURL!");
  }
})();`;
    
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 3000);
  };

  return (
    <div className="p-4 space-y-5 pb-24 overflow-y-auto">
      {/* Picnic Enterprise Slack Status Banner */}
      <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center">
              <SlackEmoji name="picnic" size="sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Picnic Enterprise Slack</h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                {formData.workspaceUrl || 'picnic.enterprise.slack.com'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHelper(!showHelper)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Hulp bij inloggen</span>
          </button>
        </div>

        {/* Step-by-step instructions accordion */}
        {showHelper && (
          <div className="bg-[#141418] border border-[#262835] rounded-xl p-3.5 space-y-2.5 text-xs text-neutral-300 animate-fadeIn">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>Hoe haal je je sessie op in 15 seconden?</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-neutral-300 leading-relaxed">
              <li>
                Open <a href="https://picnic.enterprise.slack.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">picnic.enterprise.slack.com</a> in je browser (Chrome/Edge/Brave).
              </li>
              <li>
                Druk op <kbd className="bg-neutral-800 px-1 py-0.5 rounded border border-neutral-700 font-mono">F12</kbd> (of <kbd className="bg-neutral-800 px-1 py-0.5 rounded border border-neutral-700 font-mono">Cmd+Option+I</kbd> op Mac) om DevTools te openen.
              </li>
              <li>
                Ga naar het tabblad <strong>Console</strong>.
              </li>
              <li>
                Klik op de knop hieronder en plak het script in de console:
              </li>
            </ol>

            <button
              type="button"
              onClick={copyConsoleSnippet}
              className="w-full py-2 px-3 bg-[#232530] hover:bg-[#2b2d3a] border border-[#353748] rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
            >
              {copiedSnippet ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Script Gekopieerd!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Kopieer 1-regel console snippet</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-neutral-500">
              Het script toont direct je <code className="text-neutral-400">xoxc-</code> token en <code className="text-neutral-400">d</code> cookie.
            </p>
          </div>
        )}
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* In-App Slack Account & One-Click Login Card */}
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LogIn className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Picnic Slack Account</h3>
            </div>
            {botStatus?.authInfo?.user ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Sessie Actief
              </span>
            ) : (
              <span className="text-[11px] text-neutral-400 font-medium">Niet verbonden</span>
            )}
          </div>

          {botStatus?.authInfo?.user ? (
            <div className="bg-[#20222a] border border-[#2c2f3b] rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{botStatus.authInfo.user}</div>
                  <div className="text-[11px] text-neutral-400">{botStatus.authInfo.team || 'Picnic'} • #{formData.channelName}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenSlackLogin}
                className="py-1.5 px-2.5 bg-[#2a2d38] hover:bg-[#343846] text-neutral-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Heropen inloggen in Slack"
              >
                <span>Vernieuw</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-neutral-300 leading-relaxed">
                Log direct in met je Picnic account via de mobiele browser om je sessie automatisch te koppelen:
              </p>
              <button
                type="button"
                onClick={handleOpenSlackLogin}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Inloggen bij Picnic Slack</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>
            </div>
          )}

          {/* Test real connection button */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full py-2.5 px-3 bg-[#272a35] hover:bg-[#303442] active:scale-[0.99] border border-[#3b3f52] rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Slack Verbinding Testen...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>Controleer Verbinding &amp; Status</span>
              </>
            )}
          </button>

          {/* Test results banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 animate-fadeIn ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/40 border-red-500/40 text-red-200'
              }`}
            >
              {testResult.ok ? (
                <>
                  <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Verbonden met Picnic Slack!</span>
                  </div>
                  <div className="text-[11px] text-emerald-300/90 pl-5">
                    Runner: <strong>{testResult.auth?.user}</strong> • Team: {testResult.auth?.team}
                  </div>
                  {testResult.channel?.ok && (
                    <div className="text-[11px] text-emerald-300/80 pl-5">
                      Kanaal #{formData.channelName} actief ({testResult.channel.messageCount} recente berichten)
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-bold flex items-center gap-1.5 text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Verbinding Mislukt</span>
                  </div>
                  <div className="text-[11px] text-red-300/90 pl-5">
                    {testResult.error || 'Controleer je token en cookie.'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 24/7 Webserver & Cloud Daemon Card */}
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>24/7 Webserver &amp; Cloud Daemon</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    AANBEVOLEN
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Laat de server 24/7 luisteren — telefoon mag uitstaan om 10:10 &amp; 17:10
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {/* Server URL */}
            <div>
              <label className="text-xs text-neutral-300 font-semibold block mb-1">
                Webserver URL
              </label>
              <div className="flex items-center gap-1.5 bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white">
                <HardDrive className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={formData.serverUrl}
                  onChange={(e) => handleChange('serverUrl', e.target.value)}
                  placeholder="bijv. http://82.165.110.152:3001"
                  className="bg-transparent outline-none w-full font-mono text-xs placeholder:text-neutral-500"
                />
              </div>
            </div>

            {/* Server Token */}
            <div>
              <label className="text-xs text-neutral-300 font-semibold block mb-1">
                Server Authenticatie Token (<code className="text-blue-300 font-mono">SERVER_API_KEY</code>)
              </label>
              <div className="flex items-center gap-1.5 bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white">
                <Key className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  type="password"
                  value={formData.serverToken}
                  onChange={(e) => handleChange('serverToken', e.target.value)}
                  placeholder="vc_prod_..."
                  className="bg-transparent outline-none w-full font-mono text-xs placeholder:text-neutral-500"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestServerConnection}
                disabled={isTestingServer}
                className="py-2.5 px-3 bg-[#272a35] hover:bg-[#303442] active:scale-[0.99] border border-[#3b3f52] rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isTestingServer ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>Test Server</span>
              </button>

              <button
                type="button"
                onClick={handleRunEmulation}
                disabled={isEmulating}
                className="py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-50"
              >
                {isEmulating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                )}
                <span>Emuleer Post</span>
              </button>
            </div>

            {/* Emulation Shift toggle */}
            <div className="flex items-center justify-between bg-[#14151b] p-2 rounded-xl border border-[#22242f] text-xs">
              <span className="text-neutral-400 text-[11px]">Emulatie Shift Periode:</span>
              <div className="flex gap-1">
                {['OCHTEND', 'MIDDAG'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEmulatePeriod(p)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      emulatePeriod === p
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1e2029] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Server test result feedback */}
            {serverTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 animate-fadeIn ${
                  serverTestResult.ok
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/40 text-red-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {serverTestResult.ok ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{serverTestResult.message || 'Verbonden met 24/7 webserver!'}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{serverTestResult.error}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Emulation result benchmark feedback */}
            {emulationResult && (
              <div className="p-3 rounded-xl border bg-[#141620] border-blue-500/40 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between font-bold text-white">
                  <div className="flex items-center gap-1.5 text-blue-300">
                    <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>DayPlanner Emulatie Resultaat</span>
                  </div>
                  {emulationResult.emulation?.benchmark?.reactionProcessingMs && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black border border-emerald-500/40">
                      ⚡ {emulationResult.emulation.benchmark.reactionProcessingMs}ms latency
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-neutral-300 space-y-1 pl-1">
                  {emulationResult.emulation?.benchmark?.reactionSuccess ? (
                    <div className="text-emerald-300 font-medium">
                      ✓ Reactie <strong>:{emulationResult.emulation.benchmark.emoji}:</strong> geplaatst voor shift <strong>{emulationResult.emulation.benchmark.matchedShift}</strong>!
                    </div>
                  ) : (
                    <div className="text-amber-300">
                      ℹ {emulationResult.emulation?.benchmark?.reason || 'Geen reactie vereist (geen actieve shift gevonden)'}
                    </div>
                  )}
                  <div className="text-neutral-400 font-mono text-[10px]">
                    Netwerk jitter: {emulationResult.emulation?.benchmark?.simulatedJitterMs || 0}ms • Totale doorlooptijd: {emulationResult.emulation?.benchmark?.totalReactionTimeMs || 0}ms
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Advanced / Manual Tokens Section */}
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[#202128] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-neutral-400" />
              <div>
                <h4 className="text-xs font-bold text-white">Geavanceerd: Handmatige Tokens</h4>
                <p className="text-[10px] text-neutral-400">Tokens, cookie en kanaal handmatig aanpassen</p>
              </div>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-4 pt-0 space-y-3.5 border-t border-[#262832] mt-2">
              {/* Quick cURL importer */}
              <div className="bg-[#141519] border border-[#2b2d39] rounded-xl p-3 space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Snelle Import via cURL</span>
                    <span className="text-[10px] bg-emerald-600/30 text-emerald-300 font-semibold px-1.5 py-0.5 rounded">1-Click</span>
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Plak hier een gekopieerd verzoek uit het Network tabblad:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={curlInput}
                    onChange={(e) => {
                      setCurlInput(e.target.value);
                      handleParseCurl(e.target.value);
                    }}
                    placeholder="Plak hier gekopieerde cURL..."
                    className="w-full bg-[#1e2027] border border-[#353847] rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleParseCurl(curlInput)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow"
                  >
                    Importeer
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Workspace URL
                </label>
                <div className="flex items-center gap-1.5 bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white">
                  <Globe className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    value={formData.workspaceUrl}
                    onChange={(e) => handleChange('workspaceUrl', e.target.value)}
                    placeholder="https://picnic.enterprise.slack.com"
                    className="bg-transparent outline-none w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  User Token (<code className="text-blue-300 font-mono">xoxc-...</code>)
                </label>
                <input
                  type="password"
                  value={formData.slackToken || ''}
                  onChange={(e) => handleChange('slackToken', e.target.value)}
                  placeholder="xoxc-..."
                  className="w-full bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Session Cookie <code className="text-blue-300 font-mono">d</code> (<code className="text-blue-300 font-mono">xoxd-...</code>)
                </label>
                <input
                  type="password"
                  value={formData.slackCookie || ''}
                  onChange={(e) => handleChange('slackCookie', e.target.value)}
                  placeholder="xoxd-..."
                  className="w-full bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Kanaalnaam of Link</label>
                  <div className="flex items-center gap-1.5 bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white">
                    <Hash className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      value={formData.channelName}
                      onChange={(e) => handleChange('channelName', e.target.value)}
                      className="bg-transparent outline-none w-full font-mono text-xs"
                      placeholder="#nl-dist-runners-hlm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Kanaal ID (Optioneel)</label>
                  <input
                    type="text"
                    value={formData.channelId || ''}
                    onChange={(e) => handleChange('channelId', e.target.value)}
                    className="w-full bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                    placeholder="C0123456789"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Shift Block -> Emoji Mapping */}
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Emoji per Shift Blok</h3>
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">1-red, 2-red, 3-red</span>
          </div>

          <p className="text-xs text-neutral-400">
            Koppeling van Picnic shiftblokken aan de juiste rode emoji reactie:
          </p>

          <div className="space-y-2">
            {[
              { block: 'M1', defaultEmoji: '1-red', desc: 'Ochtend Shift 1 (06:30 - 09:15)' },
              { block: 'M2', defaultEmoji: '2-red', desc: 'Ochtend Shift 2 (09:15 - 12:00)' },
              { block: 'S1', defaultEmoji: '1-red', desc: 'Middag Shift 1 (14:00 - 16:45)' },
              { block: 'S2', defaultEmoji: '2-red', desc: 'Middag Shift 2 (16:45 - 19:30)' },
              { block: 'S3', defaultEmoji: '3-red', desc: 'Middag Shift 3 (19:30 - 22:15)' },
            ].map(({ block, desc }) => {
              const currentEmoji = formData.emojiMapping?.[block] || '1-red';
              return (
                <div
                  key={block}
                  className="flex items-center justify-between bg-[#22242c] border border-[#2c2e3a] p-2.5 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-300 font-black flex items-center justify-center text-xs">
                      {block}
                    </span>
                    <div>
                      <div className="font-bold text-white">{desc}</div>
                      <div className="text-[11px] text-neutral-400">Reageert met :{currentEmoji}:</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <SlackEmoji name={currentEmoji} size="md" />
                    <input
                      type="text"
                      value={currentEmoji}
                      onChange={(e) => handleEmojiChange(block, e.target.value)}
                      className="w-20 bg-[#17181d] border border-[#343644] rounded-lg px-2 py-1 text-center font-mono text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Polling Speed & Toggles */}
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Automatisch Reageren</div>
              <div className="text-[11px] text-neutral-400">
                Direct reageren zodra Day-Planning-Sender post
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoReact}
                onChange={(e) => handleChange('autoReact', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#262732]">
            <div>
              <div className="text-xs font-bold text-white">Controle Snelheid (Polling)</div>
              <div className="text-[11px] text-neutral-400">Hoe snel het kanaal wordt gescand</div>
            </div>
            <select
              value={formData.pollIntervalMs}
              onChange={(e) => handleChange('pollIntervalMs', Number(e.target.value))}
              className="bg-[#22242c] border border-[#2e303c] rounded-lg px-2.5 py-1 text-xs text-white outline-none"
            >
              <option value="500">500ms (Bliksemsnel)</option>
              <option value="1000">1000ms (Aanbevolen)</option>
              <option value="2000">2000ms</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#262732]">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-xs font-bold text-white">Geluidseffecten</div>
                <div className="text-[11px] text-neutral-400">Notificatiechime bij reactie</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.soundEnabled}
                onChange={(e) => handleChange('soundEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Instellingen Opgeslagen!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Instellingen Opslaan &amp; Toepassen</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
