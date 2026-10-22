export const SHIFT_BLOCKS = [
  {
    id: 'M1',
    label: 'M1',
    period: 'OCHTEND',
    defaultTime: '06:30 - 09:15',
    emoji: '1-red',
    color: 'blue',
    description: 'Ochtend Shift 1 (06:30 - 09:15)',
    postTime: '17:10',
    timingLabel: '17:10 (dag van tevoren)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 17:10 (de dag van tevoren).'
  },
  {
    id: 'M2',
    label: 'M2',
    period: 'OCHTEND',
    defaultTime: '09:15 - 12:00',
    emoji: '2-red',
    color: 'blue',
    description: 'Ochtend Shift 2 (09:15 - 12:00)',
    postTime: '17:10',
    timingLabel: '17:10 (dag van tevoren)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 17:10 (de dag van tevoren).'
  },
  {
    id: 'S1',
    label: 'S1',
    period: 'MIDDAG',
    defaultTime: '14:00 - 16:45',
    emoji: '1-red',
    color: 'blue',
    description: 'Middag Shift 1 (14:00 - 16:45)',
    postTime: '10:10',
    timingLabel: '10:10 (dezelfde dag)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
  },
  {
    id: 'S2',
    label: 'S2',
    period: 'MIDDAG',
    defaultTime: '16:45 - 19:30',
    emoji: '2-red',
    color: 'blue',
    description: 'Middag Shift 2 (16:45 - 19:30)',
    postTime: '10:10',
    timingLabel: '10:10 (dezelfde dag)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
  },
  {
    id: 'S3',
    label: 'S3',
    period: 'MIDDAG',
    defaultTime: '19:30 - 22:15',
    emoji: '3-red',
    color: 'blue',
    description: 'Middag Shift 3 (19:30 - 22:15)',
    postTime: '10:10',
    timingLabel: '10:10 (dezelfde dag)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
  }
];

export const SHIFT_BLOCK_MAP = SHIFT_BLOCKS.reduce((acc, curr) => {
  acc[curr.id] = curr;
  return acc;
}, {});

export function getBlockInfo(blockId) {
  if (!blockId || blockId === 'none') return null;
  if (SHIFT_BLOCK_MAP[blockId]) return SHIFT_BLOCK_MAP[blockId];

  // Compound block e.g. 'S1-S2-S3'
  if (blockId.includes('S')) {
    return {
      id: blockId,
      label: blockId,
      period: 'MIDDAG',
      defaultTime: '14:00 - 22:15',
      emoji: '3-red',
      color: 'blue',
      description: `Middag/Avond Shift (${blockId})`,
      postTime: '10:10',
      timingLabel: '10:10 (dezelfde dag)',
      timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
    };
  }

  if (blockId.includes('M')) {
    return {
      id: blockId,
      label: blockId,
      period: 'OCHTEND',
      defaultTime: '06:30 - 12:00',
      emoji: '1-red',
      color: 'blue',
      description: `Ochtend Shift (${blockId})`,
      postTime: '17:10',
      timingLabel: '17:10 (dag van tevoren)',
      timingNote: 'Day-Planning-Sender stuurt het bericht om 17:10 (de dag van tevoren).'
    };
  }

  return {
    id: blockId,
    label: blockId,
    period: 'MIDDAG',
    defaultTime: '14:00 - 16:45',
    emoji: '1-red',
    color: 'blue',
    postTime: '10:10',
    timingLabel: '10:10 (dezelfde dag)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
  };
}

/**
 * Checks if current time is within the critical listening window:
 * Morning shifts: 17:09:40 to 17:11:59 (Day-Planner-Sender post seconden variëren, bijv. 17:10:19, 17:10:28)
 * Afternoon shifts: 10:09:40 to 10:11:59 (Day-Planner-Sender post seconden variëren, bijv. 10:10:28, 10:11:00)
 */
export function isCriticalListeningWindow(now = new Date()) {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Window 1: Morning shifts release (17:10)
  // Check from 17:09:40 through 17:10:00-59 and 17:11:00-59
  if (hours === 17 && (minutes === 10 || minutes === 11 || (minutes === 9 && seconds >= 40))) {
    return {
      active: true,
      period: 'OCHTEND',
      target: '17:10',
      description: 'Luister-venster 17:10 actief voor ochtendshifts (M1, M2)'
    };
  }

  // Window 2: Afternoon shifts release (10:10)
  // Check from 10:09:40 through 10:10:00-59 and 10:11:00-59
  if (hours === 10 && (minutes === 10 || minutes === 11 || (minutes === 9 && seconds >= 40))) {
    return {
      active: true,
      period: 'MIDDAG',
      target: '10:10',
      description: 'Luister-venster 10:10 actief voor middagshifts (S1, S2, S3)'
    };
  }

  return { active: false };
}
