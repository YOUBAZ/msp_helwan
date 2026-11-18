import type { CurrentUser } from './current-user';

export type RoleRef = { id: string; name: string };

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
  createdAt: Date;
  lastLoginAt: Date | null;
  roles: RoleRef[];
};

export function serializeMe(u: CurrentUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isPresident: u.isPresident,
    roles: u.roles,
    permissions: [...u.permissions].sort(),
  };
}
