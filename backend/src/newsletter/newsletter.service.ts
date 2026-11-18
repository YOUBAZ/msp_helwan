import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { subscribers } from '../db/schema';

@Injectable()
export class NewsletterService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Returns true if this email was newly added. */
  async subscribe(email: string) {
    const r = await this.db
      .insert(subscribers)
      .values({ email })
      .onConflictDoNothing()
      .returning({ id: subscribers.id });
    return r.length > 0;
  }

  findAll() {
    return this.db
      .select()
      .from(subscribers)
      .orderBy(desc(subscribers.createdAt));
  }

  async remove(id: string) {
    const r = await this.db
      .delete(subscribers)
      .where(eq(subscribers.id, id))
      .returning({ id: subscribers.id });
    return r.length > 0;
  }
}
