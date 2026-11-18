import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { contactMessages } from '../db/schema';
import { CreateContactDto } from './contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async create(dto: CreateContactDto) {
    const [record] = await this.db
      .insert(contactMessages)
      .values(dto)
      .returning();
    this.logger.log(`New contact message from ${record.email}`);
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
