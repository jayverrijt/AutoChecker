export const APP_VERSION = '2.0.0';

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
    id: 'M3',
    label: 'M3',
    period: 'OCHTEND',
    defaultTime: '10:00 - 12:45',
    emoji: '3-red',
    color: 'blue',
    description: 'Ochtend Shift 3 (10:00 - 12:45)',
    postTime: '17:10',
    timingLabel: '17:10 (dag van tevoren)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 17:10 (de dag van tevoren).'
  },
  {
    id: 'M4',
    label: 'M4',
    period: 'OCHTEND',
    defaultTime: '11:00 - 13:45',
    emoji: '4-red',
    color: 'blue',
    description: 'Ochtend Shift 4 (11:00 - 13:45)',
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
    description: 'Avond Shift 3 (19:30 - 22:15)',
    postTime: '10:10',
    timingLabel: '10:10 (dezelfde dag)',
    timingNote: 'Day-Planning-Sender stuurt het bericht om 10:10 (dezelfde dag).'
  },
  {
    id: 'S4',
    label: 'S4',
    period: 'MIDDAG',
    defaultTime: '20:00 - 22:30',
    emoji: '4-red',
    color: 'blue',
    description: 'Avond Shift 4 (20:00 - 22:30)',
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
 * Bugfix #2: Extract first name from Slack profile.display_name (or profile.real_name),
 * fallback is ALWAYS "Runner" (never hardcoded).
 */
export function extractFirstName(displayName, realName, fallback = 'Runner') {
  const candidates = [displayName, realName];
  for (const raw of candidates) {
    if (raw && typeof raw === 'string' && raw.trim().length > 0) {
      const cleaned = raw.trim().replace(/^[0-9_\-\s]+/, '');
      const firstWord = cleaned.split(/\s+/)[0];
      if (firstWord && firstWord.length > 0) {
        return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      }
    }
  }
  return fallback;
}

/**
 * Compares two semantic version strings (e.g. '1.0.6' vs '2.0.0').
 * Returns true if currentVersion is strictly older than requiredVersion.
 */
export function isVersionOutdated(currentVersion, requiredVersion) {
  if (!currentVersion || !requiredVersion) return false;
  const cleanCur = String(currentVersion).replace(/^v/i, '').trim().split('.').map((n) => parseInt(n, 10) || 0);
  const cleanReq = String(requiredVersion).replace(/^v/i, '').trim().split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(cleanCur.length, cleanReq.length);
  for (let i = 0; i < len; i++) {
    const c = cleanCur[i] || 0;
    const r = cleanReq[i] || 0;
    if (c < r) return true;
    if (c > r) return false;
  }
  return false;
}

export function isCriticalListeningWindow(now = new Date()) {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  if (hours === 17 && (minutes === 10 || minutes === 11 || (minutes === 9 && seconds >= 40))) {
    return {
      active: true,
      period: 'OCHTEND',
      target: '17:10',
      description: 'Luister-venster 17:10 actief voor ochtendshifts (M1..M4)'
    };
  }

  if (hours === 10 && (minutes === 10 || minutes === 11 || (minutes === 9 && seconds >= 40))) {
    return {
      active: true,
      period: 'MIDDAG',
      target: '10:10',
      description: 'Luister-venster 10:10 actief voor middag/avondshifts (S1..S4)'
    };
  }

  return { active: false };
}
