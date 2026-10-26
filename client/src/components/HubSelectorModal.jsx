import React, { useState } from 'react';
import {
  X,
  MapPin,
  Check,
  Search,
  Sparkles,
  ArrowRight,
  Building2
} from 'lucide-react';

/**
 * Official list of all 64 Dutch Picnic Distribution Hubs.
 * CRITICAL RULE: HLM is ALWAYS Helmond (NEVER Haarlem! Haarlem is HAA).
 * Channel convention: #nl-dist-runners-<hubcode_lowercase>
 */
export const PICNIC_HUBS = [
  { code: 'ALE', name: 'Almelo', channel: '#nl-dist-runners-ale' },
  { code: 'ALK', name: 'Alkmaar', channel: '#nl-dist-runners-alk' },
  { code: 'ALM', name: 'Almere', channel: '#nl-dist-runners-alm' },
  { code: 'ALS', name: 'Aalsmeer', channel: '#nl-dist-runners-als' },
  { code: 'ALW', name: 'Alblasserdam', channel: '#nl-dist-runners-alw' },
  { code: 'AMN', name: 'Amersfoort', channel: '#nl-dist-runners-amn' },
  { code: 'AMS', name: 'Amsterdam', channel: '#nl-dist-runners-ams' },
  { code: 'AMV', name: 'Amstelveen', channel: '#nl-dist-runners-amv' },
  { code: 'AMW', name: 'Amsterdam West', channel: '#nl-dist-runners-amw' },
  { code: 'APE', name: 'Apeldoorn', channel: '#nl-dist-runners-ape' },
  { code: 'APN', name: 'Alphen a/d Rijn', channel: '#nl-dist-runners-apn' },
  { code: 'ARN', name: 'Arnhem', channel: '#nl-dist-runners-arn' },
  { code: 'ASS', name: 'Assen', channel: '#nl-dist-runners-ass' },
  { code: 'AWD', name: 'Amsterdam Duivendrecht', channel: '#nl-dist-runners-awd' },
  { code: 'BER', name: 'Berkel en Rodenrijs', channel: '#nl-dist-runners-ber' },
  { code: 'BRD', name: 'Breda', channel: '#nl-dist-runners-brd' },
  { code: 'DHG', name: 'Den Haag', channel: '#nl-dist-runners-dhg' },
  { code: 'DOE', name: 'Doetinchem', channel: '#nl-dist-runners-doe' },
  { code: 'DOR', name: 'Dordrecht', channel: '#nl-dist-runners-dor' },
  { code: 'DRA', name: 'Drachten', channel: '#nl-dist-runners-dra' },
  { code: 'DVR', name: 'Duiven', channel: '#nl-dist-runners-dvr' },
  { code: 'DVT', name: 'Deventer', channel: '#nl-dist-runners-dvt' },
  { code: 'EDV', name: 'Ede/Veenendaal', channel: '#nl-dist-runners-edv' },
  { code: 'EIN', name: 'Eindhoven', channel: '#nl-dist-runners-ein' },
  { code: 'EMM', name: 'Emmen', channel: '#nl-dist-runners-emm' },
  { code: 'ENS', name: 'Enschede', channel: '#nl-dist-runners-ens' },
  { code: 'GOE', name: 'Goes', channel: '#nl-dist-runners-goe' },
  { code: 'GOU', name: 'Gouda', channel: '#nl-dist-runners-gou' },
  { code: 'GRQ', name: 'Groningen', channel: '#nl-dist-runners-grq' },
  { code: 'HAA', name: 'Haarlem', channel: '#nl-dist-runners-haa' },
  { code: 'HEE', name: 'Heerlen', channel: '#nl-dist-runners-hee' },
  { code: 'HFD', name: 'Hoofddorp', channel: '#nl-dist-runners-hfd' },
  { code: 'HKE', name: 'Heemskerk', channel: '#nl-dist-runners-hke' },
  { code: 'HLM', name: 'Helmond', channel: '#nl-dist-runners-hlm' },
  { code: 'HRD', name: 'Harderwijk', channel: '#nl-dist-runners-hrd' },
  { code: 'HRN', name: 'Hoorn', channel: '#nl-dist-runners-hrn' },
  { code: 'HRV', name: 'Heerenveen', channel: '#nl-dist-runners-hrv' },
  { code: 'HTB', name: "'s-Hertogenbosch", channel: '#nl-dist-runners-htb' },
  { code: 'HVS', name: 'Hilversum', channel: '#nl-dist-runners-hvs' },
  { code: 'KTS', name: 'Kaatsheuvel', channel: '#nl-dist-runners-kts' },
  { code: 'LEY', name: 'Lelystad', channel: '#nl-dist-runners-ley' },
  { code: 'LID', name: 'Leiden', channel: '#nl-dist-runners-lid' },
  { code: 'LWR', name: 'Leeuwarden', channel: '#nl-dist-runners-lwr' },
  { code: 'MDL', name: 'Middelburg', channel: '#nl-dist-runners-mdl' },
  { code: 'MEP', name: 'Meppel', channel: '#nl-dist-runners-mep' },
  { code: 'MST', name: 'Maastricht', channel: '#nl-dist-runners-mst' },
  { code: 'NIJ', name: 'Nijmegen', channel: '#nl-dist-runners-nij' },
  { code: 'NWG', name: 'Nieuwegein', channel: '#nl-dist-runners-nwg' },
  { code: 'OMD', name: 'Rotterdam Oud-Mathenesse', channel: '#nl-dist-runners-omd' },
  { code: 'OSS', name: 'Oss', channel: '#nl-dist-runners-oss' },
  { code: 'PUM', name: 'Purmerend', channel: '#nl-dist-runners-pum' },
  { code: 'RID', name: 'Ridderkerk', channel: '#nl-dist-runners-rid' },
  { code: 'ROO', name: 'Roosendaal', channel: '#nl-dist-runners-roo' },
  { code: 'RSP', name: 'Rijswijk/Delft', channel: '#nl-dist-runners-rsp' },
  { code: 'TLB', name: 'Tilburg', channel: '#nl-dist-runners-tlb' },
  { code: 'UTN', name: 'Utrecht Noord', channel: '#nl-dist-runners-utn' },
  { code: 'UTS', name: 'Utrecht Zuid', channel: '#nl-dist-runners-uts' },
  { code: 'VDM', name: 'Veendam', channel: '#nl-dist-runners-vdm' },
  { code: 'VEN', name: 'Venlo', channel: '#nl-dist-runners-ven' },
  { code: 'WAT', name: 'Wateringen', channel: '#nl-dist-runners-wat' },
  { code: 'YPB', name: 'Ypenburg', channel: '#nl-dist-runners-ypb' },
  { code: 'ZIT', name: 'Sittard', channel: '#nl-dist-runners-zit' },
  { code: 'ZTM', name: 'Zoetermeer', channel: '#nl-dist-runners-ztm' },
  { code: 'ZWO', name: 'Zwolle', channel: '#nl-dist-runners-zwo' }
];

export function getHubByCode(code = 'HLM') {
  const clean = (code || 'HLM').toUpperCase().trim();
  return (
    PICNIC_HUBS.find((h) => h.code === clean) || {
      code: clean,
      name: clean === 'HLM' ? 'Helmond' : clean,
      channel: `#nl-dist-runners-${clean.toLowerCase()}`
    }
  );
}

export const HubSelectorModal = ({
  isOpen,
  onClose,
  currentChannelName = '#nl-dist-runners-hlm',
  currentHubCode = 'HLM',
  detectedChannels = [],
  onSelectHub
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const activeCode = (currentHubCode || currentChannelName.replace(/^#?nl-dist-runners-/, '') || 'HLM').toUpperCase();
  const activeHubObj = getHubByCode(activeCode);

  const q = searchQuery.trim().toLowerCase();
  const filteredHubs = PICNIC_HUBS.filter(
    (h) =>
      h.code.toLowerCase().includes(q) ||
      h.name.toLowerCase().includes(q) ||
      h.channel.toLowerCase().includes(q)
  );

  const handleSelect = (code, channel) => {
    try {
      navigator.vibrate?.(15);
    } catch (_) {}
    const finalCode = code.toUpperCase();
    const finalChannel = channel || `#nl-dist-runners-${finalCode.toLowerCase()}`;
    onSelectHub(finalCode, finalChannel);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#161720] border-t sm:border border-[#292c3a] rounded-t-3xl sm:rounded-3xl h-[82vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp mb-14 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#242735] flex items-center justify-between shrink-0 bg-[#161720]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Kies Distributie Hub (64 NL Hubs)</h2>
              <p className="text-xs text-neutral-400">
                Kanaal: <span className="font-mono text-neutral-300">#nl-dist-runners-&lt;hub&gt;</span>
              </p>
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

        {/* Search bar */}
        <div className="p-3 border-b border-[#242735] bg-[#12131a] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op code (HLM, EIN, KTS) of stad (Helmond, Eindhoven)..."
              className="w-full bg-[#1b1c26] border border-[#2b2e3e] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Scrollable List of 64 Hubs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Detected channels from Slack user account */}
          {detectedChannels && detectedChannels.length > 0 && !q && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gedetecteerd in jouw Slack account</span>
              </div>
              <div className="space-y-2">
                {detectedChannels.map((ch) => {
                  const isCur = ch.hubCode === activeCode;
                  const hubInfo = getHubByCode(ch.hubCode);
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
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isCur ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {ch.hubCode}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>
                              {hubInfo.name} ({ch.hubCode})
                            </span>
                            {isCur && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold">
                                Actief
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{ch.name}</div>
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

          {/* All 64 Dutch Picnic Hubs */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Alle 64 Nederlandse Picnic Hubs</span>
              </div>
              <span className="text-[10px] text-neutral-500 font-mono">{filteredHubs.length} resultaten</span>
            </div>

            {filteredHubs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredHubs.map((hub) => {
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
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCur ? 'bg-blue-500 text-white' : 'bg-[#222432] text-neutral-300'
                          }`}
                        >
                          {hub.code}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{hub.name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono truncate">{hub.channel}</div>
                        </div>
                      </div>
                      {isCur && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-400">
                Geen Picnic Hub gevonden voor &ldquo;{searchQuery}&rdquo;.
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#242735] bg-[#111218] text-center shrink-0">
          <p className="text-[11px] text-neutral-400">
            Geselecteerd: <span className="font-bold text-white">{activeHubObj.name} ({activeCode})</span> &bull;{' '}
            <span className="font-mono text-neutral-300">{activeHubObj.channel}</span>
          </p>
        </div>
      </div>
    </div>
  );
};
