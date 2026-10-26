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

export const HUB_BY_CODE = Object.fromEntries(PICNIC_HUBS.map(h => [h.code, h]));

export function getHubInfo(code = 'HLM') {
  const clean = (code || 'HLM').toUpperCase().trim();
  return HUB_BY_CODE[clean] || {
    code: clean,
    name: clean === 'HLM' ? 'Helmond' : clean,
    channel: `#nl-dist-runners-${clean.toLowerCase()}`
  };
}
