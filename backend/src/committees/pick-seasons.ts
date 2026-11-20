/**
 * The seasons the public Committees page shows: the current one (or, if none
 * is current, the newest published one) and the published one before it.
 * Drafts never show.
 */
export function pickSeasons(rows: { number: number; status: string }[]): {
  current: number | null;
  previous: number | null;
} {
  const published = rows
    .filter((r) => r.status !== 'draft')
    .sort((a, b) => b.number - a.number);
  const current =
    published.find((r) => r.status === 'current') ?? published[0] ?? null;
  if (!current) return { current: null, previous: null };
  const previous = published.find((r) => r.number < current.number) ?? null;
  return { current: current.number, previous: previous?.number ?? null };
}
