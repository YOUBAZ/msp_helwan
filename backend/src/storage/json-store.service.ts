import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type Record_ = { id: string; createdAt: string };

/**
 * Tiny file-backed store: one JSON file per collection inside DATA_DIR.
 * Writes are serialized and atomic (write temp file, then rename), which is
 * plenty for a club website's contact form and newsletter volume. Swap this
 * service for a real database (Postgres, Mongo, Firestore...) when needed.
 */
@Injectable()
export class JsonStoreService implements OnModuleInit {
  private readonly dir: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(config: ConfigService) {
    this.dir = resolve(config.get<string>('DATA_DIR') ?? 'data');
  }

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
  }

  private file(collection: string) {
    return join(this.dir, `${collection}.json`);
  }

  async list<T extends Record_>(collection: string): Promise<T[]> {
    try {
      return JSON.parse(await readFile(this.file(collection), 'utf8')) as T[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  private save<T>(collection: string, items: T[]) {
    const target = this.file(collection);
    const tmp = `${target}.${process.pid}.tmp`;
    return writeFile(tmp, JSON.stringify(items, null, 2)).then(() =>
      rename(tmp, target),
    );
  }

  /** Run a read-modify-write on a collection, serialized with all other writes. */
  private mutate<T extends Record_, R>(
    collection: string,
    fn: (items: T[]) => { items: T[]; result: R },
  ): Promise<R> {
    const run = this.queue.then(async () => {
      const { items, result } = fn(await this.list<T>(collection));
      await this.save(collection, items);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  insert<T extends Record_>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt'>,
    isDuplicate?: (existing: T) => boolean,
  ): Promise<{ record: T; created: boolean }> {
    return this.mutate<T, { record: T; created: boolean }>(
      collection,
      (items) => {
        const dup = isDuplicate ? items.find(isDuplicate) : undefined;
        if (dup) return { items, result: { record: dup, created: false } };
        const record = {
          ...data,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        } as T;
        return { items: [...items, record], result: { record, created: true } };
      },
    );
  }

  remove(collection: string, id: string): Promise<boolean> {
    return this.mutate<Record_, boolean>(collection, (items) => {
      const next = items.filter((i) => i.id !== id);
      return { items: next, result: next.length !== items.length };
    });
  }
}
