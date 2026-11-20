import { Module } from '@nestjs/common';
import {
  AdminCommitteesController,
  PublicCommitteesController,
} from './committees.controller';
import { CommitteesService } from './committees.service';

@Module({
  controllers: [PublicCommitteesController, AdminCommitteesController],
  providers: [CommitteesService],
})
export class CommitteesModule {}
