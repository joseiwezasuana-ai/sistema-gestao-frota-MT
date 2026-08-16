export const db = {} as any;
export const auth = {} as any;
export const app = {} as any;
export const googleProvider = {} as any;

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
};

export const handleFirestoreError = (err: any, op: any) => console.error(err, op);
export const OperationType = {} as any;
export const getActiveTenantId = () => 'default-tenant';
export const setActiveTenantId = (id: string) => {};

export const collection = (...args: any[]) => ({} as any);
export const setDoc = async (...args: any[]) => {};
export const addDoc = async (...args: any[]) => ({} as any);
export const updateDoc = async (...args: any[]) => {};
export const deleteDoc = async (...args: any[]) => {};
export const doc = (...args: any[]) => ({} as any);
export const getDoc = async (...args: any[]) => ({} as any);
export const getDocs = async (...args: any[]) => ({} as any);
export const onSnapshot = (...args: any[]) => (() => {});
export const query = (...args: any[]) => ({} as any);
export const where = (...args: any[]) => ({} as any);
export const orderBy = (...args: any[]) => ({} as any);
export const limit = (...args: any[]) => ({} as any);
export const serverTimestamp = () => ({} as any);
export const Timestamp = {
  now: () => ({} as any),
  fromDate: (d: Date) => ({} as any),
} as any;

export default {};
