import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { DB, type Database } from '../db/database';
import { accountTokens, roles, userRoles, users } from '../db/schema';
import type { CurrentUser } from './current-user';
import { RolesService } from './roles.service';
import { UsersService } from './users.service';

const DAY = 24 * 60 * 60 * 1000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class TokensService {
  private readonly frontendUrl: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly roles: RolesService,
    private readonly users: UsersService,
    config: ConfigService,
  ) {
    this.frontendUrl = (
      config.get<string>('FRONTEND_URL') ??
      (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3001').split(
        ',',
      )[0]
    )
      .trim()
      .replace(/\/+$/, '');
  }

  private link(raw: string) {
    return `${this.frontendUrl}/set-password/${raw}`;
  }

  private async issue(
    values: Omit<typeof accountTokens.$inferInsert, 'tokenHash'>,
  ) {
    const raw = randomBytes(32).toString('base64url');
    const [row] = await this.db
      .insert(accountTokens)
      .values({ ...values, tokenHash: sha256(raw) })
      .returning();
    return { row, link: this.link(raw) };
  }

  async createInvite(
    actor: CurrentUser,
    dto: { email: string; name: string; roleIds: string[] },
  ) {
    const email = dto.email.trim().toLowerCase();
    const roleIds = [...new Set(dto.roleIds)];
    if (await this.users.findByEmail(email)) {
      throw new ConflictException(
        'Someone with this email already has an account.',
      );
    }
    await this.roles.assertCanGrantRoles(actor, roleIds);
    // Re-inviting replaces any earlier pending invitation for the same email.
    await this.db
      .delete(accountTokens)
      .where(
        and(
          eq(accountTokens.type, 'invite'),
          eq(accountTokens.email, email),
          isNull(accountTokens.usedAt),
        ),
      );
    const { row, link } = await this.issue({
      type: 'invite',
      email,
      name: dto.name.trim(),
      roleIds,
      createdBy: actor.id,
      expiresAt: new Date(Date.now() + 7 * DAY),
    });
    return { id: row.id, email, link, expiresAt: row.expiresAt };
  }

  async listInvites() {
    const pending = await this.db
      .select({
        id: accountTokens.id,
        email: accountTokens.email,
        name: accountTokens.name,
        roleIds: accountTokens.roleIds,
        expiresAt: accountTokens.expiresAt,
        createdAt: accountTokens.createdAt,
        invitedBy: users.name,
      })
      .from(accountTokens)
      .leftJoin(users, eq(users.id, accountTokens.createdBy))
      .where(
        and(
          eq(accountTokens.type, 'invite'),
          isNull(accountTokens.usedAt),
          gt(accountTokens.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(accountTokens.createdAt));
    const ids = [...new Set(pending.flatMap((p) => p.roleIds))];
    const names = ids.length
      ? await this.db
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .where(inArray(roles.id, ids))
      : [];
    return pending.map(({ roleIds, ...p }) => ({
      ...p,
      roles: names.filter((n) => roleIds.includes(n.id)),
    }));
  }

  async revokeInvite(id: string) {
    const deleted = await this.db
      .delete(accountTokens)
      .where(and(eq(accountTokens.id, id), eq(accountTokens.type, 'invite')))
      .returning({ id: accountTokens.id });
    if (!deleted.length) throw new NotFoundException('Invitation not found.');
  }

  async createResetLink(actor: CurrentUser, userId: string) {
    const { row: user } = await this.users.assertCanManage(actor, userId);
    await this.db
      .delete(accountTokens)
      .where(
        and(
          eq(accountTokens.type, 'reset'),
          eq(accountTokens.userId, userId),
          isNull(accountTokens.usedAt),
        ),
      );
    const { row, link } = await this.issue({
      type: 'reset',
      email: user.email,
      name: user.name,
      userId,
      createdBy: actor.id,
      expiresAt: new Date(Date.now() + DAY),
    });
    return { link, expiresAt: row.expiresAt };
  }

  private async findValid(raw: string) {
    const [row] = await this.db
      .select()
      .from(accountTokens)
      .where(eq(accountTokens.tokenHash, sha256(raw)));
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new NotFoundException(
        'This link is invalid or has expired. Ask a board member for a new one.',
      );
    }
    return row;
  }

  async inspect(raw: string) {
    const t = await this.findValid(raw);
    return { type: t.type, email: t.email, name: t.name };
  }

  /** Accept an invitation or reset a password. Returns the user. */
  async redeem(raw: string, dto: { name?: string; password: string }) {
    const t = await this.findValid(raw);
    const passwordHash = await hash(dto.password, 10);
    return this.db.transaction(async (tx) => {
      // Mark used first; the WHERE makes a second concurrent use fail.
      const claimed = await tx
        .update(accountTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(accountTokens.id, t.id), isNull(accountTokens.usedAt)))
        .returning({ id: accountTokens.id });
      if (!claimed.length)
        throw new BadRequestException('This link was already used.');

      if (t.type === 'reset') {
        const [user] = await tx
          .update(users)
          .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
          .where(eq(users.id, t.userId!))
          .returning();
        if (!user) throw new NotFoundException('Account not found.');
        return user;
      }

      const name = (dto.name ?? t.name).trim();
      if (name.length < 2)
        throw new BadRequestException('Please enter your name.');
      const [user] = await tx
        .insert(users)
        .values({ email: t.email, name, passwordHash })
        .onConflictDoNothing()
        .returning();
      if (!user) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      const stillExisting = t.roleIds.length
        ? await tx
            .select({ id: roles.id })
            .from(roles)
            .where(inArray(roles.id, t.roleIds))
        : [];
      if (stillExisting.length) {
        await tx
          .insert(userRoles)
          .values(
            stillExisting.map((r) => ({ userId: user.id, roleId: r.id })),
          );
      }
      return user;
    });
  }
}
