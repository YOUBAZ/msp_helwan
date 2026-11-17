import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactService } from '../contact/contact.service';
import { NewsletterService } from '../newsletter/newsletter.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly contact: ContactService,
    private readonly newsletter: NewsletterService,
  ) {}

  @Get('messages')
  messages() {
    return this.contact.findAll();
  }

  @Delete('messages/:id')
  @HttpCode(204)
  async deleteMessage(@Param('id', ParseUUIDPipe) id: string) {
    if (!(await this.contact.remove(id))) throw new NotFoundException();
  }

  @Get('subscribers')
  subscribers() {
    return this.newsletter.findAll();
  }

  @Delete('subscribers/:id')
  @HttpCode(204)
  async deleteSubscriber(@Param('id', ParseUUIDPipe) id: string) {
    if (!(await this.newsletter.remove(id))) throw new NotFoundException();
  }
}
