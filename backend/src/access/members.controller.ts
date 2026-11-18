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
  Put,
} from '@nestjs/common';
import { Auth, Me } from './auth.guard';
import type { CurrentUser } from './current-user';
import { CreateInviteDto, SetRolesDto, SetStatusDto } from './dto';
import { TokensService } from './tokens.service';
import { UsersService } from './users.service';

@Controller()
export class MembersController {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokensService,
  ) {}

  @Get('members')
  @Auth('members.view')
  list() {
    return this.users.list();
  }

  @Put('members/:id/roles')
  @HttpCode(204)
  @Auth('members.manage')
  setRoles(
    @Me() me: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolesDto,
  ) {
    return this.users.setRoles(me, id, dto.roleIds);
  }

  @Patch('members/:id/status')
  @HttpCode(204)
  @Auth('members.manage')
  setStatus(
    @Me() me: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
  ) {
    return this.users.setStatus(me, id, dto.status);
  }

  @Post('members/:id/reset-link')
  @Auth('members.manage')
  resetLink(@Me() me: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tokens.createResetLink(me, id);
  }

  @Get('invites')
  @Auth('members.invite')
  invites() {
    return this.tokens.listInvites();
  }

  @Post('invites')
  @Auth('members.invite')
  invite(@Me() me: CurrentUser, @Body() dto: CreateInviteDto) {
    return this.tokens.createInvite(me, dto);
  }

  @Delete('invites/:id')
  @HttpCode(204)
  @Auth('members.invite')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.tokens.revokeInvite(id);
  }
}
