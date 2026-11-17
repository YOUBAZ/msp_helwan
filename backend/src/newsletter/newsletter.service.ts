import { Injectable } from '@nestjs/common';
import { Record_, JsonStoreService } from '../storage/json-store.service';

export type Subscriber = Record_ & { email: string };
export const SUBSCRIBERS = 'subscribers';

@Injectable()
export class NewsletterService {
  constructor(private readonly store: JsonStoreService) {}

  subscribe(email: string) {
    return this.store.insert<Subscriber>(
      SUBSCRIBERS,
      { email },
      (s) => s.email === email,
    );
  }

  async findAll() {
    return (await this.store.list<Subscriber>(SUBSCRIBERS)).reverse();
  }

  remove(id: string) {
    return this.store.remove(SUBSCRIBERS, id);
  }
}
