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
import { CreateRoleDto, SetMembersDto, UpdateRoleDto } from './dto';
import { RolesService } from './roles.service';
import { UsersService } from './users.service';

@Controller('roles')
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly users: UsersService,
  ) {}

  /** Any signed-in member may see the role list (names, permissions). */
  @Get()
  @Auth()
  list() {
    return this.roles.list();
  }

  @Get(':id/members')
  @Auth('members.view')
  members(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.memberIds(id);
  }

  @Post()
  @Auth('roles.manage')
  create(@Me() me: CurrentUser, @Body() dto: CreateRoleDto) {
    return this.roles.create(me, dto);
  }

  @Patch(':id')
  @Auth('roles.manage')
  update(
    @Me() me: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(me, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Auth('roles.manage')
  remove(@Me() me: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(me, id);
  }

  @Put(':id/members')
  @HttpCode(204)
  @Auth('roles.manage')
  setMembers(
    @Me() me: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMembersDto,
  ) {
    return this.users.setRoleMembers(me, id, dto.userIds);
  }
}
