import { Module } from '@nestjs/common';
import { PublicCommitteesController } from './committees.controller';
import { CommitteesService } from './committees.service';

@Module({
  controllers: [PublicCommitteesController],
  providers: [CommitteesService],
})
export class CommitteesModule {}
