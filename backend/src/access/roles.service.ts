import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, count, desc, eq, inArray } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { rolePermissions, roles, userRoles, users } from '../db/schema';
import { type CurrentUser, hasAll } from './current-user';
import { ALL_PERMISSIONS, isPermission } from './permissions';

const NO_ESCALATION = "You can't give out permissions you don't have yourself.";

@Injectable()
export class RolesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list() {
    const rows = await this.db
      .select()
      .from(roles)
      .orderBy(desc(roles.isSystem), asc(roles.createdAt));
    const perms = await this.db.select().from(rolePermissions);
    const counts = await this.db
      .select({ roleId: userRoles.roleId, n: count() })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .groupBy(userRoles.roleId);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.isSystem
        ? [...ALL_PERMISSIONS]
        : perms.filter((p) => p.roleId === r.id).map((p) => p.permission),
      memberCount: Number(counts.find((c) => c.roleId === r.id)?.n ?? 0),
    }));
  }

  async memberIds(roleId: string) {
    await this.getOrThrow(roleId);
    const rows = await this.db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));
    return rows.map((r) => r.userId);
  }

  async getOrThrow(id: string) {
    const [role] = await this.db.select().from(roles).where(eq(roles.id, id));
    if (!role) throw new NotFoundException('Role not found.');
    return role;
  }

  /** Effective permissions of a set of roles. */
  async permissionsOf(roleIds: string[]) {
    if (roleIds.length === 0) {
      return { permissions: new Set<string>(), includesPresident: false };
    }
    const found = await this.db
      .select()
      .from(roles)
      .where(inArray(roles.id, roleIds));
    if (found.length !== new Set(roleIds).size) {
      throw new BadRequestException('One or more roles no longer exist.');
    }
    const includesPresident = found.some((r) => r.isSystem);
    const perms = await this.db
      .select({ p: rolePermissions.permission })
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds));
    return {
      permissions: new Set<string>(
        includesPresident ? ALL_PERMISSIONS : perms.map((x) => x.p),
      ),
      includesPresident,
    };
  }

  /** Throws unless `actor` may hand these roles to someone. */
  async assertCanGrantRoles(actor: CurrentUser, roleIds: string[]) {
    const { permissions, includesPresident } =
      await this.permissionsOf(roleIds);
    if (includesPresident && !actor.isPresident) {
      throw new ForbiddenException('Only a President can appoint a President.');
    }
    if (!hasAll(actor, permissions))
      throw new ForbiddenException(NO_ESCALATION);
  }

  private validatePermissions(actor: CurrentUser, list: string[]) {
    const unknown = list.filter((p) => !isPermission(p));
    if (unknown.length) {
      throw new BadRequestException(
        `Unknown permission: ${unknown.join(', ')}`,
      );
    }
    if (!hasAll(actor, list)) throw new ForbiddenException(NO_ESCALATION);
    return [...new Set(list)];
  }

  async create(
    actor: CurrentUser,
    dto: { name: string; description?: string; permissions: string[] },
  ) {
    const permissions = this.validatePermissions(actor, dto.permissions);
    try {
      return await this.db.transaction(async (tx) => {
        const [role] = await tx
          .insert(roles)
          .values({ name: dto.name, description: dto.description ?? '' })
          .returning();
        if (permissions.length) {
          await tx.insert(rolePermissions).values(
            permissions.map((permission) => ({
              roleId: role.id,
              permission,
            })),
          );
        }
        return { ...role, permissions, memberCount: 0 };
      });
    } catch (err) {
      throw uniqueViolation(err, 'A role with this name already exists.');
    }
  }

  private async assertEditable(actor: CurrentUser, id: string) {
    const role = await this.getOrThrow(id);
    if (role.isSystem) {
      throw new ForbiddenException('The President role cannot be changed.');
    }
    const { permissions } = await this.permissionsOf([id]);
    if (!hasAll(actor, permissions)) {
      throw new ForbiddenException(
        "You can't change a role that has permissions you don't have.",
      );
    }
    return role;
  }

  async update(
    actor: CurrentUser,
    id: string,
    dto: { name?: string; description?: string; permissions?: string[] },
  ) {
    await this.assertEditable(actor, id);
    const permissions =
      dto.permissions && this.validatePermissions(actor, dto.permissions);
    try {
      await this.db.transaction(async (tx) => {
        if (dto.name !== undefined || dto.description !== undefined) {
          await tx
            .update(roles)
            .set({ name: dto.name, description: dto.description })
            .where(eq(roles.id, id));
        }
        if (permissions) {
          await tx
            .delete(rolePermissions)
            .where(eq(rolePermissions.roleId, id));
          if (permissions.length) {
            await tx
              .insert(rolePermissions)
              .values(
                permissions.map((permission) => ({ roleId: id, permission })),
              );
          }
        }
      });
    } catch (err) {
      throw uniqueViolation(err, 'A role with this name already exists.');
    }
    return (await this.list()).find((r) => r.id === id);
  }

  async remove(actor: CurrentUser, id: string) {
    await this.assertEditable(actor, id);
    await this.db.delete(roles).where(eq(roles.id, id));
  }
}

/** Turn a Postgres unique-constraint error into a friendly 409. */
export function uniqueViolation(err: unknown, message: string) {
  const e = err as { code?: string; cause?: { code?: string } };
  if (e?.code === '23505' || e?.cause?.code === '23505') {
    return new ConflictException(message);
  }
  return err;
}
