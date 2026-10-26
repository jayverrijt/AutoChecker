import ical from 'node-ical';

export const BLOCK_DEFAULT_TIMES = {
  M1: { startTime: '06:30', endTime: '09:15' },
  M2: { startTime: '09:15', endTime: '12:00' },
  M3: { startTime: '10:00', endTime: '12:45' },
  M4: { startTime: '11:00', endTime: '13:45' },
  S1: { startTime: '14:00', endTime: '16:45' },
  S2: { startTime: '16:45', endTime: '19:30' },
  S3: { startTime: '19:30', endTime: '22:15' },
  S4: { startTime: '20:00', endTime: '22:30' }
};

export const VALID_SHIFT_BLOCKS = ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'];

function formatAmsterdamDate(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(dateObj); // YYYY-MM-DD
}

function formatAmsterdamTime(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(dateObj); // HH:mm
}

/**
 * Splits a raw shift string from Teamwork iCal into individual blocks.
 * Examples:
 * - "Trip shift S1 at HLM Picnic" -> { blocks: ['S1'], hub: 'HLM' }
 * - "Trip shift S1-S2-S3 at HLM Picnic" -> { blocks: ['S1', 'S2', 'S3'], hub: 'HLM' }
 * - "Trip shift M1-M2 at EIN Picnic" -> { blocks: ['M1', 'M2'], hub: 'EIN' }
 */
export function parseShiftSummary(summary = '', defaultHub = 'HLM') {
  if (!summary || typeof summary !== 'string') return null;

  const text = summary.trim();

  // Official Teamwork pattern: "Trip shift [Shift nummering] at [LOCATION] Picnic"
  const officialMatch = text.match(/Trip\s+shift\s+([A-Za-z0-9-]+)(?:\s+at\s+([A-Za-z0-9]{3}))?/i);
  let rawBlockStr = null;
  let extractedHub = null;

  if (officialMatch) {
    rawBlockStr = officialMatch[1].toUpperCase();
    if (officialMatch[2]) {
      extractedHub = officialMatch[2].toUpperCase();
    }
  } else {
    // Fallback pattern: look for M1..M4 / S1..S4 combinations like M1-M2, S1-S2-S3, S1, etc.
    const fallbackMatch = text.match(/\b((?:[MS][1-4])(?:-[MS][1-4])*)\b/i);
    if (fallbackMatch) {
      rawBlockStr = fallbackMatch[1].toUpperCase();
    }
    const hubMatch = text.match(/\bat\s+([A-Z]{3})\b/i);
    if (hubMatch) {
      extractedHub = hubMatch[1].toUpperCase();
    }
  }

  if (!rawBlockStr) return null;

  // Split combined shifts by '-' (e.g. 'S1-S2-S3' -> ['S1', 'S2', 'S3'])
  const parts = rawBlockStr
    .split('-')
    .map(p => p.trim().toUpperCase())
    .filter(p => VALID_SHIFT_BLOCKS.includes(p));

  if (parts.length === 0) return null;

  // Deduplicate while preserving order
  const uniqueBlocks = [...new Set(parts)];

  return {
    blocks: uniqueBlocks,
    hub: extractedHub || (defaultHub || 'HLM').toUpperCase(),
    isCombined: uniqueBlocks.length > 1,
    rawBlockStr
  };
}

/**
 * Parses raw iCal string content into uncoupled individual shift records.
 */
export function parseIcalContent(rawIcalString, defaultHub = 'HLM') {
  if (!rawIcalString || typeof rawIcalString !== 'string') {
    return [];
  }

  const parsedEvents = ical.sync.parseICS(rawIcalString);
  const scheduledShifts = [];

  for (const key of Object.keys(parsedEvents)) {
    const ev = parsedEvents[key];
    if (!ev || ev.type !== 'VEVENT') continue;

    const summary = ev.summary || '';
    const parsedSummary = parseShiftSummary(summary, defaultHub);
    if (!parsedSummary) continue;

    const startDate = ev.start ? new Date(ev.start) : null;
    const endDate = ev.end ? new Date(ev.end) : null;
    if (!startDate || isNaN(startDate.getTime())) continue;

    const shiftDate = formatAmsterdamDate(startDate);
    if (!shiftDate) continue;

    const { blocks, hub } = parsedSummary;
    const rawUid = ev.uid || `${shiftDate}-${blocks.join('-')}`;

    // Calculate individual block start/end times when a combined shift is split
    const totalDurationMs =
      endDate && !isNaN(endDate.getTime()) && endDate > startDate
        ? endDate.getTime() - startDate.getTime()
        : 0;

    blocks.forEach((blockId, idx) => {
      let startTime = BLOCK_DEFAULT_TIMES[blockId]?.startTime || '14:00';
      let endTime = BLOCK_DEFAULT_TIMES[blockId]?.endTime || '16:45';

      if (totalDurationMs > 0) {
        if (blocks.length === 1) {
          startTime = formatAmsterdamTime(startDate) || startTime;
          endTime = formatAmsterdamTime(endDate) || endTime;
        } else {
          // Divide combined shift interval proportionally across the split blocks
          const sliceMs = totalDurationMs / blocks.length;
          const subStart = new Date(startDate.getTime() + sliceMs * idx);
          const subEnd = new Date(startDate.getTime() + sliceMs * (idx + 1));
          startTime = formatAmsterdamTime(subStart) || startTime;
          endTime = formatAmsterdamTime(subEnd) || endTime;
        }
      }

      scheduledShifts.push({
        shiftDate,
        shiftBlock: blockId,
        startTime,
        endTime,
        locationHub: hub,
        rawIcalUid: `${rawUid}#${blockId}`,
        summary
      });
    });
  }

  // Sort chronologically by date and block order
  scheduledShifts.sort((a, b) => {
    if (a.shiftDate !== b.shiftDate) return a.shiftDate.localeCompare(b.shiftDate);
    return VALID_SHIFT_BLOCKS.indexOf(a.shiftBlock) - VALID_SHIFT_BLOCKS.indexOf(b.shiftBlock);
  });

  return scheduledShifts;
}

/**
 * Fetches and parses a Teamwork iCal feed URL.
 */
export async function fetchAndParseIcal(icalUrl, defaultHub = 'HLM') {
  if (!icalUrl || typeof icalUrl !== 'string' || !icalUrl.trim()) {
    throw new Error('Geen geldige Teamwork iCal-link opgegeven.');
  }

  let normalizedUrl = icalUrl.trim().replace(/^webcal:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error('iCal-link moet beginnen met https:// of webcal://');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Teamwork-Vrijcheck/2.0 (Picnic Runner Sync)',
        'Accept': 'text/calendar, text/plain, */*'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Teamwork iCal server antwoordde met HTTP ${response.status}`);
    }

    const rawIcal = await response.text();
    if (!rawIcal.includes('BEGIN:VCALENDAR')) {
      throw new Error('De opgehaalde link bevat geen geldig iCal-rooster (BEGIN:VCALENDAR ontbreekt).');
    }

    const shifts = parseIcalContent(rawIcal, defaultHub);
    return {
      ok: true,
      shifts,
      totalShifts: shifts.length,
      syncedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
  }
}
