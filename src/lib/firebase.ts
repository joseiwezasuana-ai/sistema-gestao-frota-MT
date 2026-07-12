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
  DocumentData
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Export everything from firebase/firestore so our file acts as a drop-in replacement
export * from 'firebase/firestore';

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
const GLOBAL_COLLECTIONS = ['users', 'tenants'];

export function getActiveTenantId(): string {
  if (activeTenantId) return activeTenantId;
  const saved = localStorage.getItem('active_tenant_id');
  if (saved) {
    activeTenantId = saved;
    return saved;
  }
  return 'psm'; // Default to psm (PSMoreira Comercial,(SU) Lda)
}

export function setActiveTenantId(tenantId: string | null) {
  activeTenantId = tenantId;
  if (tenantId) {
    localStorage.setItem('active_tenant_id', tenantId);
  } else {
    localStorage.removeItem('active_tenant_id');
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
