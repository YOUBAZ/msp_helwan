export type Record_ = { id: string; createdAt: string };

/**
 * Storage used by the contact and newsletter features.
 * - MongoStoreService when MONGODB_URI is set (production / Vercel)
 * - JsonStoreService otherwise (local development, writes to ./data)
 */
export abstract class DataStore {
  /** All records of a collection, newest first. */
  abstract list<T extends Record_>(collection: string): Promise<T[]>;

  /**
   * Insert a record. If `uniqueField` is given and a record with the same
   * value already exists, that record is returned with `created: false`.
   */
  abstract insert<T extends Record_>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt'>,
    uniqueField?: keyof Omit<T, 'id' | 'createdAt'> & string,
  ): Promise<{ record: T; created: boolean }>;

  /** Delete by id. Returns false if nothing was deleted. */
  abstract remove(collection: string, id: string): Promise<boolean>;
}

export function newRecord<T extends Record_>(
  data: Omit<T, 'id' | 'createdAt'>,
  id: string,
): T {
  return { ...data, id, createdAt: new Date().toISOString() } as T;
}
