import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateContactDto } from './contact.dto';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async create(@Body() dto: CreateContactDto) {
    await this.contact.create(dto);
    return {
      message:
        "Thanks! Your message has been sent. We'll get back to you soon.",
    };
  }
}
