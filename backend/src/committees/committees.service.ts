import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, ne } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { committees, seasons } from '../db/schema';
import type { Track } from './icons';
import { pickSeasons } from './pick-seasons';

export type CommitteeRow = typeof committees.$inferSelect;
export type Committee = {
  id: string;
  name: string;
  track: Track;
  icon: string;
  description: string;
  tasks: string[];
  sortOrder: number;
};

export const toCommittee = (c: CommitteeRow): Committee => ({
  id: c.id,
  name: c.name,
  track: c.track,
  icon: c.icon,
  description: c.description,
  tasks: c.tasks,
  sortOrder: c.sortOrder,
});

/** Technical first, then by the board's order. */
const TRACK_ORDER: Record<Track, number> = { technical: 0, non_technical: 1 };
export const byTrackThenOrder = (a: CommitteeRow, b: CommitteeRow) =>
  TRACK_ORDER[a.track] - TRACK_ORDER[b.track] || a.sortOrder - b.sortOrder;

@Injectable()
export class CommitteesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async ofSeason(seasonId: string): Promise<Committee[]> {
    const rows = await this.db
      .select()
      .from(committees)
      .where(eq(committees.seasonId, seasonId))
      .orderBy(asc(committees.sortOrder));
    return rows.sort(byTrackThenOrder).map(toCommittee);
  }

  /**
   * The public Committees page: the current season (or the season asked for),
   * with a switch to the previous one. While the current season has no
   * committees yet, it shows the previous season's instead.
   */
  async publicView(number?: number) {
    const rows = await this.db
      .select()
      .from(seasons)
      .where(ne(seasons.status, 'draft'));
    const { current, previous } = pickSeasons(rows);
    const listed = [current, previous]
      .filter((n): n is number => n !== null)
      .map((n) => rows.find((r) => r.number === n)!)
      .map((s) => ({ number: s.number, name: s.name }));

    const show = async (n: number) => {
      const s = rows.find((r) => r.number === n);
      if (!s) throw new NotFoundException('Season not found.');
      return {
        season: { number: s.number, name: s.name },
        list: await this.ofSeason(s.id),
      };
    };

    if (number !== undefined) {
      const { season, list } = await show(number);
      return { seasons: listed, season, committees: list, fallback: false };
    }
    if (current === null) {
      return { seasons: listed, season: null, committees: [], fallback: false };
    }
    const now = await show(current);
    if (now.list.length === 0 && previous !== null) {
      const before = await show(previous);
      return {
        seasons: listed,
        season: before.season,
        committees: before.list,
        fallback: true,
      };
    }
    return {
      seasons: listed,
      season: now.season,
      committees: now.list,
      fallback: false,
    };
  }
}
