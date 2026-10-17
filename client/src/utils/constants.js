export const SHIFT_BLOCKS = [
  {
    id: 'M1',
    label: 'M1',
    period: 'OCHTEND',
    defaultTime: '06:30 - 15:00',
    emoji: '1-red',
    color: 'blue',
    description: 'Ochtend Shift 1 (06:30 - 15:00)'
  },
  {
    id: 'M2',
    label: 'M2',
    period: 'OCHTEND',
    defaultTime: '07:00 - 15:30',
    emoji: '2-red',
    color: 'blue',
    description: 'Ochtend Shift 2 (07:00 - 15:30)'
  },
  {
    id: 'S1',
    label: 'S1',
    period: 'MIDDAG',
    defaultTime: '13:00 - 21:30',
    emoji: '1-red',
    color: 'blue',
    description: 'Middag Shift 1 (13:00 - 21:30)'
  },
  {
    id: 'S2',
    label: 'S2',
    period: 'MIDDAG',
    defaultTime: '14:00 - 22:30',
    emoji: '2-red',
    color: 'blue',
    description: 'Middag Shift 2 (14:00 - 22:30)'
  },
  {
    id: 'S3',
    label: 'S3',
    period: 'MIDDAG',
    defaultTime: '16:30 - 23:00',
    emoji: '3-red',
    color: 'blue',
    description: 'Middag Shift 3 (16:30 - 23:00)'
  }
];

export const SHIFT_BLOCK_MAP = SHIFT_BLOCKS.reduce((acc, curr) => {
  acc[curr.id] = curr;
  return acc;
}, {});
