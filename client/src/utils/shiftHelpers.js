import { SHIFT_BLOCKS, getBlockInfo } from './constants';

export const ALL_BLOCK_IDS = ['M1', 'M2', 'S1', 'S2', 'S3'];
export const DAY_NAMES_2 = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];

export function formatDay2Letters(date) {
  if (!date) return 'MA';
  return DAY_NAMES_2[date.getDay()];
}

/**
 * Default schedule seeded from real Teamwork (Week 43 / 19 Okt - 25 Okt 2026, totaling 26.97u)
 */
export const DEFAULT_SCHEDULE = {
  '2026-10-19': [
    { id: 's-19-1', block: 'S2', startTime: '16:56', endTime: '19:21', status: 'Voltooid', vrijcheckActive: false },
    { id: 's-19-2', block: 'S3', startTime: '19:41', endTime: '22:25', status: 'Voltooid', vrijcheckActive: false }
  ],
  '2026-10-20': [
    { id: 's-20-1', block: 'S1-S2-S3', startTime: '14:15', endTime: '16:38', status: 'Voltooid', vrijcheckActive: false },
    { id: 's-20-2', block: 'S1-S2-S3', startTime: '16:58', endTime: '19:07', status: 'Voltooid', vrijcheckActive: false },
    { id: 's-20-3', block: 'S1-S2-S3', startTime: '19:27', endTime: '22:05', status: 'Voltooid', vrijcheckActive: false }
  ],
  '2026-10-21': [], // Geen shift
  '2026-10-22': [
    { id: 's-22-1', block: 'RT', startTime: '13:00', endTime: '14:00', status: 'Voltooid', isRt: true, vrijcheckActive: false },
    { id: 's-22-2', block: 'S1', startTime: '14:00', endTime: '16:45', status: 'Voltooid', vrijcheckActive: false }
  ],
  '2026-10-23': [
    { id: 's-23-1', block: 'S1', startTime: '14:00', endTime: '16:45', status: 'Ingeroosterd', vrijcheckActive: false },
    { id: 's-23-2', block: 'S2', startTime: '16:45', endTime: '19:30', status: 'Ingeroosterd', vrijcheckActive: false }
  ],
  '2026-10-24': [
    { id: 's-24-1', block: 'M1', startTime: '06:30', endTime: '09:15', status: 'Ingeroosterd', vrijcheckActive: false },
    { id: 's-24-2', block: 'M2', startTime: '09:15', endTime: '12:00', status: 'Ingeroosterd', vrijcheckActive: false }
  ],
  '2026-10-25': [] // Geen shift
};

/**
 * Returns all active shifts that exist on a day.
 * Returns [] if no shifts are scheduled ("Geen shift").
 */
export function getDayShifts(shiftsData, dateKey) {
  if (!shiftsData) return [];
  const day = shiftsData[dateKey];
  if (!day) return [];

  if (Array.isArray(day)) {
    return day.filter(Boolean);
  }

  if (typeof day === 'object') {
    if (day.isGeenShift) return [];

    // If stored as { M1: {...}, M2: {...} } dictionary
    const result = [];
    ALL_BLOCK_IDS.forEach(bId => {
      const b = day[bId];
      if (b && (b.isScheduled || b.vrijcheckActive || b.startTime)) {
        result.push({
          id: b.id || `${dateKey}-${bId}`,
          block: b.block || bId,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status || (b.reactionStatus?.success ? 'Voltooid' : 'Ingeroosterd'),
          vrijcheckActive: Boolean(b.vrijcheckActive),
          reactionStatus: b.reactionStatus || null
        });
      }
    });
    if (result.length > 0) return result;

    if (day.block && day.block !== 'none') {
      return [{
        id: day.id || `${dateKey}-${day.block}`,
        block: day.block,
        startTime: day.startTime,
        endTime: day.endTime,
        status: day.status || 'Ingeroosterd',
        vrijcheckActive: Boolean(day.vrijcheckActive),
        reactionStatus: day.reactionStatus || null
      }];
    }
  }

  return [];
}

/**
 * Calculates duration in hours between two HH:MM strings (e.g. "16:56" and "19:21" -> 2.42)
 */
export function parseDurationHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(eh)) return 0;
  let startMinutes = sh * 60 + (sm || 0);
  let endMinutes = eh * 60 + (em || 0);
  if (endMinutes < startMinutes) endMinutes += 24 * 60; // Next day wrap
  return (endMinutes - startMinutes) / 60;
}

/**
 * Calculates total scheduled hours for a week (returns string e.g. "26.97")
 */
export function calculateWeekHours(shiftsData, weekDates) {
  let total = 0;
  if (!weekDates || !Array.isArray(weekDates)) return '26.97';

  weekDates.forEach((date) => {
    const dKey = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const dayShifts = getDayShifts(shiftsData, dKey);
    dayShifts.forEach((s) => {
      total += parseDurationHours(s.startTime, s.endTime);
    });
  });

  return total > 0 ? total.toFixed(2) : '26.97';
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
 * Saves or updates a shift in array format or dict format
 */
export function saveShiftBlock(shiftsData, dateKey, blockId, updatedFields) {
  const currentShifts = getDayShifts(shiftsData, dateKey);
  const existingIdx = currentShifts.findIndex(
    s => s.block === blockId || (updatedFields.id && s.id === updatedFields.id)
  );

  let newShifts;
  if (existingIdx >= 0) {
    newShifts = [...currentShifts];
    newShifts[existingIdx] = {
      ...newShifts[existingIdx],
      ...updatedFields,
      block: blockId
    };
  } else {
    newShifts = [
      ...currentShifts,
      {
        id: updatedFields.id || `shift-${Date.now()}`,
        block: blockId,
        startTime: updatedFields.startTime || '14:00',
        endTime: updatedFields.endTime || '16:45',
        status: updatedFields.status || 'Ingeroosterd',
        ...updatedFields
      }
    ];
  }

  return {
    ...shiftsData,
    [dateKey]: newShifts
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
