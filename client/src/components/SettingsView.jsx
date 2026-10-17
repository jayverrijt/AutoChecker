import React, { useState, useEffect } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { SlackEmoji } from './SlackEmoji';
import { sounds } from '../utils/audio';

export const SettingsView = ({
  settings,
  onSaveSettings,
  onReconnect,
  botStatus
}) => {
  const [formData, setFormData] = useState({
    slackToken: '',
    channelName: '#nl-dist-runners-hlm',
    channelId: '',
    botSenderName: 'Day-Planning-Sender',
    autoReact: true,
    pollIntervalMs: 2500,
    soundEnabled: true,
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

  useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        ...settings,
        emojiMapping: {
          ...prev.emojiMapping,
          ...(settings.emojiMapping || {})
        }
      }));
    }
  }, [settings]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
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

  return (
    <div className="p-4 space-y-5 pb-24 overflow-y-auto">
      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Slack Authentication Card */}
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Slack Authenticatie</h3>
          </div>

          <div>
            <label className="text-xs text-neutral-400 block mb-1">
              Slack User OAuth Token (<code className="text-blue-300 font-mono">xoxp-...</code>) of Bot Token (<code className="text-blue-300 font-mono">xoxb-...</code>)
            </label>
            <input
              type="password"
              value={formData.slackToken || ''}
              onChange={(e) => handleChange('slackToken', e.target.value)}
              placeholder="xoxp-..."
              className="w-full bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-neutral-400 mt-1.5 flex items-start gap-1">
              <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
              <span>
                Tip: Als je reageert vanuit je persoonlijke Slack account, gebruik dan je eigen <code className="text-neutral-300">xoxp-</code> user token met <code className="text-neutral-300">reactions:write</code> en <code className="text-neutral-300">channels:history</code> permissies. Zonder token draait de bot in ingebouwde simulatiemodus.
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Slack Kanaal</label>
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
              <label className="text-xs text-neutral-400 block mb-1">Afzender Filter</label>
              <div className="flex items-center gap-1.5 bg-[#22242c] border border-[#2e303c] rounded-xl px-3 py-2 text-xs text-white">
                <Bot className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={formData.botSenderName}
                  onChange={(e) => handleChange('botSenderName', e.target.value)}
                  className="bg-transparent outline-none w-full font-sans text-xs"
                  placeholder="Day-Planning-Sender"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Shift Block -> Emoji Mapping */}
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Emoji Configuratie per Shift</h3>
            </div>
            <span className="text-[11px] text-neutral-400">1-red, 2-red, 3-red</span>
          </div>

          <p className="text-xs text-neutral-400">
            Volgens Picnic runner regels reageert de bot met:
          </p>

          <div className="space-y-2">
            {[
              { block: 'M1', defaultEmoji: '1-red', desc: 'Ochtend Shift 1' },
              { block: 'M2', defaultEmoji: '2-red', desc: 'Ochtend Shift 2' },
              { block: 'S1', defaultEmoji: '1-red', desc: 'Middag Shift 1' },
              { block: 'S2', defaultEmoji: '2-red', desc: 'Middag Shift 2' },
              { block: 'S3', defaultEmoji: '3-red', desc: 'Middag Shift 3' },
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

        {/* Toggles */}
        <div className="bg-[#1a1b20] border border-[#272832] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Automatisch Reageren</div>
              <div className="text-[11px] text-neutral-400">
                Direct reageren zodra Day-Planning-Sender bericht plaatst
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
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-xs font-bold text-white">Geluidseffecten</div>
                <div className="text-[11px] text-neutral-400">
                  Speel een meldingstoon af bij een reactie
                </div>
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
              <span>Instellingen Opslaan &amp; Herverbinden</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
