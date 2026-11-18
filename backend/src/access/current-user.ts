import type { Request } from 'express';
import type { Permission } from './permissions';
import type { Profile } from './profile';

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  isPresident: boolean;
  roles: { id: string; name: string }[];
  permissions: Set<Permission>;
  profile: Profile;
};

export type AuthedRequest = Request & { user: CurrentUser };

/** True if `user` holds every permission in `required`. */
export function hasAll(user: CurrentUser, required: Iterable<string>) {
  if (user.isPresident) return true;
  for (const p of required)
    if (!user.permissions.has(p as Permission)) return false;
  return true;
}
