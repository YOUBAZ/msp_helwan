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
  Query,
} from '@nestjs/common';
import { Auth } from '../access/auth.guard';
import { CommitteesService } from './committees.service';
import {
  CommitteeDto,
  CopyCommitteeDto,
  MoveDto,
  UpdateCommitteeDto,
} from './dto';

/** Public: the Committees page. */
@Controller('committees')
export class PublicCommitteesController {
  constructor(private readonly committees: CommitteesService) {}

  @Get()
  view(@Query('season', new ParseIntPipe({ optional: true })) season?: number) {
    return this.committees.publicView(season);
  }
}

/** Managing committees. Requires "committees.manage". */
@Controller('admin')
@Auth('committees.manage')
export class AdminCommitteesController {
  constructor(private readonly committees: CommitteesService) {}

  @Get('committees/seasons')
  seasons() {
    return this.committees.adminSeasons();
  }

  @Get('seasons/:id/committees')
  season(@Param('id', ParseUUIDPipe) id: string) {
    return this.committees.adminSeason(id);
  }

  @Post('seasons/:id/committees')
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommitteeDto) {
    return this.committees.create(id, dto);
  }

  @Post('seasons/:id/committees/copy')
  copy(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CopyCommitteeDto) {
    return this.committees.copy(id, dto.committeeId, dto.name);
  }

  @Patch('committees/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommitteeDto,
  ) {
    return this.committees.update(id, dto);
  }

  @Delete('committees/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.committees.remove(id);
  }

  @Post('committees/:id/move')
  @HttpCode(200)
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDto) {
    return this.committees.move(id, dto.direction);
  }
}
