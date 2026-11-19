import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { RegistrationsService } from './registrations.service';

/**
 * Called by Vercel Cron (see vercel.json). Vercel sends
 * "Authorization: Bearer <CRON_SECRET>" automatically.
 */
@Controller('cron')
@SkipThrottle()
export class RemindersController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('event-reminders')
  reminders(@Headers('authorization') auth?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    const expected = Buffer.from(`Bearer ${secret ?? ''}`);
    const given = Buffer.from(auth ?? '');
    if (
      !secret ||
      given.length !== expected.length ||
      !timingSafeEqual(given, expected)
    ) {
      throw new UnauthorizedException();
    }
    return this.registrations.sendReminders();
  }
}
