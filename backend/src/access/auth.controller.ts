import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Auth, Me } from './auth.guard';
import { AuthService } from './auth.service';
import type { CurrentUser } from './current-user';
import {
  ChangePasswordDto,
  LoginDto,
  RedeemTokenDto,
  UpdateMeDto,
} from './dto';
import { PERMISSIONS } from './permissions';
import { serializeMe } from './serialize';
import { TokensService } from './tokens.service';
import { UsersService } from './users.service';

const STRICT = { default: { ttl: 60_000, limit: 5 } };

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
  ) {}

  @Post('auth/login')
  @HttpCode(200)
  @Throttle(STRICT)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('auth/me')
  @Auth()
  me(@Me() me: CurrentUser) {
    return serializeMe(me);
  }

  @Patch('auth/me')
  @Auth()
  async updateMe(@Me() me: CurrentUser, @Body() dto: UpdateMeDto) {
    await this.users.updateName(me.id, dto.name);
    return serializeMe({ ...me, name: dto.name });
  }

  @Post('auth/me/password')
  @HttpCode(200)
  @Auth()
  @Throttle(STRICT)
  changePassword(@Me() me: CurrentUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(me, dto.currentPassword, dto.newPassword);
  }

  /** Public: check an invitation / reset link before showing the form. */
  @Get('auth/links/:token')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  inspect(@Param('token') token: string) {
    return this.tokens.inspect(token);
  }

  /** Public: accept an invitation or set a new password, then log in. */
  @Post('auth/links/:token')
  @HttpCode(200)
  @Throttle(STRICT)
  async redeem(@Param('token') token: string, @Body() dto: RedeemTokenDto) {
    const user = await this.tokens.redeem(token, dto);
    return this.auth.startSession(user);
  }

  /** The checklist shown when creating or editing a role. */
  @Get('permissions')
  @Auth()
  permissions() {
    return PERMISSIONS;
  }
}
