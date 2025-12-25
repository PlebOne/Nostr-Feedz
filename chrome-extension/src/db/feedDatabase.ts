import type { Feed, FeedItem } from '../types';

const DB_NAME = 'nostr-feedz-cache';
const DB_VERSION = 1;

interface CachedItem extends FeedItem {
  cachedAt: number;
}

class FeedDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('feeds')) {
          db.createObjectStore('feeds', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('publishedAt', 'publishedAt', { unique: false });
          itemStore.createIndex('isRead', 'isRead', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  async getFeeds(): Promise<Feed[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('feeds', 'readonly');
      const store = tx.objectStore('feeds');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveFeeds(feeds: Feed[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction('feeds', 'readwrite');
    const store = tx.objectStore('feeds');
    store.clear();
    feeds.forEach((feed) => store.put(feed));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getItems(options: { limit?: number; unreadOnly?: boolean } = {}): Promise<FeedItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('items', 'readonly');
      const store = tx.objectStore('items');
      const index = store.index('publishedAt');
      const items: CachedItem[] = [];
      const limit = options.limit ?? 100;

      const request = index.openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && items.length < limit) {
          const item = cursor.value as CachedItem;
          if (!options.unreadOnly || !item.isRead) {
            items.push(item);
          }
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveItems(items: FeedItem[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    const now = Date.now();
    items.forEach((item) => store.put({ ...item, cachedAt: now }));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async markItemRead(itemId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('items', 'readwrite');
      const store = tx.objectStore('items');
      const request = store.get(itemId);
      request.onsuccess = () => {
        if (request.result) {
          store.put({ ...request.result, isRead: true });
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldItems(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.init();
    const cutoff = Date.now() - maxAgeMs;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('items', 'readwrite');
      const store = tx.objectStore('items');
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const item = cursor.value as CachedItem;
          if (item.cachedAt < cutoff && item.isRead) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const feedDatabase = new FeedDatabase();
