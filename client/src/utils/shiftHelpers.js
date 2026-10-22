import { SHIFT_BLOCKS, getBlockInfo } from './constants';

export const ALL_BLOCK_IDS = ['M1', 'M2', 'S1', 'S2', 'S3'];
export const DAY_NAMES_2 = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];

export function formatDay2Letters(date) {
  if (!date) return 'MA';
  return DAY_NAMES_2[date.getDay()];
}

/**
 * Returns the shift configuration for a specific block on a date.
 * Default: vrijcheckActive is FALSE (the user must explicitly opt in).
 */
export function getShiftForBlock(shiftsData, dateKey, blockId) {
  const dayData = shiftsData?.[dateKey];
  const blockDef = getBlockInfo(blockId);
  const defaultTimes = blockDef?.defaultTime?.split(' - ') || ['14:00', '16:45'];

  const base = {
    block: blockId,
    startTime: defaultTimes[0],
    endTime: defaultTimes[1],
    vrijcheckActive: false,
    reactionStatus: null
  };

  if (!dayData) return base;

  // Stored as dictionary by block ID: dayData[blockId]
  if (dayData[blockId]) {
    return {
      ...base,
      ...dayData[blockId],
      block: blockId,
      vrijcheckActive: Boolean(dayData[blockId].vrijcheckActive)
    };
  }

  // Stored as array
  if (Array.isArray(dayData)) {
    const found = dayData.find(s => s && s.block === blockId);
    if (found) {
      return {
        ...base,
        ...found,
        block: blockId,
        vrijcheckActive: Boolean(found.vrijcheckActive)
      };
    }
  }

  // Stored as single object with block === blockId
  if (dayData.block === blockId) {
    return {
      ...base,
      ...dayData,
      block: blockId,
      vrijcheckActive: Boolean(dayData.vrijcheckActive)
    };
  }

  return base;
}

/**
 * Returns all 5 shift blocks for a specific day: M1, M2, S1, S2, S3
 */
export function getDayBlocks(shiftsData, dateKey) {
  return ALL_BLOCK_IDS.map(blockId => getShiftForBlock(shiftsData, dateKey, blockId));
}

/**
 * Saves or updates a shift block for a given date
 */
export function saveShiftBlock(shiftsData, dateKey, blockId, updatedFields) {
  const currentDay = shiftsData?.[dateKey];
  let newDayDict = {};

  if (currentDay && typeof currentDay === 'object' && !Array.isArray(currentDay) && !currentDay.block) {
    newDayDict = { ...currentDay };
  } else {
    ALL_BLOCK_IDS.forEach(bId => {
      newDayDict[bId] = getShiftForBlock(shiftsData, dateKey, bId);
    });
  }

  newDayDict[blockId] = {
    ...getShiftForBlock(shiftsData, dateKey, blockId),
    ...updatedFields,
    block: blockId
  };

  return {
    ...shiftsData,
    [dateKey]: newDayDict
  };
}

/**
 * Quick toggle for a shift block's Vrijcheck status
 */
export function toggleVrijcheckForBlock(shiftsData, dateKey, blockId) {
  const current = getShiftForBlock(shiftsData, dateKey, blockId);
  const nextActive = !current.vrijcheckActive;
  return saveShiftBlock(shiftsData, dateKey, blockId, { vrijcheckActive: nextActive });
}
