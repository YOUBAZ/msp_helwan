import { OnApplicationShutdown } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { DataStore, newRecord, Record_ } from './data-store';

/**
 * MongoDB-backed store (e.g. a free MongoDB Atlas cluster). Each collection
 * name maps to a Mongo collection. Records keep their own string `id`; Mongo's
 * internal `_id` is never exposed. The connection is opened lazily and reused,
 * which suits serverless hosts like Vercel.
 */
export class MongoStoreService
  extends DataStore
  implements OnApplicationShutdown
{
  private readonly client: MongoClient;
  private db?: Promise<Db>;

  constructor(
    uri: string,
    private readonly dbName = 'msp_helwan',
  ) {
    super();
    this.client = new MongoClient(uri, { maxPoolSize: 5 });
  }

  private getDb(): Promise<Db> {
    this.db ??= this.client.connect().then(async (c) => {
      const db = c.db(this.dbName);
      await Promise.all([
        db
          .collection('subscribers')
          .createIndex({ email: 1 }, { unique: true }),
        db.collection('subscribers').createIndex({ id: 1 }, { unique: true }),
        db.collection('messages').createIndex({ id: 1 }, { unique: true }),
      ]);
      return db;
    });
    this.db.catch(() => (this.db = undefined)); // retry on next call
    return this.db;
  }

  async list<T extends Record_>(collection: string): Promise<T[]> {
    const db = await this.getDb();
    return db
      .collection(collection)
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray() as unknown as Promise<T[]>;
  }

  async insert<T extends Record_>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt'>,
    uniqueField?: keyof Omit<T, 'id' | 'createdAt'> & string,
  ): Promise<{ record: T; created: boolean }> {
    const col = (await this.getDb()).collection(collection);
    const record = newRecord<T>(data, randomUUID());
    if (!uniqueField) {
      await col.insertOne({ ...record });
      return { record, created: true };
    }
    // Atomic "insert if missing".
    const value = (data as Record<string, unknown>)[uniqueField];
    const before = await col.findOneAndUpdate(
      { [uniqueField]: value },
      { $setOnInsert: { ...record } },
      { upsert: true, returnDocument: 'before', projection: { _id: 0 } },
    );
    return before
      ? { record: before as unknown as T, created: false }
      : { record, created: true };
  }

  async remove(collection: string, id: string): Promise<boolean> {
    const res = await (
      await this.getDb()
    )
      .collection(collection)
      .deleteOne({ id });
    return res.deletedCount === 1;
  }

  async onApplicationShutdown() {
    await this.client.close();
  }
}
