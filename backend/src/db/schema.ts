import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(), // always lower-case
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  status: text('status')
    .$type<'active' | 'disabled'>()
    .notNull()
    .default('active'),
  /** Bumped on password change / disable to invalidate existing logins. */
  tokenVersion: integer('token_version').notNull().default(0),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const roles = pgTable('roles', {
  id: id(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  /** System roles (President) can't be renamed, edited or deleted. */
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: createdAt(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

/** One-time links: invitations and password resets. Only a hash is stored. */
export const accountTokens = pgTable('account_tokens', {
  id: id(),
  type: text('type').$type<'invite' | 'reset'>().notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  roleIds: jsonb('role_ids').$type<string[]>().notNull().default([]),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const contactMessages = pgTable('contact_messages', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  createdAt: createdAt(),
});

export const subscribers = pgTable('subscribers', {
  id: id(),
  email: text('email').notNull().unique(),
  createdAt: createdAt(),
});
