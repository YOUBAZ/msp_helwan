import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Auth } from '../access/auth.guard';
import { ContactService } from '../contact/contact.service';
import { NewsletterService } from '../newsletter/newsletter.service';

/** Board-only views of contact messages and newsletter subscribers. */
@Controller('admin')
export class InboxController {
  constructor(
    private readonly contact: ContactService,
    private readonly newsletter: NewsletterService,
  ) {}

  @Get('messages')
  @Auth('messages.view')
  messages() {
    return this.contact.findAll();
  }

  @Delete('messages/:id')
  @HttpCode(204)
  @Auth('messages.delete')
  async deleteMessage(@Param('id', ParseUUIDPipe) id: string) {
    if (!(await this.contact.remove(id))) throw new NotFoundException();
  }

  @Get('subscribers')
  @Auth('subscribers.view')
  subscribers() {
    return this.newsletter.findAll();
  }

  @Delete('subscribers/:id')
  @HttpCode(204)
  @Auth('subscribers.delete')
  async deleteSubscriber(@Param('id', ParseUUIDPipe) id: string) {
    if (!(await this.newsletter.remove(id))) throw new NotFoundException();
  }
}
