import { Module } from '@nestjs/common';
import { ContactModule } from '../contact/contact.module';
import { NewsletterModule } from '../newsletter/newsletter.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [ContactModule, NewsletterModule],
  controllers: [AdminController],
})
export class AdminModule {}
