import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';

// A valid bcrypt hash of a random string, used so that unknown emails take the
// same time to reject as known ones.
const DUMMY_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.2K9xV7Q2Cqk6v8XvGq2rjR8Q4wqS';

export type JwtPayload = { sub: string; email: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accounts: Map<string, string>;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    // BOARD_ACCOUNTS="email1:bcryptHash1,email2:bcryptHash2"
    this.accounts = new Map(
      (config.get<string>('BOARD_ACCOUNTS') ?? '')
        .split(',')
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => {
          const i = pair.indexOf(':');
          return [pair.slice(0, i).toLowerCase(), pair.slice(i + 1)] as const;
        }),
    );
    if (this.accounts.size === 0) {
      this.logger.warn(
        'No BOARD_ACCOUNTS configured: board login is disabled. See README.',
      );
    }
  }

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const hash = this.accounts.get(normalized);
    const ok = await compare(password, hash ?? DUMMY_HASH);
    if (!hash || !ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const payload: JwtPayload = { sub: normalized, email: normalized };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
