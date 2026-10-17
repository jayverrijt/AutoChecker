export const SHIFT_BLOCKS = [
  {
    id: 'M1',
    label: 'M1',
    period: 'OCHTEND',
    defaultTime: '06:30 - 15:00',
    emoji: '1-red',
    color: 'blue',
    description: 'Ochtend Shift 1 (06:30 - 15:00)',
    postTime: '17:10',
    timingLabel: '17:10 (dag van tevoren)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 17:10 (de dag van tevoren).'
  },
  {
    id: 'M2',
    label: 'M2',
    period: 'OCHTEND',
    defaultTime: '07:00 - 15:30',
    emoji: '2-red',
    color: 'blue',
    description: 'Ochtend Shift 2 (07:00 - 15:30)',
    postTime: '17:10',
    timingLabel: '17:10 (dag van tevoren)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 17:10 (de dag van tevoren).'
  },
  {
    id: 'S1',
    label: 'S1',
    period: 'MIDDAG',
    defaultTime: '13:00 - 21:30',
    emoji: '1-red',
    color: 'blue',
    description: 'Middag Shift 1 (13:00 - 21:30)',
    postTime: '10:10',
    timingLabel: '10:10 (dezelfde dag)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
  },
  {
    id: 'S2',
    label: 'S2',
    period: 'MIDDAG',
    defaultTime: '14:00 - 22:30',
    emoji: '2-red',
    color: 'blue',
    description: 'Middag Shift 2 (14:00 - 22:30)',
    postTime: '10:10',
    timingLabel: '10:10 (dezelfde dag)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
  },
  {
    id: 'S3',
    label: 'S3',
    period: 'MIDDAG',
    defaultTime: '16:30 - 23:00',
    emoji: '3-red',
    color: 'blue',
    description: 'Middag Shift 3 (16:30 - 23:00)',
    postTime: '10:10',
    timingLabel: '10:10 (dezelfde dag)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
  }
];

export const SHIFT_BLOCK_MAP = SHIFT_BLOCKS.reduce((acc, curr) => {
  acc[curr.id] = curr;
  return acc;
}, {});

/**
 * Checks if current time is within the critical listening window:
 * Morning shifts: 17:09:45 to 17:11:15
 * Afternoon shifts: 10:09:45 to 10:11:15
 */
export function isCriticalListeningWindow(now = new Date()) {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Window 1: Morning shifts release (17:10)
  // Check from 17:09 (seconds >= 45) through 17:10 and 17:11 (seconds <= 15)
  if (hours === 17 && (minutes === 10 || (minutes === 9 && seconds >= 45) || (minutes === 11 && seconds <= 15))) {
    return {
      active: true,
      period: 'OCHTEND',
      target: '17:10',
      description: 'Luister-venster 17:10 actief voor ochtendshifts (M1, M2)'
    };
  }

  // Window 2: Afternoon shifts release (10:10)
  // Check from 10:09 (seconds >= 45) through 10:10 and 10:11 (seconds <= 15)
  if (hours === 10 && (minutes === 10 || (minutes === 9 && seconds >= 45) || (minutes === 11 && seconds <= 15))) {
    return {
      active: true,
      period: 'MIDDAG',
      target: '10:10',
      description: 'Luister-venster 10:10 actief voor middagshifts (S1, S2, S3)'
    };
  }

  return { active: false };
}
