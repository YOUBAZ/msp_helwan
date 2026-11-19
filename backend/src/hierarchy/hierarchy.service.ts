import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { uniqueViolation } from '../access/roles.service';
import { DB, type Database } from '../db/database';
import { moveInOrder } from '../db/reorder';
import {
  hierarchyMembers,
  hierarchyPositions,
  seasons,
  users,
} from '../db/schema';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type SeasonRow = typeof seasons.$inferSelect;

export type HierarchyMember = {
  id: string;
  userId: string | null;
  name: string;
  /** API-relative photo path for account holders. */
  avatarUrl: string | null;
  /** Site-relative photo path for people from before accounts existed. */
  imageUrl: string | null;
  linkedinUrl: string | null;
};

export type HierarchyPosition = {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  members: HierarchyMember[];
};

const serializeSeason = (s: SeasonRow) => ({
  id: s.id,
  number: s.number,
  name: s.name,
  status: s.status,
  publishedAt: s.publishedAt,
});

@Injectable()
export class HierarchyService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------- Reading ----------

  /** Seasons visible on the public Team page, newest first. */
  async publicSeasons() {
    const rows = await this.db
      .select()
      .from(seasons)
      .where(ne(seasons.status, 'draft'))
      .orderBy(desc(seasons.number));
    const current = rows.find((s) => s.status === 'current') ?? rows[0];
    return {
      seasons: rows.map(serializeSeason),
      defaultNumber: current?.number ?? null,
    };
  }

  async allSeasons() {
    const rows = await this.db
      .select()
      .from(seasons)
      .orderBy(desc(seasons.number));
    return rows.map(serializeSeason);
  }

  async publicTree(number: number) {
    const [season] = await this.db
      .select()
      .from(seasons)
      .where(and(eq(seasons.number, number), ne(seasons.status, 'draft')));
    if (!season) throw new NotFoundException('Season not found.');
    return {
      season: serializeSeason(season),
      positions: await this.positions(season.id),
    };
  }

  async adminTree(seasonId: string) {
    const season = await this.season(seasonId);
    return {
      season: serializeSeason(season),
      positions: await this.positions(season.id),
    };
  }

  private async positions(seasonId: string): Promise<HierarchyPosition[]> {
    const pos = await this.db
      .select()
      .from(hierarchyPositions)
      .where(eq(hierarchyPositions.seasonId, seasonId))
      .orderBy(
        asc(hierarchyPositions.sortOrder),
        asc(hierarchyPositions.createdAt),
      );
    if (!pos.length) return [];
    const mem = await this.db
      .select({
        m: hierarchyMembers,
        name: users.name,
        avatarVersion: users.avatarVersion,
        linkedinUrl: users.linkedinUrl,
      })
      .from(hierarchyMembers)
      .leftJoin(users, eq(users.id, hierarchyMembers.userId))
      .where(
        inArray(
          hierarchyMembers.positionId,
          pos.map((p) => p.id),
        ),
      )
      .orderBy(
        asc(hierarchyMembers.sortOrder),
        asc(hierarchyMembers.createdAt),
      );
    return pos.map((p) => ({
      id: p.id,
      parentId: p.parentId,
      title: p.title,
      sortOrder: p.sortOrder,
      members: mem
        .filter((r) => r.m.positionId === p.id)
        // An account that was deleted leaves no name behind: skip it.
        .filter((r) => (r.m.userId ? !!r.name : !!r.m.legacyName))
        .map(({ m, name, avatarVersion, linkedinUrl }) => ({
          id: m.id,
          userId: m.userId,
          name: m.userId ? name! : m.legacyName!,
          avatarUrl:
            m.userId && avatarVersion
              ? `/users/${m.userId}/avatar?v=${avatarVersion}`
              : null,
          imageUrl: m.userId ? null : m.legacyImage,
          linkedinUrl: m.userId ? linkedinUrl : m.legacyLinkedin,
        })),
    }));
  }

  /** Active accounts the President can place in the hierarchy. */
  async people() {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarVersion: users.avatarVersion,
        linkedinUrl: users.linkedinUrl,
      })
      .from(users)
      .where(eq(users.status, 'active'))
      .orderBy(asc(users.name));
    return rows.map(({ avatarVersion, ...u }) => ({
      ...u,
      avatarUrl: avatarVersion
        ? `/users/${u.id}/avatar?v=${avatarVersion}`
        : null,
    }));
  }

  /**
   * Public profile of someone shown on the Our Team page. Only people placed in
   * a published season are visible, and only non-private fields are returned
   * (no email, phone, birthday or gender).
   */
  async publicProfile(userId: string) {
    const positions = await this.db
      .select({
        seasonNumber: seasons.number,
        seasonName: seasons.name,
        seasonStatus: seasons.status,
        title: hierarchyPositions.title,
      })
      .from(hierarchyMembers)
      .innerJoin(
        hierarchyPositions,
        eq(hierarchyPositions.id, hierarchyMembers.positionId),
      )
      .innerJoin(seasons, eq(seasons.id, hierarchyPositions.seasonId))
      .where(
        and(eq(hierarchyMembers.userId, userId), ne(seasons.status, 'draft')),
      )
      .orderBy(desc(seasons.number), asc(hierarchyPositions.title));
    const [u] = positions.length
      ? await this.db.select().from(users).where(eq(users.id, userId))
      : [];
    if (!u) throw new NotFoundException('Profile not found.');
    return {
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarVersion
        ? `/users/${u.id}/avatar?v=${u.avatarVersion}`
        : null,
      linkedinUrl: u.linkedinUrl,
      facebookUrl: u.facebookUrl,
      portfolioUrl: u.portfolioUrl,
      positions,
    };
  }

  // ---------- Seasons ----------

  private async season(id: string) {
    const [s] = await this.db.select().from(seasons).where(eq(seasons.id, id));
    if (!s) throw new NotFoundException('Season not found.');
    return s;
  }

  private async editableSeason(id: string) {
    const s = await this.season(id);
    if (s.status === 'archived') {
      throw new BadRequestException(
        `${s.name} is archived and can't be changed.`,
      );
    }
    return s;
  }

  async createSeason(dto: {
    number: number;
    name?: string;
    copyFromSeasonId?: string;
  }) {
    try {
      return await this.db.transaction(async (tx) => {
        const [s] = await tx
          .insert(seasons)
          .values({
            number: dto.number,
            name: dto.name ?? `Season ${dto.number}`,
          })
          .returning();
        if (dto.copyFromSeasonId)
          await this.copyStructure(tx, dto.copyFromSeasonId, s.id);
        return serializeSeason(s);
      });
    } catch (err) {
      throw uniqueViolation(err, `Season ${dto.number} already exists.`);
    }
  }

  /** Copy position titles and nesting (not people) into another season. */
  private async copyStructure(
    tx: Tx,
    fromSeasonId: string,
    toSeasonId: string,
  ) {
    const src = await tx
      .select()
      .from(hierarchyPositions)
      .where(eq(hierarchyPositions.seasonId, fromSeasonId));
    if (!src.length) {
      const [exists] = await tx
        .select()
        .from(seasons)
        .where(eq(seasons.id, fromSeasonId));
      if (!exists)
        throw new NotFoundException('Season to copy from not found.');
      return;
    }
    const newId = new Map<string, string>();
    let level = src.filter((p) => !p.parentId);
    while (level.length) {
      for (const p of level) {
        const [row] = await tx
          .insert(hierarchyPositions)
          .values({
            seasonId: toSeasonId,
            parentId: p.parentId ? newId.get(p.parentId)! : null,
            title: p.title,
            sortOrder: p.sortOrder,
          })
          .returning({ id: hierarchyPositions.id });
        newId.set(p.id, row.id);
      }
      const ids = new Set(level.map((p) => p.id));
      level = src.filter((p) => p.parentId && ids.has(p.parentId));
    }
  }

  async renameSeason(id: string, name: string) {
    await this.editableSeason(id);
    await this.db.update(seasons).set({ name }).where(eq(seasons.id, id));
  }

  /** Make a draft the current season; the previous current one is archived. */
  async publish(id: string) {
    const s = await this.season(id);
    if (s.status !== 'draft') {
      throw new BadRequestException(`${s.name} is already published.`);
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(seasons)
        .set({ status: 'archived' })
        .where(eq(seasons.status, 'current'));
      await tx
        .update(seasons)
        .set({ status: 'current', publishedAt: new Date() })
        .where(eq(seasons.id, id));
    });
  }

  async deleteSeason(id: string) {
    const s = await this.season(id);
    if (s.status !== 'draft') {
      throw new BadRequestException(
        'Only draft seasons can be deleted. Published seasons are kept as history.',
      );
    }
    await this.db.delete(seasons).where(eq(seasons.id, id));
  }

  // ---------- Positions ----------

  private async position(id: string) {
    const [p] = await this.db
      .select()
      .from(hierarchyPositions)
      .where(eq(hierarchyPositions.id, id));
    if (!p) throw new NotFoundException('Position not found.');
    await this.editableSeason(p.seasonId);
    return p;
  }

  private async nextOrder(seasonId: string, parentId: string | null) {
    const [r] = await this.db
      .select({ max: sql<number | null>`max(${hierarchyPositions.sortOrder})` })
      .from(hierarchyPositions)
      .where(
        and(
          eq(hierarchyPositions.seasonId, seasonId),
          parentId
            ? eq(hierarchyPositions.parentId, parentId)
            : sql`${hierarchyPositions.parentId} IS NULL`,
        ),
      );
    return (r.max ?? -1) + 1;
  }

  async addPosition(
    seasonId: string,
    dto: { title: string; parentId?: string },
  ) {
    await this.editableSeason(seasonId);
    if (dto.parentId) {
      const [parent] = await this.db
        .select()
        .from(hierarchyPositions)
        .where(eq(hierarchyPositions.id, dto.parentId));
      if (!parent || parent.seasonId !== seasonId) {
        throw new BadRequestException(
          'The parent position is not in this season.',
        );
      }
    }
    const [row] = await this.db
      .insert(hierarchyPositions)
      .values({
        seasonId,
        parentId: dto.parentId ?? null,
        title: dto.title,
        sortOrder: await this.nextOrder(seasonId, dto.parentId ?? null),
      })
      .returning();
    return row;
  }

  async renamePosition(id: string, title: string) {
    await this.position(id);
    await this.db
      .update(hierarchyPositions)
      .set({ title })
      .where(eq(hierarchyPositions.id, id));
  }

  async movePosition(id: string, direction: 'up' | 'down') {
    const p = await this.position(id);
    await moveInOrder(
      this.db,
      (tx) =>
        tx
          .select({
            id: hierarchyPositions.id,
            sortOrder: hierarchyPositions.sortOrder,
          })
          .from(hierarchyPositions)
          .where(
            and(
              eq(hierarchyPositions.seasonId, p.seasonId),
              p.parentId
                ? eq(hierarchyPositions.parentId, p.parentId)
                : sql`${hierarchyPositions.parentId} IS NULL`,
            ),
          )
          .orderBy(
            asc(hierarchyPositions.sortOrder),
            asc(hierarchyPositions.createdAt),
          ),
      id,
      direction,
      (tx, sid, sortOrder) =>
        tx
          .update(hierarchyPositions)
          .set({ sortOrder })
          .where(eq(hierarchyPositions.id, sid)),
    );
  }

  /** Deleting a position also deletes everything under it. */
  async deletePosition(id: string) {
    await this.position(id);
    await this.db
      .delete(hierarchyPositions)
      .where(eq(hierarchyPositions.id, id));
  }

  // ---------- People in positions ----------

  async addMember(positionId: string, userId: string) {
    const p = await this.position(positionId);
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    if (!user || user.status !== 'active') {
      throw new BadRequestException(
        'Only people with an active account can be added. Invite them from the Members page first.',
      );
    }
    const [r] = await this.db
      .select({ max: sql<number | null>`max(${hierarchyMembers.sortOrder})` })
      .from(hierarchyMembers)
      .where(eq(hierarchyMembers.positionId, p.id));
    try {
      await this.db
        .insert(hierarchyMembers)
        .values({ positionId: p.id, userId, sortOrder: (r.max ?? -1) + 1 });
    } catch (err) {
      throw uniqueViolation(err, `${user.name} already holds this position.`);
    }
  }

  private async member(id: string) {
    const [m] = await this.db
      .select()
      .from(hierarchyMembers)
      .where(eq(hierarchyMembers.id, id));
    if (!m) throw new NotFoundException('Person not found in this position.');
    await this.position(m.positionId);
    return m;
  }

  async removeMember(id: string) {
    await this.member(id);
    await this.db.delete(hierarchyMembers).where(eq(hierarchyMembers.id, id));
  }

  async moveMember(id: string, direction: 'up' | 'down') {
    const m = await this.member(id);
    await moveInOrder(
      this.db,
      (tx) =>
        tx
          .select({
            id: hierarchyMembers.id,
            sortOrder: hierarchyMembers.sortOrder,
          })
          .from(hierarchyMembers)
          .where(eq(hierarchyMembers.positionId, m.positionId))
          .orderBy(
            asc(hierarchyMembers.sortOrder),
            asc(hierarchyMembers.createdAt),
          ),
      id,
      direction,
      (tx, sid, sortOrder) =>
        tx
          .update(hierarchyMembers)
          .set({ sortOrder })
          .where(eq(hierarchyMembers.id, sid)),
    );
  }
}
