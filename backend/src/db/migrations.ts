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
];
