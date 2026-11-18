import { Module } from '@nestjs/common';
import { ContactModule } from '../contact/contact.module';
import { NewsletterModule } from '../newsletter/newsletter.module';
import { InboxController } from './inbox.controller';

@Module({
  imports: [ContactModule, NewsletterModule],
  controllers: [InboxController],
})
export class InboxModule {}
