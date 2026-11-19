import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import {
  AdminEventsController,
  PublicEventsController,
  TicketsController,
} from './events.controller';
import { EventsService } from './events.service';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [MediaModule],
  controllers: [
    PublicEventsController,
    TicketsController,
    AdminEventsController,
  ],
  providers: [EventsService, RegistrationsService],
})
export class EventsModule {}
