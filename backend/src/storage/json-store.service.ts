import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DataStore, newRecord, Record_ } from './data-store';

/**
 * File-backed store for local development: one JSON file per collection in
 * `dir`. Writes are serialized and atomic (temp file + rename).
 * Not suitable for serverless hosts (their disk is temporary).
 */
export class JsonStoreService extends DataStore {
  private readonly dir: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    super();
    this.dir = resolve(dir);
  }

  private file(collection: string) {
    return join(this.dir, `${collection}.json`);
  }

  private async read<T>(collection: string): Promise<T[]> {
    try {
      return JSON.parse(await readFile(this.file(collection), 'utf8')) as T[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  private async save<T>(collection: string, items: T[]) {
    await mkdir(this.dir, { recursive: true });
    const target = this.file(collection);
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(items, null, 2));
    await rename(tmp, target);
  }

  /** Read-modify-write, serialized with all other writes. */
  private mutate<T, R>(
    collection: string,
    fn: (items: T[]) => { items: T[]; result: R },
  ): Promise<R> {
    const run = this.queue.then(async () => {
      const { items, result } = fn(await this.read<T>(collection));
      await this.save(collection, items);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async list<T extends Record_>(collection: string): Promise<T[]> {
    return (await this.read<T>(collection)).reverse();
  }

  insert<T extends Record_>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt'>,
    uniqueField?: keyof Omit<T, 'id' | 'createdAt'> & string,
  ): Promise<{ record: T; created: boolean }> {
    return this.mutate<T, { record: T; created: boolean }>(
      collection,
      (items) => {
        const dup =
          uniqueField &&
          items.find(
            (i) =>
              (i as Record<string, unknown>)[uniqueField] ===
              (data as Record<string, unknown>)[uniqueField],
          );
        if (dup) return { items, result: { record: dup, created: false } };
        const record = newRecord<T>(data, randomUUID());
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
