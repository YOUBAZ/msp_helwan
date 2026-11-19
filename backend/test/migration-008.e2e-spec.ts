import { PGlite } from '@electric-sql/pglite';
import { migrations } from '../src/db/migrations';

const run = async (db: PGlite, text: string) => {
  for (const stmt of text.split(/;\s*(?:\n|$)/)) {
    if (stmt.trim()) await db.query(stmt);
  }
};

describe('migration 008', () => {
  it('migration 008 moves phone/faculty/year into answers', async () => {
    const db = new PGlite();
    const at = migrations.findIndex((m) => m.id === '008_event_forms');
    expect(at).toBeGreaterThan(0);
    for (const m of migrations.slice(0, at)) await run(db, m.sql);

    const ev = await db.query<{ id: string }>(
      `INSERT INTO events (title, category, venue, starts_at) VALUES ('Old', 'Talk', 'Hall', now()) RETURNING id`,
    );
    await db.query(
      `INSERT INTO event_registrations (event_id, name, email, phone, faculty, year, status, ticket_code)
       VALUES ($1, 'Old Student', 'old@test.dev', '+20 1', 'CS', '3', 'confirmed', 'code-1')`,
      [ev.rows[0].id],
    );

    await run(db, migrations[at].sql);

    const reg = await db.query<{ answers: unknown }>(
      `SELECT answers FROM event_registrations`,
    );
    expect(reg.rows[0].answers).toEqual({
      phone: '+20 1',
      faculty: 'CS',
      year: '3',
    });
    const e = await db.query<{
      form: { id: string }[];
      removed_questions: unknown;
    }>(`SELECT form, removed_questions FROM events WHERE id = $1`, [
      ev.rows[0].id,
    ]);
    expect(e.rows[0].form.map((q) => q.id)).toEqual([
      'phone',
      'faculty',
      'year',
    ]);
    expect(e.rows[0].removed_questions).toEqual({});
    const cols = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'event_registrations'`,
    );
    expect(cols.rows.map((c) => c.column_name)).not.toContain('phone');
    await db.close();
  });
});
