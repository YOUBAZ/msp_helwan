import { sql } from 'drizzle-orm';
import type { Tx } from '../db/reorder';
import type { Database } from '../db/database';
import { eventCovers, mediaBlobs } from '../db/schema';

/** Postgres advisory-lock key serialising uploads that count against the budget. */
export const UPLOAD_LOCK = 726356;

/** Bytes used by everything counted in the media budget (photos + event covers). */
export async function usedMediaBytes(db: Database | Tx): Promise<number> {
  const [a] = await db
    .select({ n: sql<string | number | null>`sum(${mediaBlobs.bytes})` })
    .from(mediaBlobs);
  const [b] = await db
    .select({ n: sql<string | number | null>`sum(${eventCovers.bytes})` })
    .from(eventCovers);
  return Number(a.n ?? 0) + Number(b.n ?? 0);
}
