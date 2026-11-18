import {
  boolean,
  customType,
  date,
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
  // Profile
  phone: text('phone'),
  birthday: date('birthday'), // 'YYYY-MM-DD'
  gender: text('gender').$type<'male' | 'female'>(),
  linkedinUrl: text('linkedin_url'),
  facebookUrl: text('facebook_url'),
  portfolioUrl: text('portfolio_url'),
  /** 0 = no photo. Bumped on every upload so browsers fetch the new image. */
  avatarVersion: integer('avatar_version').notNull().default(0),
});

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

export const userAvatars = pgTable('user_avatars', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  data: bytea('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
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

export const seasons = pgTable('seasons', {
  id: id(),
  number: integer('number').notNull().unique(),
  name: text('name').notNull(),
  /** draft: hidden while being built · current: shown by default · archived: read-only history */
  status: text('status')
    .$type<'draft' | 'current' | 'archived'>()
    .notNull()
    .default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: createdAt(),
});

/** A position in a season's hierarchy (tree via parentId). */
export const hierarchyPositions = pgTable('hierarchy_positions', {
  id: id(),
  seasonId: uuid('season_id')
    .notNull()
    .references(() => seasons.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

/**
 * A person holding a position. New entries must be linked to an account
 * (userId). legacy* fields exist only for seasons from before accounts.
 */
export const hierarchyMembers = pgTable('hierarchy_members', {
  id: id(),
  positionId: uuid('position_id')
    .notNull()
    .references(() => hierarchyPositions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  legacyName: text('legacy_name'),
  legacyImage: text('legacy_image'),
  legacyLinkedin: text('legacy_linkedin'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const mediaAlbums = pgTable('media_albums', {
  id: id(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  eventDate: date('event_date'),
  published: boolean('published').notNull().default(false),
  /** Manual order on the public page: lower first. */
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A photo or video link inside an album, in display order. */
export const mediaItems = pgTable('media_items', {
  id: id(),
  albumId: uuid('album_id')
    .notNull()
    .references(() => mediaAlbums.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'photo' | 'video'>().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Photos still served as website files (before the one-time import). */
  legacyPath: text('legacy_path'),
  videoProvider: text('video_provider').$type<
    'youtube' | 'facebook' | 'drive'
  >(),
  embedUrl: text('embed_url'),
  thumbnailUrl: text('thumbnail_url'),
  sourceUrl: text('source_url'),
  createdAt: createdAt(),
});

/** Stored photo files: a full and a small version per photo item. */
export const mediaBlobs = pgTable(
  'media_blobs',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    variant: text('variant').$type<'full' | 'small'>().notNull(),
    mime: text('mime').notNull(),
    data: bytea('data').notNull(),
    bytes: integer('bytes').notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.variant] })],
);
