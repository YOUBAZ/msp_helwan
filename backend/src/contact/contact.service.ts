import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { contactMessages } from '../db/schema';
import { MailService } from '../mail/mail.service';
import { contactNotificationEmail } from '../mail/templates';
import { CreateContactDto } from './contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  private readonly dashboardUrl: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    const site = (
      config.get<string>('FRONTEND_URL') ??
      (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3001').split(
        ',',
      )[0]
    )
      .trim()
      .replace(/\/+$/, '');
    this.dashboardUrl = `${site}/dashboard/inbox`;
  }

  async create(dto: CreateContactDto) {
    const [record] = await this.db
      .insert(contactMessages)
      .values(dto)
      .returning();
    this.logger.log(`New contact message from ${record.email}`);
    // The message is already saved; a failed notification is only logged.
    if (this.mail.notifyTo) {
      await this.mail.send(
        contactNotificationEmail({
          to: this.mail.notifyTo,
          ...dto,
          dashboardUrl: this.dashboardUrl,
        }),
      );
    }
    return record;
  }

  findAll() {
    return this.db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt));
  }

  async remove(id: string) {
    const r = await this.db
      .delete(contactMessages)
      .where(eq(contactMessages.id, id))
      .returning({ id: contactMessages.id });
    return r.length > 0;
  }
}
