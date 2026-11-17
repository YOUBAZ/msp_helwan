import { Injectable, Logger } from '@nestjs/common';
import { Record_, JsonStoreService } from '../storage/json-store.service';
import { CreateContactDto } from './contact.dto';

export type ContactMessage = Record_ & CreateContactDto;
export const MESSAGES = 'messages';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly store: JsonStoreService) {}

  async create(dto: CreateContactDto) {
    const { record } = await this.store.insert<ContactMessage>(MESSAGES, dto);
    this.logger.log(`New contact message from ${record.email}`);
    return record;
  }

  async findAll() {
    const items = await this.store.list<ContactMessage>(MESSAGES);
    return items.reverse();
  }

  remove(id: string) {
    return this.store.remove(MESSAGES, id);
  }
}
