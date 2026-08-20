/**
 * TAXIControl - IndexedDB Offline Queue System for 'Nova Corrida' Requests
 * Captures ride requests when offline and automatically synchronizes with Firestore upon connection restoration.
 */

import { collection, addDoc, Firestore } from 'firebase/firestore';

export interface OfflineRideRequest {
  id?: number;
  tempId: string;
  data: any;
  queuedAt: string;
  status: 'pending_sync' | 'syncing' | 'failed';
  attempts: number;
}

const DB_NAME = 'SuperTaxiOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_ride_requests';

// Initialize and get IndexedDB database instance
export const openOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('tempId', 'tempId', { unique: true });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      console.error('[IndexedDB] Database open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

/**
 * Save a 'Nova Corrida' request into local IndexedDB queue
 */
export const saveOfflineRideRequest = async (rideData: any): Promise<string> => {
  const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const record: OfflineRideRequest = {
    tempId,
    data: {
      ...rideData,
      isOfflineCreated: true,
      offlineTempId: tempId,
      createdAt: rideData.createdAt || new Date().toISOString()
    },
    queuedAt: new Date().toISOString(),
    status: 'pending_sync',
    attempts: 0
  };

  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(record);

      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });

    console.log(`[IndexedDB Queue] Nova corrida guardada em fila local (ID: ${tempId}):`, record);

    // Notify UI via Custom Event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-ride-queued', { detail: { tempId, record } }));
    }

    return tempId;
  } catch (error) {
    console.error('[IndexedDB Queue] Failed to save offline ride request:', error);
    // Fallback to localStorage if IndexedDB fails
    try {
      const existing = localStorage.getItem('fallback_offline_rides');
      const list = existing ? JSON.parse(existing) : [];
      list.push(record);
      localStorage.setItem('fallback_offline_rides', JSON.stringify(list));
    } catch (e) {
      console.error('[Fallback Storage] Failed to write fallback ride:', e);
    }
    return tempId;
  }
};

/**
 * Retrieve all pending offline ride requests from IndexedDB
 */
export const getOfflineRideRequests = async (): Promise<OfflineRideRequest[]> => {
  try {
    const db = await openOfflineDB();
    return await new Promise<OfflineRideRequest[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch (error) {
    console.warn('[IndexedDB Queue] Error reading offline requests:', error);
    try {
      const existing = localStorage.getItem('fallback_offline_rides');
      return existing ? JSON.parse(existing) : [];
    } catch {
      return [];
    }
  }
};

/**
 * Delete a processed offline ride request from IndexedDB
 */
export const removeOfflineRideRequest = async (id: number): Promise<void> => {
  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch (error) {
    console.error('[IndexedDB Queue] Error deleting item:', error);
  }
};

/**
 * Synchronize all offline ride requests stored in IndexedDB with Firestore
 */
export const syncOfflineRideRequests = async (firestoreInstance: Firestore): Promise<number> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[IndexedDB Sync] Dispositivo ainda sem sinal de internet. Sincronização adiada.');
    return 0;
  }

  const items = await getOfflineRideRequests();
  if (!items || items.length === 0) {
    return 0;
  }

  console.log(`[IndexedDB Sync] 🔄 Sinal recuperado! Sincronizando ${items.length} solicitações de 'Nova Corrida' pendentes...`);
  let syncedCount = 0;

  for (const item of items) {
    try {
      // Add document to Firestore 'calls' collection
      const docRef = await addDoc(collection(firestoreInstance, 'calls'), {
        ...item.data,
        syncedFromOfflineQueueAt: new Date().toISOString(),
        offlineSynced: true
      });

      console.log(`[IndexedDB Sync] ✅ Corrida offline sincronizada com sucesso no Firestore (ID doc: ${docRef.id}, tempId: ${item.tempId})`);

      // Delete from IndexedDB if synced successfully
      if (item.id !== undefined) {
        await removeOfflineRideRequest(item.id);
      }
      syncedCount++;
    } catch (err) {
      console.error(`[IndexedDB Sync] ❌ Erro ao sincronizar corrida ${item.tempId}:`, err);
    }
  }

  // Also clean up fallback localStorage if any
  try {
    const fallback = localStorage.getItem('fallback_offline_rides');
    if (fallback) {
      const list: OfflineRideRequest[] = JSON.parse(fallback);
      for (const item of list) {
        try {
          await addDoc(collection(firestoreInstance, 'calls'), {
            ...item.data,
            syncedFromOfflineQueueAt: new Date().toISOString(),
            offlineSynced: true
          });
          syncedCount++;
        } catch (e) {
          console.error('[Fallback Sync Error]', e);
        }
      }
      localStorage.removeItem('fallback_offline_rides');
    }
  } catch (err) {
    console.warn('[Fallback Cleanup Error]', err);
  }

  if (syncedCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-rides-synced', { detail: { count: syncedCount } }));
  }

  return syncedCount;
};

/**
 * Setup automatic listener that triggers sync whenever internet connection is restored
 */
export const setupAutomaticOfflineSync = (firestoreInstance: Firestore) => {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    console.log('[Network Monitor] 🌐 Sinal de internet detetado! Executando sincronização de fila local...');
    syncOfflineRideRequests(firestoreInstance).catch(err => {
      console.warn('[Automatic Sync Error]', err);
    });
  };

  window.addEventListener('online', handleOnline);

  // Initial attempt if online right now
  if (navigator.onLine) {
    setTimeout(() => {
      syncOfflineRideRequests(firestoreInstance).catch(() => {});
    }, 2000);
  }

  // Periodic fallback check every 30 seconds
  const intervalId = setInterval(() => {
    if (navigator.onLine) {
      syncOfflineRideRequests(firestoreInstance).catch(() => {});
    }
  }, 30000);

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(intervalId);
  };
};
