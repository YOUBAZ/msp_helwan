/**
 * Database migrations, applied in order at startup and recorded in
 * `schema_migrations`. Kept as plain SQL in code so they are always bundled
 * with the app (no migration files to ship).
 *
 * Never edit a migration that has been deployed. Add a new one instead.
 */
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: `
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  token_version integer NOT NULL DEFAULT 0,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  PRIMARY KEY (role_id, permission)
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX user_roles_role_idx ON user_roles(role_id);

CREATE TABLE account_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  role_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
`,
  },
  {
    id: '002_profiles',
    sql: `
ALTER TABLE users ADD COLUMN phone text;
ALTER TABLE users ADD COLUMN birthday date;
ALTER TABLE users ADD COLUMN gender text;
ALTER TABLE users ADD COLUMN linkedin_url text;
ALTER TABLE users ADD COLUMN facebook_url text;
ALTER TABLE users ADD COLUMN portfolio_url text;
ALTER TABLE users ADD COLUMN avatar_version integer NOT NULL DEFAULT 0;

CREATE TABLE user_avatars (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime text NOT NULL,
  data bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`,
  },
  {
    id: '003_seasons',
    sql: `
CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX seasons_one_current ON seasons ((status)) WHERE status = 'current';

CREATE TABLE hierarchy_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES hierarchy_positions(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hierarchy_positions_season_idx ON hierarchy_positions(season_id);

CREATE TABLE hierarchy_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES hierarchy_positions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  legacy_name text,
  legacy_image text,
  legacy_linkedin text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR legacy_name IS NOT NULL)
);
CREATE INDEX hierarchy_members_position_idx ON hierarchy_members(position_id);
CREATE UNIQUE INDEX hierarchy_members_unique_user ON hierarchy_members(position_id, user_id);

INSERT INTO seasons (id, number, name, status, published_at) VALUES
  ('00000000-0000-4000-8000-000000000026', 26, 'Season 26', 'archived', now());

INSERT INTO hierarchy_positions (id, season_id, parent_id, title, sort_order) VALUES
  ('00000000-0000-4000-8026-000000000001', '00000000-0000-4000-8000-000000000026', NULL, 'President', 0),
  ('00000000-0000-4000-8026-000000000002', '00000000-0000-4000-8000-000000000026', '00000000-0000-4000-8026-000000000001', 'General Vice President', 0),
  ('00000000-0000-4000-8026-000000000003', '00000000-0000-4000-8000-000000000026', '00000000-0000-4000-8026-000000000002', 'Vice President Technical', 0),
  ('00000000-0000-4000-8026-000000000004', '00000000-0000-4000-8000-000000000026', '00000000-0000-4000-8026-000000000002', 'Vice President Non-Technical', 1),
  ('00000000-0000-4000-8026-000000000005', '00000000-0000-4000-8000-000000000026', '00000000-0000-4000-8026-000000000003', 'Technical Director', 0),
  ('00000000-0000-4000-8026-000000000006', '00000000-0000-4000-8000-000000000026', '00000000-0000-4000-8026-000000000004', 'Non-Technical Director', 0);

INSERT INTO hierarchy_members (position_id, legacy_name, legacy_image, legacy_linkedin, sort_order) VALUES
  ('00000000-0000-4000-8026-000000000001', 'Youssif Saad', '/images/team/youssef.jpeg', 'https://www.linkedin.com/in/youssifsaad', 0),
  ('00000000-0000-4000-8026-000000000002', 'Ahmed Essam', '/images/team/ahmed.jpeg', NULL, 0),
  ('00000000-0000-4000-8026-000000000002', 'Seif Eldeen', '/images/team/seif.jpeg', 'https://www.linkedin.com/in/seifeldeen-magdy-858b0627b', 1),
  ('00000000-0000-4000-8026-000000000003', 'Zeyad Hossam', '/images/team/zeyad.jpeg', 'https://www.linkedin.com/in/zeyad-hossameldin', 0),
  ('00000000-0000-4000-8026-000000000004', 'Amall Khaled', '/images/team/amall.jpeg', 'https://www.linkedin.com/in/amall-khaled-86a945239', 0),
  ('00000000-0000-4000-8026-000000000005', 'Abdelrahman Nader', '/images/team/nader.jpeg', 'https://www.linkedin.com/in/abdulrahman-nader', 0),
  ('00000000-0000-4000-8026-000000000005', 'Malak Hany', '/images/team/malk.jpeg', 'https://www.linkedin.com/in/mallakhanyy', 1),
  ('00000000-0000-4000-8026-000000000006', 'Rawan Aziz', '/images/team/rawan.jpeg', 'https://www.linkedin.com/in/rawan-aziz-6ba807329', 0),
  ('00000000-0000-4000-8026-000000000006', 'Haneen Borhan', '/images/team/hanen.jpeg', 'https://www.linkedin.com/in/haneen-borhan-736a22363', 1);
`,
  },
  {
    id: '004_media',
    sql: `
CREATE TABLE media_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  event_date date,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES media_albums(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  legacy_path text,
  video_provider text,
  embed_url text,
  thumbnail_url text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind IN ('photo', 'video'))
);
CREATE INDEX media_items_album_idx ON media_items(album_id);

CREATE TABLE media_blobs (
  item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  variant text NOT NULL,
  mime text NOT NULL,
  data bytea NOT NULL,
  bytes integer NOT NULL,
  PRIMARY KEY (item_id, variant),
  CHECK (variant IN ('full', 'small'))
);

INSERT INTO media_albums (id, title, category, published, sort_order) VALUES
  ('00000000-0000-4000-8a00-000000000000', 'Orientation Day 2025', 'Event', true, 0),
  ('00000000-0000-4000-8a00-000000000001', 'AI Catalyst 2025', 'Workshop', true, 1),
  ('00000000-0000-4000-8a00-000000000002', 'Problem Solving Competition 2025', 'Contest', true, 2),
  ('00000000-0000-4000-8a00-000000000003', 'Best Heads & Members 2025', 'Awards', true, 3);

INSERT INTO media_items (album_id, kind, sort_order, legacy_path) VALUES
  ('00000000-0000-4000-8a00-000000000000', 'photo', 0, '/images/events/orientation/1.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 1, '/images/events/orientation/2.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 2, '/images/events/orientation/3.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 3, '/images/events/orientation/4.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 4, '/images/events/orientation/5.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 5, '/images/events/orientation/6.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 6, '/images/events/orientation/7.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 7, '/images/events/orientation/8.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 8, '/images/events/orientation/9.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 9, '/images/events/orientation/10.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 10, '/images/events/orientation/11.jpg'),
  ('00000000-0000-4000-8a00-000000000000', 'photo', 11, '/images/events/orientation/12.jpg'),
  ('00000000-0000-4000-8a00-000000000001', 'photo', 0, '/images/events/ai/1.jpg'),
  ('00000000-0000-4000-8a00-000000000001', 'photo', 1, '/images/events/ai/2.jpg'),
  ('00000000-0000-4000-8a00-000000000001', 'photo', 2, '/images/events/ai/3.jpg'),
  ('00000000-0000-4000-8a00-000000000001', 'photo', 3, '/images/events/ai/4.jpg'),
  ('00000000-0000-4000-8a00-000000000001', 'photo', 4, '/images/events/ai/5.jpg'),
  ('00000000-0000-4000-8a00-000000000001', 'photo', 5, '/images/events/ai/6.jpg'),
  ('00000000-0000-4000-8a00-000000000001', 'photo', 6, '/images/events/ai/7.jpg'),
  ('00000000-0000-4000-8a00-000000000001', 'photo', 7, '/images/events/ai/8.jpg'),
  ('00000000-0000-4000-8a00-000000000002', 'photo', 0, '/images/events/problem/1.jpg'),
  ('00000000-0000-4000-8a00-000000000002', 'photo', 1, '/images/events/problem/2.jpg'),
  ('00000000-0000-4000-8a00-000000000002', 'photo', 2, '/images/events/problem/3.jpg'),
  ('00000000-0000-4000-8a00-000000000002', 'photo', 3, '/images/events/problem/4.jpg'),
  ('00000000-0000-4000-8a00-000000000002', 'photo', 4, '/images/events/problem/5.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 0, '/images/events/best/1.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 1, '/images/events/best/2.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 2, '/images/events/best/3.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 3, '/images/events/best/4.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 4, '/images/events/best/5.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 5, '/images/events/best/6.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 6, '/images/events/best/7.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 7, '/images/events/best/8.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 8, '/images/events/best/9.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 9, '/images/events/best/10.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 10, '/images/events/best/11.jpg'),
  ('00000000-0000-4000-8a00-000000000003', 'photo', 11, '/images/events/best/12.jpg');
`,
  },
  {
    id: '005_media_legacy_cleanup',
    sql: `
DELETE FROM media_items WHERE legacy_path IS NOT NULL;
`,
  },
  {
    id: '006_events',
    sql: `
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  venue text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  capacity integer,
  registration_open boolean NOT NULL DEFAULT true,
  registration_deadline timestamptz,
  published boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  media_album_id uuid REFERENCES media_albums(id) ON DELETE SET NULL,
  highlight text,
  partners jsonb NOT NULL DEFAULT '[]'::jsonb,
  manual_attendance integer,
  cover_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_starts_at_idx ON events(starts_at);

CREATE TABLE event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  faculty text NOT NULL,
  year text NOT NULL,
  status text NOT NULL,
  ticket_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  reminder_sent_at timestamptz,
  CHECK (status IN ('confirmed', 'waitlisted', 'cancelled'))
);
CREATE INDEX event_registrations_event_idx ON event_registrations(event_id);
CREATE UNIQUE INDEX event_registrations_one_active ON event_registrations(event_id, email) WHERE status <> 'cancelled';

CREATE TABLE event_covers (
  event_id uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  mime text NOT NULL,
  data bytea NOT NULL,
  bytes integer NOT NULL
);

INSERT INTO events (title, category, description, venue, starts_at, registration_open, published, highlight, partners, manual_attendance) VALUES
  ('Orientation Day 2025', 'Event', 'Welcoming the previous generation and introducing the Microsoft Student Partners community.', 'Capital University', '2025-06-23T10:00:00+03:00', false, true, 'Community Growth', '[]'::jsonb, NULL),
  ('Battery Tech with Schneider Electric 2025', 'Workshop', 'Exploring sustainable energy solutions and modern battery technologies with industry experts.', 'Capital University', '2025-07-17T10:00:00+03:00', false, true, 'Industry Certification', '["Schneider Electric"]'::jsonb, NULL),
  ('AI Catalyst with Dotpy 2025', 'Workshop', 'A high-impact event focused on accelerating AI adoption and hands-on machine learning innovation.', 'Capital University', '2025-08-22T10:00:00+03:00', false, true, '200+ Attendees', '["Dotpy"]'::jsonb, 200),
  ('Season Orientation 2026', 'Orientation', 'The official launch of our new season. Discover our tracks, meet the new board, and start your technical journey.', 'Main Hall, Capital University', '2026-03-01T10:00:00+02:00', false, true, NULL, '[]'::jsonb, NULL);
`,
  },
];
