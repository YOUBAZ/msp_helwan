import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
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
import { MAX_AVATAR_BYTES, ProfileService } from './profile.service';
import { serializeMe } from './serialize';
import { TokensService } from './tokens.service';

const STRICT = { default: { ttl: 60_000, limit: 5 } };

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    private readonly profiles: ProfileService,
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
    const profile = await this.profiles.update(me.id, dto);
    return serializeMe({ ...me, name: dto.name, profile });
  }

  @Post('auth/me/avatar')
  @Auth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
    }),
  )
  uploadAvatar(
    @Me() me: CurrentUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.profiles.setAvatar(me.id, file);
  }

  @Delete('auth/me/avatar')
  @HttpCode(204)
  @Auth()
  removeAvatar(@Me() me: CurrentUser) {
    return this.profiles.removeAvatar(me.id);
  }

  /**
   * Profile photos. Public so <img> tags can load them; ids are random UUIDs
   * and the member list itself requires login. Cached forever per version (?v=).
   */
  @Get('users/:id/avatar')
  @SkipThrottle()
  async avatar(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = await this.profiles.getAvatar(id);
    res.set({
      'Content-Type': a.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(a.data);
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
