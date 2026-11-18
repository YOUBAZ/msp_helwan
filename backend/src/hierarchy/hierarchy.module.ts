import { Module } from '@nestjs/common';
import {
  AdminHierarchyController,
  PublicSeasonsController,
} from './hierarchy.controller';
import { HierarchyService } from './hierarchy.service';

@Module({
  controllers: [PublicSeasonsController, AdminHierarchyController],
  providers: [HierarchyService],
})
export class HierarchyModule {}
