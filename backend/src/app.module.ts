import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module';
import { ContactModule } from './contact/contact.module';
import { DbModule } from './db/db.module';
import { CommitteesModule } from './committees/committees.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health/health.controller';
import { HierarchyModule } from './hierarchy/hierarchy.module';
import { InboxModule } from './inbox/inbox.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { NewsletterModule } from './newsletter/newsletter.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default: 120 requests/minute/IP. Public forms and login set stricter limits.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    DbModule,
    MailModule,
    AccessModule,
    ContactModule,
    NewsletterModule,
    InboxModule,
    HierarchyModule,
    MediaModule,
    EventsModule,
    CommitteesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
