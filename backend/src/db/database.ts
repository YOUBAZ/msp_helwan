import { PGlite } from '@electric-sql/pglite';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { mkdir } from 'node:fs/promises';
import { Pool } from 'pg';
import { migrations } from './migrations';
import * as schema from './schema';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export const DB = Symbol('DB');

type Handle = { db: Database; close: () => Promise<void> };

/**
 * DATABASE_URL set   -> real PostgreSQL (e.g. a free Neon database).
 * DATABASE_URL unset -> PGlite, an embedded Postgres saved in DATA_DIR
 *                       (use DATA_DIR=memory:// for a throwaway database).
 */
export async function openDatabase(opts: {
  url?: string;
  dataDir?: string;
}): Promise<Handle> {
  const log = new Logger('Database');
  if (opts.url) {
    const pool = new Pool({ connectionString: opts.url, max: 5 });
    const db = drizzlePg(pool, { schema }) as unknown as Database;
    log.log('Using PostgreSQL (DATABASE_URL)');
    await migrate(db, true);
    return { db, close: () => pool.end() };
  }

  const dir = opts.dataDir ?? 'data/pglite';
  if (!dir.startsWith('memory://')) {
    await mkdir(dir, { recursive: true });
  }
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  log.log(`Using embedded PGlite (${dir})`);
  await migrate(db, false);
  return { db, close: () => client.close() };
}

async function migrate(db: Database, useLock: boolean) {
  const log = new Logger('Migrations');
  await db.transaction(async (tx) => {
    // Several serverless instances may start at once: serialize migrations.
    if (useLock) await tx.execute(sql`SELECT pg_advisory_xact_lock(726354)`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const done = await tx.execute<{ id: string }>(
      sql`SELECT id FROM schema_migrations`,
    );
    const applied = new Set(rows<{ id: string }>(done).map((r) => r.id));
    for (const m of migrations) {
      if (applied.has(m.id)) continue;
      // One statement at a time (PGlite rejects multi-statement queries).
      // Migrations must not contain ';' inside strings.
      for (const stmt of m.sql.split(/;\s*(?:\n|$)/)) {
        if (stmt.trim()) await tx.execute(sql.raw(stmt));
      }
      await tx.execute(
        sql`INSERT INTO schema_migrations (id) VALUES (${m.id})`,
      );
      log.log(`Applied ${m.id}`);
    }
  });
}

/** node-postgres and PGlite both return `{ rows }` from execute(). */
export function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}
