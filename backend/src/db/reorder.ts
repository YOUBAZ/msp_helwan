import { sql } from 'drizzle-orm';
import type { Database } from './database';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Row = { id: string; sortOrder: number };

/** Postgres advisory-lock key: one reorder at a time, so moves never interleave. */
const REORDER_LOCK = 726357;

/**
 * Swap one row with its neighbour in a manually ordered list, atomically.
 * `load` returns the list in display order inside the transaction; `save`
 * writes a new position. Only rows whose position changes are written.
 */
export async function moveInOrder(
  db: Database,
  load: (tx: Tx) => Promise<Row[]>,
  id: string,
  direction: 'up' | 'down',
  save: (tx: Tx, id: string, sortOrder: number) => Promise<unknown>,
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${REORDER_LOCK})`);
    const rows = await load(tx);
    const i = rows.findIndex((r) => r.id === id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [order, row] of rows.entries()) {
      if (row.sortOrder !== order) await save(tx, row.id, order);
    }
  });
}
