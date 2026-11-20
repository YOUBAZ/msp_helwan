import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, lt, ne } from 'drizzle-orm';
import { uniqueViolation } from '../access/roles.service';
import { DB, type Database } from '../db/database';
import type { Tx } from '../db/reorder';
import { committees, seasons } from '../db/schema';
import type { CommitteeDto, UpdateCommitteeDto } from './dto';
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
  TRACK_ORDER[a.track] - TRACK_ORDER[b.track] ||
  a.sortOrder - b.sortOrder ||
  // Ties (shouldn't happen) still give a stable order.
  a.createdAt.getTime() - b.createdAt.getTime() ||
  a.id.localeCompare(b.id);

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

  // ---------- Managing (committees.manage) ----------

  async adminSeasons() {
    const rows = await this.db
      .select()
      .from(seasons)
      .orderBy(desc(seasons.number));
    return rows.map(seasonInfo);
  }

  /** A season's committees plus the season before it, for "copy from". */
  async adminSeason(seasonId: string) {
    const season = await this.season(seasonId);
    const [previous] = await this.db
      .select()
      .from(seasons)
      .where(lt(seasons.number, season.number))
      .orderBy(desc(seasons.number))
      .limit(1);
    return {
      season: seasonInfo(season),
      committees: await this.ofSeason(season.id),
      previous: previous ? seasonInfo(previous) : null,
      previousCommittees: previous ? await this.ofSeason(previous.id) : [],
    };
  }

  async create(seasonId: string, dto: CommitteeDto): Promise<Committee> {
    const season = await this.editableSeason(seasonId);
    return this.insert(season, dto);
  }

  async copy(seasonId: string, committeeId: string, name?: string) {
    const target = await this.editableSeason(seasonId);
    const src = await this.row(committeeId);
    const from = await this.season(src.seasonId);
    if (from.number >= target.number) {
      throw new BadRequestException(
        'You can only copy from an earlier season.',
      );
    }
    return this.insert(target, {
      name: name ?? src.name,
      track: src.track,
      icon: src.icon,
      description: src.description,
      tasks: src.tasks,
    });
  }

  async update(id: string, dto: UpdateCommitteeDto): Promise<Committee> {
    const c = await this.row(id);
    const season = await this.editableSeason(c.seasonId);
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as UpdateCommitteeDto;
    if (Object.keys(changes).length === 0) return toCommittee(c);
    try {
      return await this.db.transaction(async (tx) => {
        let sortOrder: number | undefined;
        if (changes.track && changes.track !== c.track) {
          await this.lockSeason(tx, season.id);
          sortOrder = (await this.lastOrder(tx, season.id, changes.track)) + 1;
        }
        const [updated] = await tx
          .update(committees)
          .set({ ...changes, sortOrder })
          .where(eq(committees.id, id))
          .returning();
        return toCommittee(updated);
      });
    } catch (err) {
      throw uniqueViolation(err, duplicateName(season.name));
    }
  }

  async remove(id: string) {
    const c = await this.row(id);
    await this.editableSeason(c.seasonId);
    await this.db.delete(committees).where(eq(committees.id, id));
  }

  /** Swap with the neighbour in the same track; at either end it's a no-op. */
  async move(id: string, direction: 'up' | 'down'): Promise<Committee[]> {
    const c = await this.row(id);
    await this.editableSeason(c.seasonId);
    await this.db.transaction(async (tx) => {
      const list = (
        await tx
          .select()
          .from(committees)
          .where(
            and(
              eq(committees.seasonId, c.seasonId),
              eq(committees.track, c.track),
            ),
          )
          .for('update')
      ).sort(byTrackThenOrder);
      const i = list.findIndex((x) => x.id === id);
      const j = direction === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      // Rewrite 0..n so gaps or ties from earlier edits can't confuse order.
      for (const [k, x] of list.entries()) {
        if (x.sortOrder !== k) {
          await tx
            .update(committees)
            .set({ sortOrder: k })
            .where(eq(committees.id, x.id));
        }
      }
    });
    return this.ofSeason(c.seasonId);
  }

  private async insert(
    season: SeasonRow,
    dto: CommitteeDto,
  ): Promise<Committee> {
    try {
      return await this.db.transaction(async (tx) => {
        // One add at a time per season, so each gets its own place.
        await this.lockSeason(tx, season.id);
        const [created] = await tx
          .insert(committees)
          .values({
            seasonId: season.id,
            name: dto.name,
            track: dto.track,
            icon: dto.icon,
            description: dto.description,
            tasks: dto.tasks,
            sortOrder: (await this.lastOrder(tx, season.id, dto.track)) + 1,
          })
          .returning();
        return toCommittee(created);
      });
    } catch (err) {
      throw uniqueViolation(err, duplicateName(season.name));
    }
  }

  private async lastOrder(db: Database | Tx, seasonId: string, track: Track) {
    const rows = await db
      .select({ o: committees.sortOrder })
      .from(committees)
      .where(
        and(eq(committees.seasonId, seasonId), eq(committees.track, track)),
      );
    return rows.reduce((m, r) => Math.max(m, r.o), -1);
  }

  private async lockSeason(tx: Tx, seasonId: string) {
    await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .for('update');
  }

  private async row(id: string) {
    const [c] = await this.db
      .select()
      .from(committees)
      .where(eq(committees.id, id));
    if (!c) throw new NotFoundException('Committee not found.');
    return c;
  }

  private async season(id: string) {
    const [s] = await this.db.select().from(seasons).where(eq(seasons.id, id));
    if (!s) throw new NotFoundException('Season not found.');
    return s;
  }

  /** Archived seasons are kept as they were (same rule as the hierarchy). */
  private async editableSeason(id: string) {
    const s = await this.season(id);
    if (s.status === 'archived') {
      throw new BadRequestException(
        `${s.name} is archived and can't be changed.`,
      );
    }
    return s;
  }
}

type SeasonRow = typeof seasons.$inferSelect;

const seasonInfo = (s: SeasonRow) => ({
  id: s.id,
  number: s.number,
  name: s.name,
  status: s.status,
});

const duplicateName = (season: string) =>
  `A committee with this name already exists in ${season}.`;
