import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { count, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { rolePermissions, roles, userRoles, users } from '../db/schema';
import { DEFAULT_ROLES, PRESIDENT_ROLE } from './permissions';

/**
 * Runs on every start, but only does something on a fresh database:
 *  1. creates the default roles (President, High Board, Board, Member);
 *  2. if there are no users yet, creates the accounts listed in BOARD_ACCOUNTS
 *     ("email:bcryptHash,...") as Presidents, so someone can log in and invite
 *     everyone else.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly log = new Logger('Bootstrap');

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedRoles();
    await this.seedPresidents();
  }

  private async seedRoles() {
    const [{ n }] = await this.db.select({ n: count() }).from(roles);
    if (Number(n) > 0) return;
    for (const r of DEFAULT_ROLES) {
      const [role] = await this.db
        .insert(roles)
        .values({
          name: r.name,
          description: r.description,
          isSystem: !!r.isSystem,
        })
        .onConflictDoNothing()
        .returning();
      if (role && r.permissions.length) {
        await this.db
          .insert(rolePermissions)
          .values(
            r.permissions.map((permission) => ({
              roleId: role.id,
              permission,
            })),
          )
          .onConflictDoNothing();
      }
    }
    this.log.log('Created default roles');
  }

  private async seedPresidents() {
    const [{ n }] = await this.db.select({ n: count() }).from(users);
    if (Number(n) > 0) return;
    const accounts = (this.config.get<string>('BOARD_ACCOUNTS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((pair) => {
        const i = pair.indexOf(':');
        return {
          email: pair.slice(0, i).toLowerCase(),
          hash: pair.slice(i + 1),
        };
      })
      .filter((a) => a.email && a.hash.startsWith('$2'));
    if (!accounts.length) {
      this.log.warn(
        'No users yet and BOARD_ACCOUNTS is empty: nobody can log in. See README.',
      );
      return;
    }
    const [president] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, PRESIDENT_ROLE));
    for (const a of accounts) {
      const [user] = await this.db
        .insert(users)
        .values({
          email: a.email,
          name: a.email.split('@')[0],
          passwordHash: a.hash,
        })
        .onConflictDoNothing()
        .returning();
      if (user && president) {
        await this.db
          .insert(userRoles)
          .values({ userId: user.id, roleId: president.id })
          .onConflictDoNothing();
      }
    }
    this.log.log(
      `Created ${accounts.length} President account(s) from BOARD_ACCOUNTS`,
    );
  }
}
