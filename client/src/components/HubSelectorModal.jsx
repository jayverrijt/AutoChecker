import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Check, 
  Search, 
  Sparkles, 
  Radio, 
  ArrowRight,
  Hash,
  Building2
} from 'lucide-react';

export const PICNIC_HUBS = [
  { code: 'HLM', name: 'Haarlem', channel: '#nl-dist-runners-hlm' },
  { code: 'AMS', name: 'Amsterdam', channel: '#nl-dist-runners-ams' },
  { code: 'UTR', name: 'Utrecht', channel: '#nl-dist-runners-utr' },
  { code: 'RTM', name: 'Rotterdam', channel: '#nl-dist-runners-rtm' },
  { code: 'DHG', name: 'Den Haag', channel: '#nl-dist-runners-dhg' },
  { code: 'EIN', name: 'Eindhoven', channel: '#nl-dist-runners-ein' },
  { code: 'TIL', name: 'Tilburg', channel: '#nl-dist-runners-til' },
  { code: 'ALM', name: 'Almere', channel: '#nl-dist-runners-alm' },
  { code: 'ARN', name: 'Arnhem', channel: '#nl-dist-runners-arn' },
  { code: 'NYM', name: 'Nijmegen', channel: '#nl-dist-runners-nym' },
  { code: 'BRE', name: 'Breda', channel: '#nl-dist-runners-bre' },
  { code: 'APE', name: 'Apeldoorn', channel: '#nl-dist-runners-ape' },
  { code: 'ENS', name: 'Enschede', channel: '#nl-dist-runners-ens' },
  { code: 'GRO', name: 'Groningen', channel: '#nl-dist-runners-gro' },
  { code: 'ZWD', name: 'Zwijndrecht', channel: '#nl-dist-runners-zwd' },
  { code: 'DOR', name: 'Dordrecht', channel: '#nl-dist-runners-dor' },
  { code: 'LEY', name: 'Leiden', channel: '#nl-dist-runners-ley' },
  { code: 'DEL', name: 'Delft', channel: '#nl-dist-runners-del' },
  { code: 'HVS', name: 'Hilversum', channel: '#nl-dist-runners-hvs' },
  { code: 'AMF', name: 'Amersfoort', channel: '#nl-dist-runners-amf' },
  { code: 'ZWL', name: 'Zwolle', channel: '#nl-dist-runners-zwl' },
  { code: 'ALK', name: 'Alkmaar', channel: '#nl-dist-runners-alk' },
  { code: 'MAA', name: 'Maastricht', channel: '#nl-dist-runners-maa' }
];

export const HubSelectorModal = ({
  isOpen,
  onClose,
  currentChannelName = '#nl-dist-runners-hlm',
  currentHubCode = 'HLM',
  detectedChannels = [],
  onSelectHub
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customCode, setCustomCode] = useState('');

  if (!isOpen) return null;

  // Active hub normalized
  const activeCode = (currentHubCode || currentChannelName.replace(/^#?nl-dist-runners-/, '')).toUpperCase();

  // Filter hubs by search
  const filteredHubs = PICNIC_HUBS.filter(h => 
    h.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.channel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (code, channel) => {
    try { navigator.vibrate?.(15); } catch (_) {}
    const finalCode = code.toUpperCase();
    const finalChannel = channel || `#nl-dist-runners-${finalCode.toLowerCase()}`;
    onSelectHub(finalCode, finalChannel);
    onClose();
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const clean = customCode.trim().replace(/^#?nl-dist-runners-/, '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!clean) return;
    const finalCode = clean.toUpperCase();
    const finalChannel = `#nl-dist-runners-${clean.toLowerCase()}`;
    handleSelect(finalCode, finalChannel);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-md bg-[#161720] border-t sm:border border-[#292c3a] rounded-t-3xl sm:rounded-3xl h-[78vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp mb-14 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (always sticky at top) */}
        <div className="p-4 border-b border-[#242735] flex items-center justify-between shrink-0 bg-[#161720]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Kies Distributie Hub</h2>
              <p className="text-xs text-neutral-400">Patroon: <span className="font-mono text-neutral-300">#nl-dist-runners-[hub]</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar (always sticky below header) */}
        <div className="p-3 border-b border-[#242735] bg-[#12131a] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek hub (bijv. HLM, Amsterdam, UTR)..."
              className="w-full bg-[#1b1c26] border border-[#2b2e3e] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Content list (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Detected channels from Slack user account */}
          {detectedChannels && detectedChannels.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gedetecteerd in jouw Slack account</span>
              </div>
              <div className="space-y-2">
                {detectedChannels.map(ch => {
                  const isCur = ch.hubCode === activeCode;
                  return (
                    <button
                      key={ch.id || ch.name}
                      type="button"
                      onClick={() => handleSelect(ch.hubCode, ch.name)}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between border transition-all text-left ${
                        isCur
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                          : 'bg-[#1b1c26] border-[#292c3a] hover:bg-[#222432] text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isCur ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-300'
                        }`}>
                          {ch.hubCode}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>Hub {ch.hubCode}</span>
                            {isCur && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold">Actief</span>}
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                            {ch.name}
                          </div>
                        </div>
                      </div>
                      {isCur ? (
                        <Check className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-neutral-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preset Picnic Hubs List */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>Picnic Distributie Hubs</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredHubs.map(hub => {
                const isCur = hub.code === activeCode;
                return (
                  <button
                    key={hub.code}
                    type="button"
                    onClick={() => handleSelect(hub.code, hub.channel)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all text-left ${
                      isCur
                        ? 'bg-blue-600/20 border-blue-500/50 text-white ring-1 ring-blue-500/30'
                        : 'bg-[#1a1b24] border-[#262835] hover:bg-[#20222f] text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isCur ? 'bg-blue-500 text-white' : 'bg-[#222432] text-neutral-300'
                      }`}>
                        {hub.code}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {hub.name}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono truncate">
                          {hub.channel}
                        </div>
                      </div>
                    </div>
                    {isCur && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Hub code input */}
          <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-[#242735]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Aangepaste Hub Code
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="Bijv. ZWD of nl-dist-runners-zwd"
                  className="w-full bg-[#1b1c26] border border-[#2b2e3e] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 font-mono transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!customCode.trim()}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
              >
                Instellen
              </button>
            </div>
          </form>
        </div>

        {/* Footer info (sticky at bottom) */}
        <div className="p-3 border-t border-[#242735] bg-[#111218] text-center shrink-0">
          <p className="text-[11px] text-neutral-400">
            Huidige actieve hub: <span className="font-bold text-white">Hub {activeCode}</span> (<span className="font-mono text-neutral-300">{currentChannelName}</span>)
          </p>
        </div>
      </div>
    </div>
  );
};
