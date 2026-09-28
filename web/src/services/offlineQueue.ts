import { openDB, IDBPDatabase } from 'idb';
import { SyncItem } from '../types';

const DB_NAME = 'my_wallet_offline_db';
const STORE_NAME = 'sync_queue';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export class OfflineQueue {
  public static async enqueue(type: 'INVOICE' | 'EXPENSE' | 'PAYMENT', payload: any): Promise<SyncItem> {
    const db = await getDB();
    const item: SyncItem = {
      id: `sync_${crypto.randomUUID().slice(0, 8)}`,
      type,
      payload,
      status: 'PENDING_SYNC',
      createdAt: Date.now(),
    };
    await db.put(STORE_NAME, item);
    return item;
  }

  public static async getPending(): Promise<SyncItem[]> {
    const db = await getDB();
    const all: SyncItem[] = await db.getAll(STORE_NAME);
    return all.filter((i) => i.status === 'PENDING_SYNC' || i.status === 'FAILED');
  }

  public static async updateStatus(id: string, status: 'SYNCED' | 'FAILED', errorMessage?: string): Promise<void> {
    const db = await getDB();
    const item: SyncItem = await db.get(STORE_NAME, id);
    if (item) {
      item.status = status;
      if (errorMessage) item.errorMessage = errorMessage;
      if (status === 'SYNCED') {
        await db.delete(STORE_NAME, id);
      } else {
        await db.put(STORE_NAME, item);
      }
    }
  }

  public static async getCount(): Promise<number> {
    const pending = await this.getPending();
    return pending.length;
  }
}
