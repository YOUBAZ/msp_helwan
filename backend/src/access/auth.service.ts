import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { users } from '../db/schema';
import type { JwtPayload } from './auth.guard';
import type { CurrentUser } from './current-user';
import { UsersService } from './users.service';

// Valid bcrypt hash of a random string: unknown emails take as long to reject
// as known ones, so attackers can't probe which emails have accounts.
const DUMMY_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.2K9xV7Q2Cqk6v8XvGq2rjR8Q4wqS';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async issueToken(user: { id: string; tokenVersion: number }) {
    const payload: JwtPayload = { sub: user.id, tv: user.tokenVersion };
    return { accessToken: await this.jwt.signAsync(payload) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    const ok = await compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok)
      throw new UnauthorizedException('Invalid email or password.');
    if (user.status !== 'active') {
      throw new UnauthorizedException('This account has been disabled.');
    }
    return this.startSession(user);
  }

  /** Record the login time and issue a token. */
  async startSession(user: { id: string; tokenVersion: number }) {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    return this.issueToken(user);
  }

  async changePassword(me: CurrentUser, current: string, next: string) {
    const user = await this.users.findById(me.id);
    if (!user || !(await compare(current, user.passwordHash))) {
      throw new BadRequestException('Your current password is incorrect.');
    }
    const [updated] = await this.db
      .update(users)
      .set({
        passwordHash: await hash(next, 10),
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(eq(users.id, me.id))
      .returning();
    // Other devices are logged out; this one gets a fresh token.
    return this.issueToken(updated);
  }
}
