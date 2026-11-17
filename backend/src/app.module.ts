import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ContactModule } from './contact/contact.module';
import { HealthController } from './health/health.controller';
import { NewsletterModule } from './newsletter/newsletter.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Basic abuse protection for the public forms: 20 requests / minute / IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    StorageModule,
    ContactModule,
    NewsletterModule,
    AuthModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
