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
