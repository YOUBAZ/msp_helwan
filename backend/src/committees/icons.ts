/** Icon keys a committee can use (the website maps each to a lucide icon). */
export const COMMITTEE_ICONS = [
  'brain',
  'layout',
  'database',
  'shield',
  'smartphone',
  'cloud',
  'lock',
  'zap',
  'users',
  'megaphone',
  'trending',
  'video',
  'calendar',
  'briefcase',
  'code',
  'palette',
  'pen',
  'camera',
  'gamepad',
  'cpu',
  'globe',
  'heart',
  'book',
  'star',
] as const;
export type CommitteeIcon = (typeof COMMITTEE_ICONS)[number];

export const TRACKS = ['technical', 'non_technical'] as const;
export type Track = (typeof TRACKS)[number];
