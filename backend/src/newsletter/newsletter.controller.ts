import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscribeDto } from './newsletter.dto';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async subscribe(@Body() dto: SubscribeDto) {
    const created = await this.newsletter.subscribe(dto.email);
    return {
      message: created
        ? 'Thanks for subscribing! We will share club news with you.'
        : "You're already subscribed.",
    };
  }
}
