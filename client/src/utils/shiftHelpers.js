import { SHIFT_BLOCKS, getBlockInfo } from './constants';

export const ALL_BLOCK_IDS = ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'];
export const DAY_NAMES_2 = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];

export function formatDay2Letters(date) {
  if (!date) return 'MA';
  return DAY_NAMES_2[date.getDay()];
}

export function getShiftForBlock(shiftsData, dateKey, blockId) {
  const dayData = shiftsData?.[dateKey];
  const blockDef = getBlockInfo(blockId);
  const defaultTimes = blockDef?.defaultTime?.split(' - ') || ['14:00', '16:45'];

  const base = {
    block: blockId,
    startTime: defaultTimes[0],
    endTime: defaultTimes[1],
    scheduled: false,
    vrijcheckActive: false,
    vrijcheckStatus: null,
    reactionStatus: null
  };

  if (!dayData) return base;

  if (dayData[blockId]) {
    const raw = dayData[blockId];
    return {
      ...base,
      ...raw,
      block: blockId,
      scheduled: raw.scheduled !== undefined ? Boolean(raw.scheduled) : true,
      vrijcheckActive: Boolean(raw.vrijcheckActive),
      vrijcheckStatus: raw.vrijcheckStatus || (raw.vrijcheckActive ? 'STANDBY' : null)
    };
  }

  if (Array.isArray(dayData)) {
    const found = dayData.find((s) => s && s.block === blockId);
    if (found) {
      return {
        ...base,
        ...found,
        block: blockId,
        scheduled: true,
        vrijcheckActive: Boolean(found.vrijcheckActive),
        vrijcheckStatus: found.vrijcheckStatus || (found.vrijcheckActive ? 'STANDBY' : null)
      };
    }
  }

  if (dayData.block === blockId) {
    return {
      ...base,
      ...dayData,
      block: blockId,
      scheduled: true,
      vrijcheckActive: Boolean(dayData.vrijcheckActive),
      vrijcheckStatus: dayData.vrijcheckStatus || (dayData.vrijcheckActive ? 'STANDBY' : null)
    };
  }

  return base;
}

/**
 * Returns ONLY the shifts that the runner is actually scheduled for on a given day
 * (from iCal `scheduled_shifts` or active `vrijcheck_requests`).
 */
export function getScheduledDayBlocks(shiftsData, dateKey) {
  const dayData = shiftsData?.[dateKey];
  if (!dayData || typeof dayData !== 'object') return [];

  const blocks = [];
  for (const blockDef of SHIFT_BLOCKS) {
    if (dayData[blockDef.id]) {
      const shift = getShiftForBlock(shiftsData, dateKey, blockDef.id);
      if (shift.scheduled || shift.vrijcheckActive || shift.reactionStatus) {
        blocks.push({ blockDef, shift });
      }
    }
  }
  return blocks;
}

export function getDayBlocks(shiftsData, dateKey) {
  return ALL_BLOCK_IDS.map((blockId) => getShiftForBlock(shiftsData, dateKey, blockId));
}

export function saveShiftBlock(shiftsData, dateKey, blockId, updatedFields) {
  const currentDay = shiftsData?.[dateKey];
  const newDayDict =
    currentDay && typeof currentDay === 'object' && !Array.isArray(currentDay)
      ? { ...currentDay }
      : {};

  const existing = getShiftForBlock(shiftsData, dateKey, blockId);
  const nextActive =
    updatedFields.vrijcheckActive !== undefined ? Boolean(updatedFields.vrijcheckActive) : existing.vrijcheckActive;

  newDayDict[blockId] = {
    ...existing,
    ...updatedFields,
    block: blockId,
    scheduled: true,
    vrijcheckActive: nextActive,
    vrijcheckStatus: nextActive ? (updatedFields.vrijcheckStatus || existing.vrijcheckStatus || 'STANDBY') : null
  };

  return {
    ...shiftsData,
    [dateKey]: newDayDict
  };
}

export function toggleVrijcheckForBlock(shiftsData, dateKey, blockId) {
  const current = getShiftForBlock(shiftsData, dateKey, blockId);
  const nextActive = !current.vrijcheckActive;
  return saveShiftBlock(shiftsData, dateKey, blockId, {
    vrijcheckActive: nextActive,
    vrijcheckStatus: nextActive ? 'STANDBY' : null,
    reactionStatus: nextActive ? current.reactionStatus : null
  });
}

function parseIcalDateString(rawVal = '') {
  const clean = rawVal.trim();
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/i);
  if (!m) return null;
  const [, yr, mo, da, hr = '00', mi = '00', se = '00', isUtc] = m;
  if (isUtc) {
    return new Date(`${yr}-${mo}-${da}T${hr}:${mi}:${se}Z`);
  }
  return new Date(Number(yr), Number(mo) - 1, Number(da), Number(hr), Number(mi), Number(se));
}

function formatNlDate(d) {
  if (!d || isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function formatNlTime(d) {
  if (!d || isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

function parseSummaryClient(summary = '', defaultHub = 'HLM') {
  const text = (summary || '').trim();
  if (!text) return null;

  const officialMatch = text.match(/Trip\s+shift\s+([A-Za-z0-9-]+)(?:\s+at\s+([A-Za-z0-9]{3}))?/i);
  let rawBlockStr = null;
  let extractedHub = null;

  if (officialMatch) {
    rawBlockStr = officialMatch[1].toUpperCase();
    if (officialMatch[2]) extractedHub = officialMatch[2].toUpperCase();
  } else {
    const fallbackMatch = text.match(/\b((?:[MS][1-4])(?:-[MS][1-4])*)\b/i);
    if (fallbackMatch) rawBlockStr = fallbackMatch[1].toUpperCase();
    const hubMatch = text.match(/\bat\s+([A-Z]{3})\b/i);
    if (hubMatch) extractedHub = hubMatch[1].toUpperCase();
  }

  if (!rawBlockStr) return null;

  const blocks = [
    ...new Set(
      rawBlockStr
        .split('-')
        .map((p) => p.trim().toUpperCase())
        .filter((p) => ALL_BLOCK_IDS.includes(p))
    )
  ];
  if (blocks.length === 0) return null;

  return {
    blocks,
    rawBlockStr,
    hub: extractedHub || (defaultHub || 'HLM').toUpperCase()
  };
}

/**
 * Client-side iCal parser fallback that splits combined shifts (M1-M2, S1-S2-S3, etc.)
 * and preserves existing vrijcheckActive / vrijcheckStatus flags.
 */
export function parseIcalTextToShifts(rawIcalText, existingShifts = {}, defaultHub = 'HLM') {
  if (!rawIcalText || typeof rawIcalText !== 'string' || !rawIcalText.includes('BEGIN:VCALENDAR')) {
    return null;
  }

  // Unfold RFC 5545 folded lines
  const unfolded = rawIcalText.replace(/\r?\n[ \t]/g, '');
  const eventChunks = unfolded.split(/BEGIN:VEVENT/i).slice(1);
  const rawEvents = [];

  for (const chunk of eventChunks) {
    const body = chunk.split(/END:VEVENT/i)[0] || '';
    const lines = body.split(/\r?\n/);
    let dtStartRaw = '';
    let dtEndRaw = '';
    let summary = '';
    let uid = '';

    for (const line of lines) {
      if (/^DTSTART(?:;[^:]*)?:/i.test(line)) {
        dtStartRaw = line.replace(/^DTSTART(?:;[^:]*)?:/i, '').trim();
      } else if (/^DTEND(?:;[^:]*)?:/i.test(line)) {
        dtEndRaw = line.replace(/^DTEND(?:;[^:]*)?:/i, '').trim();
      } else if (/^SUMMARY(?:;[^:]*)?:/i.test(line)) {
        summary = line.replace(/^SUMMARY(?:;[^:]*)?:/i, '').trim();
      } else if (/^UID(?:;[^:]*)?:/i.test(line)) {
        uid = line.replace(/^UID(?:;[^:]*)?:/i, '').trim();
      }
    }

    const parsedSummary = parseSummaryClient(summary, defaultHub);
    if (!parsedSummary) continue;

    const startDate = parseIcalDateString(dtStartRaw);
    const endDate = parseIcalDateString(dtEndRaw);
    if (!startDate || isNaN(startDate.getTime())) continue;

    const shiftDate = formatNlDate(startDate);
    if (!shiftDate) continue;

    rawEvents.push({
      uid,
      summary,
      parsedSummary,
      startDate,
      endDate,
      shiftDate
    });
  }

  rawEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const grouped = new Map();
  for (const item of rawEvents) {
    const gKey = `${item.shiftDate}::${item.parsedSummary.rawBlockStr}`;
    if (!grouped.has(gKey)) grouped.set(gKey, []);
    grouped.get(gKey).push(item);
  }

  const nextShifts = {};

  // First preserve any active vrijcheck requests from existingShifts
  for (const [dateKey, dayObj] of Object.entries(existingShifts || {})) {
    if (!dayObj || typeof dayObj !== 'object') continue;
    for (const bId of ALL_BLOCK_IDS) {
      const b = dayObj[bId];
      if (b && (b.vrijcheckActive || b.vrijcheckStatus || b.reactionStatus)) {
        if (!nextShifts[dateKey]) nextShifts[dateKey] = {};
        nextShifts[dateKey][bId] = { ...b };
      }
    }
  }

  let totalParsedBlocks = 0;

  for (const [, groupItems] of grouped.entries()) {
    const { blocks, hub } = groupItems[0].parsedSummary;

    if (groupItems.length === blocks.length && blocks.length > 1) {
      groupItems.forEach((item, idx) => {
        const blockId = blocks[idx];
        const blockDef = getBlockInfo(blockId);
        const defParts = blockDef?.defaultTime?.split(' - ') || ['14:00', '16:45'];
        const startTime = formatNlTime(item.startDate) || defParts[0];
        const endTime = formatNlTime(item.endDate) || defParts[1];
        const prev = existingShifts?.[item.shiftDate]?.[blockId] || {};

        if (!nextShifts[item.shiftDate]) nextShifts[item.shiftDate] = {};
        nextShifts[item.shiftDate][blockId] = {
          ...prev,
          block: blockId,
          startTime,
          endTime,
          locationHub: hub,
          isScheduled: true,
          scheduled: true,
          vrijcheckActive: Boolean(prev.vrijcheckActive),
          vrijcheckStatus: prev.vrijcheckStatus || (prev.vrijcheckActive ? 'STANDBY' : null)
        };
        totalParsedBlocks++;
      });
    } else {
      for (const item of groupItems) {
        const totalDurationMs =
          item.endDate && !isNaN(item.endDate.getTime()) && item.endDate > item.startDate
            ? item.endDate.getTime() - item.startDate.getTime()
            : 0;

        blocks.forEach((blockId, idx) => {
          const blockDef = getBlockInfo(blockId);
          const defParts = blockDef?.defaultTime?.split(' - ') || ['14:00', '16:45'];
          let startTime = defParts[0];
          let endTime = defParts[1];

          if (totalDurationMs > 0) {
            if (blocks.length === 1) {
              startTime = formatNlTime(item.startDate) || startTime;
              endTime = formatNlTime(item.endDate) || endTime;
            } else {
              const sliceMs = totalDurationMs / blocks.length;
              const subStart = new Date(item.startDate.getTime() + sliceMs * idx);
              const subEnd = new Date(item.startDate.getTime() + sliceMs * (idx + 1));
              startTime = formatNlTime(subStart) || startTime;
              endTime = formatNlTime(subEnd) || endTime;
            }
          }

          const prev = existingShifts?.[item.shiftDate]?.[blockId] || {};
          if (!nextShifts[item.shiftDate]) nextShifts[item.shiftDate] = {};
          nextShifts[item.shiftDate][blockId] = {
            ...prev,
            block: blockId,
            startTime,
            endTime,
            locationHub: hub,
            isScheduled: true,
            scheduled: true,
            vrijcheckActive: Boolean(prev.vrijcheckActive),
            vrijcheckStatus: prev.vrijcheckStatus || (prev.vrijcheckActive ? 'STANDBY' : null)
          };
          totalParsedBlocks++;
        });
      }
    }
  }

  return {
    shifts: nextShifts,
    syncedCount: totalParsedBlocks
  };
}
