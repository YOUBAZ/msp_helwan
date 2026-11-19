import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import {
  AdminEventsController,
  PublicEventsController,
} from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [MediaModule],
  controllers: [PublicEventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
