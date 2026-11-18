export type RoleRef = { id: string; name: string };

export type Me = {
  id: string;
  email: string;
  name: string;
  isPresident: boolean;
  roles: RoleRef[];
  permissions: string[];
};

export type Role = {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
};

export type PermissionDef = { key: string; group: string; label: string };

export type Member = {
  id: string;
  email: string;
  name: string;
  status: "active" | "disabled";
  createdAt: string;
  lastLoginAt: string | null;
  roles: RoleRef[];
};

export type Invite = {
  id: string;
  email: string;
  name: string;
  roles: RoleRef[];
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

export type Subscriber = { id: string; email: string; createdAt: string };
