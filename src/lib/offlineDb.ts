// IndexedDB Offline Cache Helper for Maintenance & Ride History (JIS Angola / SUPER Táxi)

const DB_NAME = 'super_taxi_offline_db';
const DB_VERSION = 1;

export const STORE_MAINTENANCE = 'maintenance_cache';
export const STORE_RIDE_HISTORY = 'ride_history_cache';

export function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_MAINTENANCE)) {
        db.createObjectStore(STORE_MAINTENANCE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RIDE_HISTORY)) {
        db.createObjectStore(STORE_RIDE_HISTORY, { keyPath: 'id' });
      }
    };
  });
}

export async function saveToIndexedDB(storeName: string, items: any[]): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const item of items) {
      if (item && item.id) {
        store.put(item);
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`IndexedDB save error (${storeName}):`, err);
  }
}

export async function getFromIndexedDB(storeName: string): Promise<any[]> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`IndexedDB read error (${storeName}):`, err);
    return [];
  }
}
