import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { CommitteesService } from './committees.service';

/** Public: the Committees page. */
@Controller('committees')
export class PublicCommitteesController {
  constructor(private readonly committees: CommitteesService) {}

  @Get()
  view(@Query('season', new ParseIntPipe({ optional: true })) season?: number) {
    return this.committees.publicView(season);
  }
}
