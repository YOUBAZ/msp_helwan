import { Injectable } from '@nestjs/common';
import { DataStore, Record_ } from '../storage/data-store';

export type Subscriber = Record_ & { email: string };
export const SUBSCRIBERS = 'subscribers';

@Injectable()
export class NewsletterService {
  constructor(private readonly store: DataStore) {}

  subscribe(email: string) {
    return this.store.insert<Subscriber>(SUBSCRIBERS, { email }, 'email');
  }

  async findAll() {
    return this.store.list<Subscriber>(SUBSCRIBERS);
  }

  remove(id: string) {
    return this.store.remove(SUBSCRIBERS, id);
  }
}
