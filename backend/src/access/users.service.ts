import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, inArray, ne, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { rolePermissions, roles, userRoles, users } from '../db/schema';
import { type CurrentUser, hasAll } from './current-user';
import { ALL_PERMISSIONS, isPermission, type Permission } from './permissions';
import { profileOf } from './profile';
import { RolesService } from './roles.service';
import type { PublicUser } from './serialize';

type UserRow = typeof users.$inferSelect;

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly roles: RolesService,
  ) {}

  findByEmail(email: string) {
    return this.db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .then((r) => r[0]);
  }

  findById(id: string) {
    return this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .then((r) => r[0]);
  }

  async loadCurrentUser(id: string, tokenVersion: number) {
    const u = await this.findById(id);
    if (!u || u.status !== 'active' || u.tokenVersion !== tokenVersion) {
      return null;
    }
    return this.toCurrentUser(u);
  }

  async toCurrentUser(u: UserRow): Promise<CurrentUser> {
    const myRoles = await this.db
      .select({ id: roles.id, name: roles.name, isSystem: roles.isSystem })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, u.id))
      .orderBy(asc(roles.name));
    const isPresident = myRoles.some((r) => r.isSystem);
    let permissions: Permission[] = [];
    if (isPresident) permissions = [...ALL_PERMISSIONS];
    else if (myRoles.length) {
      const rows = await this.db
        .selectDistinct({ p: rolePermissions.permission })
        .from(rolePermissions)
        .innerJoin(userRoles, eq(userRoles.roleId, rolePermissions.roleId))
        .where(eq(userRoles.userId, u.id));
      permissions = rows.map((r) => r.p).filter(isPermission);
    }
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      isPresident,
      roles: myRoles.map(({ id, name }) => ({ id, name })),
      permissions: new Set(permissions),
      profile: profileOf(u),
    };
  }

  async list(): Promise<PublicUser[]> {
    const all = await this.db.select().from(users).orderBy(asc(users.name));
    const links = await this.db
      .select({ userId: userRoles.userId, id: roles.id, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .orderBy(asc(roles.name));
    return all.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      roles: links
        .filter((l) => l.userId === u.id)
        .map(({ id, name }) => ({ id, name })),
      profile: profileOf(u),
    }));
  }

  /** Throws unless `actor` is at least as powerful as the target user. */
  async assertCanManage(actor: CurrentUser, targetId: string) {
    const row = await this.findById(targetId);
    if (!row) throw new NotFoundException('Member not found.');
    const target = await this.toCurrentUser(row);
    if (target.isPresident && !actor.isPresident) {
      throw new ForbiddenException('Only a President can change a President.');
    }
    if (!hasAll(actor, target.permissions)) {
      throw new ForbiddenException(
        "You can't change someone who has permissions you don't have.",
      );
    }
    return { row, target };
  }

  async countActivePresidents(excludeUserId?: string) {
    const [r] = await this.db
      .select({ n: count() })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(roles.isSystem, true),
          eq(users.status, 'active'),
          excludeUserId ? ne(users.id, excludeUserId) : undefined,
        ),
      );
    return Number(r.n);
  }

  private async assertNotLastPresident(userId: string) {
    if ((await this.countActivePresidents(userId)) === 0) {
      throw new BadRequestException(
        'The club must always have at least one active President. Appoint another President first.',
      );
    }
  }

  async setRoles(actor: CurrentUser, userId: string, roleIds: string[]) {
    const ids = [...new Set(roleIds)];
    const { target } = await this.assertCanManage(actor, userId);
    await this.roles.assertCanGrantRoles(actor, ids);
    const { includesPresident } = await this.roles.permissionsOf(ids);
    if (target.isPresident && !includesPresident) {
      await this.assertNotLastPresident(userId);
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, userId));
      if (ids.length) {
        await tx
          .insert(userRoles)
          .values(ids.map((roleId) => ({ userId, roleId })));
      }
    });
  }

  async setRoleMembers(actor: CurrentUser, roleId: string, userIds: string[]) {
    const role = await this.roles.getOrThrow(roleId);
    await this.roles.assertCanGrantRoles(actor, [roleId]);
    const wanted = new Set(userIds);
    const current = new Set(await this.roles.memberIds(roleId));
    const added = [...wanted].filter((id) => !current.has(id));
    const removed = [...current].filter((id) => !wanted.has(id));
    for (const id of [...added, ...removed])
      await this.assertCanManage(actor, id);
    if (role.isSystem && removed.length) {
      const stillPresident = wanted.size
        ? await this.db
            .select({ n: count() })
            .from(users)
            .where(
              and(eq(users.status, 'active'), inArray(users.id, [...wanted])),
            )
            .then((r) => Number(r[0].n))
        : 0;
      if (stillPresident === 0) {
        throw new BadRequestException(
          'The club must always have at least one active President.',
        );
      }
    }
    await this.db.transaction(async (tx) => {
      for (const userId of removed) {
        await tx
          .delete(userRoles)
          .where(
            and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)),
          );
      }
      if (added.length) {
        await tx
          .insert(userRoles)
          .values(added.map((userId) => ({ userId, roleId })))
          .onConflictDoNothing();
      }
    });
  }

  async setStatus(
    actor: CurrentUser,
    userId: string,
    status: 'active' | 'disabled',
  ) {
    if (userId === actor.id) {
      throw new BadRequestException("You can't disable your own account.");
    }
    const { target } = await this.assertCanManage(actor, userId);
    if (status === 'disabled' && target.isPresident) {
      await this.assertNotLastPresident(userId);
    }
    await this.db
      .update(users)
      .set({ status, tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  }
}
