import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Auth } from '../access/auth.guard';
import {
  AddMemberDto,
  CreatePositionDto,
  CreateSeasonDto,
  MoveDto,
  RenamePositionDto,
  RenameSeasonDto,
} from './dto';
import { HierarchyService } from './hierarchy.service';

/** Public: the "Our Team" page. Drafts are never shown here. */
@Controller('seasons')
export class PublicSeasonsController {
  constructor(private readonly h: HierarchyService) {}

  @Get()
  list() {
    return this.h.publicSeasons();
  }

  @Get(':number/hierarchy')
  tree(@Param('number', ParseIntPipe) number: number) {
    return this.h.publicTree(number);
  }
}

/** Public profiles of people shown on the Our Team page. */
@Controller('people')
export class PublicPeopleController {
  constructor(private readonly h: HierarchyService) {}

  @Get(':id')
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.h.publicProfile(id);
  }
}

/** Building hierarchies. Requires the "seasons.manage" permission. */
@Controller('admin')
@Auth('seasons.manage')
export class AdminHierarchyController {
  constructor(private readonly h: HierarchyService) {}

  @Get('seasons')
  seasons() {
    return this.h.allSeasons();
  }

  @Get('seasons/people')
  people() {
    return this.h.people();
  }

  @Post('seasons')
  createSeason(@Body() dto: CreateSeasonDto) {
    return this.h.createSeason(dto);
  }

  @Get('seasons/:id/hierarchy')
  tree(@Param('id', ParseUUIDPipe) id: string) {
    return this.h.adminTree(id);
  }

  @Patch('seasons/:id')
  @HttpCode(204)
  renameSeason(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameSeasonDto,
  ) {
    return this.h.renameSeason(id, dto.name);
  }

  @Post('seasons/:id/publish')
  @HttpCode(204)
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.h.publish(id);
  }

  @Delete('seasons/:id')
  @HttpCode(204)
  deleteSeason(@Param('id', ParseUUIDPipe) id: string) {
    return this.h.deleteSeason(id);
  }

  @Post('seasons/:id/positions')
  addPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePositionDto,
  ) {
    return this.h.addPosition(id, dto);
  }

  @Patch('positions/:id')
  @HttpCode(204)
  renamePosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenamePositionDto,
  ) {
    return this.h.renamePosition(id, dto.title);
  }

  @Post('positions/:id/move')
  @HttpCode(204)
  movePosition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDto) {
    return this.h.movePosition(id, dto.direction);
  }

  @Delete('positions/:id')
  @HttpCode(204)
  deletePosition(@Param('id', ParseUUIDPipe) id: string) {
    return this.h.deletePosition(id);
  }

  @Post('positions/:id/members')
  @HttpCode(204)
  addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMemberDto) {
    return this.h.addMember(id, dto.userId);
  }

  @Delete('position-members/:id')
  @HttpCode(204)
  removeMember(@Param('id', ParseUUIDPipe) id: string) {
    return this.h.removeMember(id);
  }

  @Post('position-members/:id/move')
  @HttpCode(204)
  moveMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDto) {
    return this.h.moveMember(id, dto.direction);
  }
}
