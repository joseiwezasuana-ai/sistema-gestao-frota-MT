import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import 'firebase/auth'; // Force registration
import { 
  getFirestore,
  initializeFirestore, 
  collection as originalCollection,
  doc as originalDoc,
  CollectionReference,
  DocumentReference,
  DocumentData,
  addDoc as originalAddDoc,
  setDoc as originalSetDoc,
  updateDoc as originalUpdateDoc,
  deleteDoc as originalDeleteDoc,
  onSnapshot as originalOnSnapshot,
  getDocFromServer,
  getDocs
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Export everything from firebase/firestore so our file acts as a drop-in replacement
export * from 'firebase/firestore';
export { originalCollection, originalDoc };

// Ensure app is only initialized once
let app: any;
let analytics: any;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  
  // Analytics is only supported in some environments
  /*
  isSupported().then(yes => {
    if (yes) analytics = getAnalytics(app);
  });
  */

  console.log("[Firebase] App initialized successfully with project:", firebaseConfig.projectId);
} catch (e: any) {
  const msg = `ERRO_FIREBASE: ${e.message}`;
  console.error("[Firebase] App initialization failed", e);
  (window as any)._firebaseConfigError = msg;
  app = getApps().length > 0 ? getApps()[0] : null;
}

// Initialize services with guards
export const auth = app ? getAuth(app) : { onAuthStateChanged: () => () => {}, currentUser: null } as any;

// Handle (default) or named database correctly
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "" && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? firebaseConfig.firestoreDatabaseId 
  : undefined; 

export const db = app ? initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true
}, databaseId) : { collection: () => ({}), doc: () => ({}) } as any;

// --- MULTI-TENANT CONFIGURATION AND WRAPPERS ---
let activeTenantId: string | null = null;
const GLOBAL_COLLECTIONS = [
  'users',
  'admins',
  'tenants',
  'settings',
  'taxi_requests',
  'passengers',
  'passenger_profiles',
  'passenger_ratings',
  'system_backups',
  'system_error_logs',
  'calls',
  'complaints',
  'fcm_tokens',
  'notifications',
  'company_phones'
];

export function getActiveTenantId(): string {
  if (activeTenantId && activeTenantId !== "" && activeTenantId !== "null" && activeTenantId !== "undefined") {
    return activeTenantId;
  }
  const saved = localStorage.getItem('active_tenant_id');
  if (saved && saved !== "" && saved !== "null" && saved !== "undefined") {
    activeTenantId = saved;
    return saved;
  }
  return 'psm'; // Default to psm (PSMoreira Comercial,(SU) Lda)
}

export function setActiveTenantId(tenantId: string | null) {
  if (tenantId && tenantId !== "" && tenantId !== "null" && tenantId !== "undefined") {
    activeTenantId = tenantId;
    localStorage.setItem('active_tenant_id', tenantId);
  } else {
    activeTenantId = 'psm';
    localStorage.setItem('active_tenant_id', 'psm');
  }
}

// Wrapped collection function that scopes requests to tenants/{tenantId}/[collection]
export function collection(firestoreOrRef: any, path: string, ...pathSegments: string[]): CollectionReference<DocumentData, DocumentData> {
  if (!firestoreOrRef) return null as any;
  
  // Checking if it's a DocumentReference (e.g., getting a subcollection off a document)
  if (firestoreOrRef.type === 'document') {
    return originalCollection(firestoreOrRef, path, ...pathSegments) as any;
  }

  // Bypass for global system collections
  if (GLOBAL_COLLECTIONS.includes(path)) {
    return originalCollection(firestoreOrRef, path, ...pathSegments) as any;
  }

  // Scoped to tenant
  const tenantId = getActiveTenantId();
  return originalCollection(firestoreOrRef, 'tenants', tenantId, path, ...pathSegments) as any;
}

// Wrapped doc function that scopes requests to tenants/{tenantId}/[collection]/[docId]
export function doc(firestoreOrRef: any, path?: string, ...pathSegments: string[]): DocumentReference<DocumentData, DocumentData> {
  if (!firestoreOrRef) return null as any;

  // Called as doc(collectionRef, "docId")
  if (firestoreOrRef.type === 'collection') {
    if (path) {
      return originalDoc(firestoreOrRef, path, ...pathSegments) as any;
    }
    return originalDoc(firestoreOrRef) as any;
  }

  // Called as doc(db, "collection", "docId")
  if (path) {
    if (GLOBAL_COLLECTIONS.includes(path)) {
      return originalDoc(firestoreOrRef, path, ...pathSegments) as any;
    }
    const tenantId = getActiveTenantId();
    return originalDoc(firestoreOrRef, 'tenants', tenantId, path, ...pathSegments) as any;
  }

  return originalDoc(firestoreOrRef) as any;
}

// Wrapped onSnapshot to catch transient connection/offline errors gracefully
export function onSnapshot(...args: any[]): () => void {
  let ref = args[0];
  let onNext: any;
  let onError: any;
  let onCompletion: any;

  if (typeof args[1] === 'function') {
    onNext = args[1];
    onError = args[2];
    onCompletion = args[3];
  } else if (typeof args[1] === 'object' && args[1] !== null && typeof args[2] === 'function') {
    onNext = args[2];
    onError = args[3];
    onCompletion = args[4];
  } else {
    return (originalOnSnapshot as any)(...args);
  }

  const safeOnError = (error: any) => {
    if (error?.code === 'unavailable' || error?.message?.includes('Could not reach Cloud Firestore backend') || error?.message?.includes('offline')) {
      console.warn('[Firestore Offline / LongPolling Reconnecting]', error?.message || error);
    } else {
      console.error('[Firestore Snapshot Error]', error);
    }
    if (typeof onError === 'function') {
      try {
        onError(error);
      } catch (err) {
        console.warn('Error in snapshot onError callback:', err);
      }
    }
  };

  if (typeof args[1] === 'function') {
    return originalOnSnapshot(ref, onNext, safeOnError, onCompletion);
  } else {
    return originalOnSnapshot(ref, args[1], onNext, safeOnError, onCompletion);
  }
}

// Test initial connection to Cloud Firestore
async function testConnection() {
  try {
    if (app && db) {
      await withTimeout(getDocFromServer(originalDoc(db, 'settings', 'global')), 4000);
    }
  } catch (error: any) {
    if (error?.message?.includes('offline') || error?.message?.includes('unavailable') || error?.code === 'unavailable' || error?.message?.includes('ERRO_TIMEOUT')) {
      console.warn("[Firebase] Client operating in offline cache mode until Cloud Firestore backend is reached.");
    }
  }
}
testConnection();
// -----------------------------------------------


// Diagnostic helper to detect hangs
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 15000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("ERRO_TIMEOUT: A base de dados não respondeu a tempo. Verifique se o Cloud Firestore está ativo no Console Firebase."));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ 
  prompt: 'select_account',
  hl: 'pt-PT'
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || '',
      email: auth.currentUser?.email || '',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || '',
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoURL: provider.photoURL || ''
      })) || []
    }
  };
  console.error('Firestore Error Details:', errInfo);
  // Don't stringify nested info in the throw message to avoid double escaping issues
  throw new Error(`Firebase Error [${operationType}] at ${path}: ${errInfo.error}`);
}

// --- OFFLINE SYNC QUEUE SYSTEM ---

export interface SyncAction {
  id: string;
  type: 'add' | 'set' | 'update' | 'delete';
  path: string;
  data?: any;
  options?: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
  collectionName: string;
}

export function getSyncQueue(): SyncAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('psm-sync-queue');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function saveSyncQueue(queue: SyncAction[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('psm-sync-queue', JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('psm-sync-queue-changed'));
  } catch (e) {
    console.error("Failed to save sync queue:", e);
  }
}

let isSyncing = false;

export async function processSyncQueue() {
  if (isSyncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const queue = getSyncQueue();
  const pending = queue.filter(a => a.status === 'pending' || a.status === 'failed');
  if (pending.length === 0) return;

  isSyncing = true;
  console.log(`[Sync Queue] Iniciando sincronização de ${pending.length} ações pendentes...`);

  const updatedQueue = [...queue];

  for (const action of pending) {
    const idx = updatedQueue.findIndex(a => a.id === action.id);
    if (idx === -1) continue;

    updatedQueue[idx].status = 'syncing';
    saveSyncQueue(updatedQueue);

    try {
      if (action.type === 'add') {
        const collRef = originalCollection(db, action.path);
        await originalAddDoc(collRef, action.data);
      } else if (action.type === 'set') {
        const docRef = originalDoc(db, action.path);
        await originalSetDoc(docRef, action.data, action.options);
      } else if (action.type === 'update') {
        const docRef = originalDoc(db, action.path);
        await originalUpdateDoc(docRef, action.data);
      } else if (action.type === 'delete') {
        const docRef = originalDoc(db, action.path);
        await originalDeleteDoc(docRef);
      }

      // Succeeded! Remove from queue.
      const currentQueue = getSyncQueue();
      const newQueue = currentQueue.filter(a => a.id !== action.id);
      saveSyncQueue(newQueue);
      console.log(`[Sync Queue] Ação ${action.id} sincronizada com sucesso.`);
    } catch (err: any) {
      console.error(`[Sync Queue] Falha ao sincronizar ação ${action.id}:`, err);
      
      const currentQueue = getSyncQueue();
      const currentIdx = currentQueue.findIndex(a => a.id === action.id);
      if (currentIdx !== -1) {
        const isPermissionDenied = err?.message?.includes("PERMISSION_DENIED") || 
                                   err?.code === "permission-denied" || 
                                   String(err).includes("permission");
        
        if (isPermissionDenied) {
          // Erro de permissão permanente - marcar como falhado e continuar para não travar a fila
          currentQueue[currentIdx].status = 'failed';
          currentQueue[currentIdx].error = "Erro de Permissão/Validação no servidor";
          saveSyncQueue(currentQueue);
        } else {
          // Erro de rede ou temporário - manter pendente e pausar processamento da fila
          currentQueue[currentIdx].status = 'failed';
          currentQueue[currentIdx].error = err?.message || String(err);
          saveSyncQueue(currentQueue);
          break; // Para a fila pois provavelmente ainda estamos com instabilidade de rede
        }
      }
    }
  }

  isSyncing = false;
}

export function useSyncQueue() {
  const [queue, setQueue] = useState<SyncAction[]>(getSyncQueue);
  const [isOnlineState, setIsOnlineState] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleChanged = () => {
      setQueue(getSyncQueue());
    };
    const handleOnline = () => {
      setIsOnlineState(true);
      processSyncQueue();
    };
    const handleOffline = () => {
      setIsOnlineState(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('psm-sync-queue-changed', handleChanged);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('psm-sync-queue-changed', handleChanged);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  return { 
    queue, 
    isOnline: isOnlineState, 
    syncNow: processSyncQueue,
    clearQueue: () => saveSyncQueue([])
  };
}

// Interceptadores de Escrita para Fila Offline

export async function addDoc(reference: any, data: any) {
  const path = reference.path;
  const collectionName = path.split('/').pop() || 'unknown';

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const actionId = `add_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const queue = getSyncQueue();
    queue.push({
      id: actionId,
      type: 'add',
      path,
      data,
      timestamp: Date.now(),
      status: 'pending',
      collectionName
    });
    saveSyncQueue(queue);
    console.log(`[Sync Queue] addDoc agendado offline para o caminho: ${path}`);
    return {
      id: `offline_temp_${actionId}`,
      path: `${path}/offline_temp_${actionId}`,
      type: 'document'
    } as any;
  }

  try {
    return await originalAddDoc(reference, data);
  } catch (err: any) {
    const isNetworkErr = err?.message?.includes("network") || 
                         err?.message?.includes("offline") || 
                         err?.code === "unavailable" ||
                         err?.message?.includes("fetch");
    if (isNetworkErr) {
      const actionId = `add_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const queue = getSyncQueue();
      queue.push({
        id: actionId,
        type: 'add',
        path,
        data,
        timestamp: Date.now(),
        status: 'pending',
        collectionName
      });
      saveSyncQueue(queue);
      return {
        id: `offline_temp_${actionId}`,
        path: `${path}/offline_temp_${actionId}`,
        type: 'document'
      } as any;
    }
    throw err;
  }
}

export async function setDoc(reference: any, data: any, options?: any) {
  const path = reference.path;
  const collectionName = path.split('/').slice(-2, -1)[0] || 'unknown';

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const actionId = `set_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const queue = getSyncQueue();
    queue.push({
      id: actionId,
      type: 'set',
      path,
      data,
      options,
      timestamp: Date.now(),
      status: 'pending',
      collectionName
    });
    saveSyncQueue(queue);
    console.log(`[Sync Queue] setDoc agendado offline para o caminho: ${path}`);
    return;
  }

  try {
    return await originalSetDoc(reference, data, options);
  } catch (err: any) {
    const isNetworkErr = err?.message?.includes("network") || 
                         err?.message?.includes("offline") || 
                         err?.code === "unavailable" ||
                         err?.message?.includes("fetch");
    if (isNetworkErr) {
      const actionId = `set_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const queue = getSyncQueue();
      queue.push({
        id: actionId,
        type: 'set',
        path,
        data,
        options,
        timestamp: Date.now(),
        status: 'pending',
        collectionName
      });
      saveSyncQueue(queue);
      return;
    }
    throw err;
  }
}

export async function updateDoc(reference: any, data: any) {
  const path = reference.path;
  const collectionName = path.split('/').slice(-2, -1)[0] || 'unknown';

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const actionId = `update_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const queue = getSyncQueue();
    queue.push({
      id: actionId,
      type: 'update',
      path,
      data,
      timestamp: Date.now(),
      status: 'pending',
      collectionName
    });
    saveSyncQueue(queue);
    console.log(`[Sync Queue] updateDoc agendado offline para o caminho: ${path}`);
    return;
  }

  try {
    return await originalUpdateDoc(reference, data);
  } catch (err: any) {
    const isNetworkErr = err?.message?.includes("network") || 
                         err?.message?.includes("offline") || 
                         err?.code === "unavailable" ||
                         err?.message?.includes("fetch");
    if (isNetworkErr) {
      const actionId = `update_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const queue = getSyncQueue();
      queue.push({
        id: actionId,
        type: 'update',
        path,
        data,
        timestamp: Date.now(),
        status: 'pending',
        collectionName
      });
      saveSyncQueue(queue);
      return;
    }
    throw err;
  }
}

export async function deleteDoc(reference: any) {
  const path = reference.path;
  const collectionName = path.split('/').slice(-2, -1)[0] || 'unknown';

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const actionId = `delete_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const queue = getSyncQueue();
    queue.push({
      id: actionId,
      type: 'delete',
      path,
      timestamp: Date.now(),
      status: 'pending',
      collectionName
    });
    saveSyncQueue(queue);
    console.log(`[Sync Queue] deleteDoc agendado offline para o caminho: ${path}`);
    return;
  }

  try {
    return await originalDeleteDoc(reference);
  } catch (err: any) {
    const isNetworkErr = err?.message?.includes("network") || 
                         err?.message?.includes("offline") || 
                         err?.code === "unavailable" ||
                         err?.message?.includes("fetch");
    if (isNetworkErr) {
      const actionId = `delete_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const queue = getSyncQueue();
      queue.push({
        id: actionId,
        type: 'delete',
        path,
        timestamp: Date.now(),
        status: 'pending',
        collectionName
      });
      saveSyncQueue(queue);
      return;
    }
    throw err;
  }
}

// Helper to retrieve staff/collaborators filtered strictly by tenantId
export async function getStaffByTenant(tenantId?: string, role?: string | null): Promise<{ id: string, name: string, role?: string, type?: string, tenantId: string }[]> {
  const targetTenant = (tenantId && tenantId.trim() && tenantId !== 'undefined' && tenantId !== 'null') 
    ? tenantId.trim() 
    : (getActiveTenantId() || 'psm');

  console.log(`[getStaffByTenant] Diagnóstico: A carregar colaboradores estritamente para tenantId="${targetTenant}", cargo="${role || 'todos'}"`);

  try {
    const roleParam = role ? `&role=${encodeURIComponent(role)}` : '';
    const response = await fetch(`/api/auth/collaborators?tenantId=${encodeURIComponent(targetTenant)}${roleParam}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.collaborators)) {
        console.log(`[getStaffByTenant] Sucesso via API: ${data.collaborators.length} colaboradores encontrados para tenantId="${targetTenant}"`);
        return data.collaborators;
      }
    }
  } catch (err) {
    console.warn(`[getStaffByTenant] Aviso ao contactar endpoint de colaboradores:`, err);
  }

  // Client-side fallback if API not reachable
  const resultsMap = new Map<string, { id: string, name: string, role?: string, type?: string, tenantId: string }>();

  const addDoc = (docSnap: any, defaultType: string, defaultRole: string) => {
    const d = docSnap.data ? docSnap.data() : docSnap;
    if (!d) return;
    const nameVal = d.name || d.nome || d.fullName || d.nomeCompleto || d.displayName;
    if (nameVal && typeof nameVal === 'string' && nameVal.trim().length > 0) {
      const docTenant = d.tenantId || d.tenant || 'psm';
      if (docTenant === targetTenant) {
        const key = nameVal.trim().toUpperCase();
        if (!resultsMap.has(key)) {
          resultsMap.set(key, {
            id: docSnap.id || key,
            name: nameVal.trim(),
            role: d.role || defaultRole,
            type: d.type || (d.role === 'driver' || defaultType === 'Motorista' ? 'Motorista' : defaultType),
            tenantId: docTenant
          });
        }
      }
    }
  };

  try {
    // 1. Check tenant subcollections
    try {
      const staffSnap = await withTimeout(getDocs(originalCollection(db, 'tenants', targetTenant, 'administrative_staff')), 4000);
      staffSnap?.docs?.forEach(doc => addDoc(doc, 'Administrativo', 'operator'));
    } catch (e) {}

    try {
      const driverMasterSnap = await withTimeout(getDocs(originalCollection(db, 'tenants', targetTenant, 'drivers_master')), 4000);
      driverMasterSnap?.docs?.forEach(doc => addDoc(doc, 'Motorista', 'driver'));
    } catch (e) {}

    try {
      const driverSnap = await withTimeout(getDocs(originalCollection(db, 'tenants', targetTenant, 'drivers')), 4000);
      driverSnap?.docs?.forEach(doc => addDoc(doc, 'Motorista', 'driver'));
    } catch (e) {}

    // 2. Root collections matching tenantId
    try {
      const rootStaffSnap = await withTimeout(getDocs(originalCollection(db, 'administrative_staff')), 4000);
      rootStaffSnap?.docs?.forEach(doc => addDoc(doc, 'Administrativo', 'operator'));
    } catch (e) {}

    try {
      const rootDriversMasterSnap = await withTimeout(getDocs(originalCollection(db, 'drivers_master')), 4000);
      rootDriversMasterSnap?.docs?.forEach(doc => addDoc(doc, 'Motorista', 'driver'));
    } catch (e) {}

    try {
      const rootDriversSnap = await withTimeout(getDocs(originalCollection(db, 'drivers')), 4000);
      rootDriversSnap?.docs?.forEach(doc => addDoc(doc, 'Motorista', 'driver'));
    } catch (e) {}

    // 3. Root users collection matching tenantId
    try {
      const usersSnap = await withTimeout(getDocs(originalCollection(db, 'users')), 4000);
      usersSnap?.docs?.forEach(doc => addDoc(doc, doc.data()?.role === 'driver' ? 'Motorista' : 'Administrativo', doc.data()?.role || 'operator'));
    } catch (e) {}
  } catch (err) {
    console.error(`[getStaffByTenant] Erro ao consultar Firestore cliente:`, err);
  }

  let list = Array.from(resultsMap.values());
  if (role === 'driver') {
    list = list.filter(c => c.type === 'Motorista' || c.role === 'driver');
  } else if (role && role !== 'all') {
    list = list.filter(c => c.type === 'Administrativo' || (c.role !== 'driver' && c.type !== 'Motorista'));
  }

  list.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[getStaffByTenant] Diagnóstico Concluído: ${list.length} colaboradores filtrados para tenantId="${targetTenant}"`);
  return list;
}

// Inicia sincronização automática ao carregar se online
if (typeof window !== 'undefined') {
  setTimeout(() => {
    processSyncQueue();
  }, 3000);
}
