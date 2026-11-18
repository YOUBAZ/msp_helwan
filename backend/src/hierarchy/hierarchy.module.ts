import { Module } from '@nestjs/common';
import {
  AdminHierarchyController,
  PublicPeopleController,
  PublicSeasonsController,
} from './hierarchy.controller';
import { HierarchyService } from './hierarchy.service';

@Module({
  controllers: [
    PublicSeasonsController,
    PublicPeopleController,
    AdminHierarchyController,
  ],
  providers: [HierarchyService],
})
export class HierarchyModule {}
