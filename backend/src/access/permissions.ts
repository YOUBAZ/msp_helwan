/**
 * Every permission in the system. The President ticks these as checkboxes when
 * creating a role. To add a feature: add its permissions here, then protect its
 * routes with @Auth('your.permission').
 */
export const PERMISSIONS = [
  { key: 'members.view', group: 'Members', label: 'View the member list' },
  { key: 'members.invite', group: 'Members', label: 'Invite new members' },
  {
    key: 'members.manage',
    group: 'Members',
    label:
      "Change members' roles, disable accounts, create password-reset links",
  },
  {
    key: 'roles.manage',
    group: 'Roles',
    label: 'Create, edit and delete roles, and assign people to them',
  },
  {
    key: 'seasons.manage',
    group: 'Team hierarchy',
    label: "Build and publish each season's team hierarchy (Our Team page)",
  },
  {
    key: 'committees.manage',
    group: 'Committees',
    label: "Manage each season's committees (Committees page)",
  },
  {
    key: 'events.manage',
    group: 'Events',
    label:
      'Create, edit, publish and cancel events; manage registrations and the waiting list',
  },
  {
    key: 'events.checkin',
    group: 'Events',
    label: 'See registrations and check people in at the door',
  },
  {
    key: 'media.manage',
    group: 'Media',
    label: 'Manage the Media page (albums, photos and videos)',
  },
  { key: 'messages.view', group: 'Inbox', label: 'Read contact-form messages' },
  {
    key: 'messages.delete',
    group: 'Inbox',
    label: 'Delete contact-form messages',
  },
  {
    key: 'subscribers.view',
    group: 'Newsletter',
    label: 'View newsletter subscribers',
  },
  {
    key: 'subscribers.delete',
    group: 'Newsletter',
    label: 'Remove newsletter subscribers',
  },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];
export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map((p) => p.key);

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export const PRESIDENT_ROLE = 'President';

/** Roles created on first start. All except President can be edited later. */
export const DEFAULT_ROLES: {
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: Permission[];
}[] = [
  {
    name: PRESIDENT_ROLE,
    description: 'Full access to everything. Cannot be edited or deleted.',
    isSystem: true,
    permissions: [], // implicit: all permissions
  },
  {
    name: 'High Board',
    description: 'Club leadership: manages members and reads all inquiries.',
    permissions: [
      'members.view',
      'members.invite',
      'members.manage',
      'messages.view',
      'messages.delete',
      'subscribers.view',
      'subscribers.delete',
    ],
  },
  {
    name: 'Board',
    description: 'Heads and vices of committees.',
    permissions: ['members.view', 'messages.view', 'subscribers.view'],
  },
  {
    name: 'Member',
    description: 'Club members. Can sign in and manage their own profile.',
    permissions: [],
  },
];
