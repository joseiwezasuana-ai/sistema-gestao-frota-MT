import { db, collection, addDoc, serverTimestamp, getActiveTenantId } from './firebase';

export interface SystemErrorLog {
  id?: string;
  message: string;
  stack?: string;
  componentStack?: string;
  severity: 'error' | 'warning' | 'critical';
  timestamp: string;
  userEmail?: string;
  userName?: string;
  tenantId?: string;
  userAgent?: string;
  url?: string;
  resolved?: boolean;
  // FCM & Signaling Specific Fields
  logCategory?: 'system' | 'fcm_delivery' | 'signaling';
  driverId?: string;
  callId?: string;
  serverCallReceivedTimestamp?: string;
  fcmToken?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export async function logFcmDeliveryError(data: {
  driverId: string;
  serverCallReceivedTimestamp: string;
  callId?: string;
  errorMessage: string;
  failureReason?: string;
  fcmToken?: string;
  stack?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const message = `[FCM Delivery Error] Falha ao entregar notificação push ao motorista (${data.driverId}): ${data.errorMessage}`;
  await logSystemError({
    message,
    stack: data.stack || `FCM Delivery Attempt failed for Driver ${data.driverId}`,
    severity: 'error',
    metadata: {
      logCategory: 'fcm_delivery',
      driverId: data.driverId,
      callId: data.callId || '',
      serverCallReceivedTimestamp: data.serverCallReceivedTimestamp,
      fcmToken: data.fcmToken || '',
      failureReason: data.failureReason || 'Token FCM inválido ou dispositivo offline',
      ...data.metadata
    }
  });
}

export async function logSystemError(data: {
  message: string;
  stack?: string;
  componentStack?: string;
  severity?: 'error' | 'warning' | 'critical';
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    let userEmail = 'desconhecido';
    let userName = 'utilizador';

    try {
      const storedUser = localStorage.getItem('psm-user') || localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        userEmail = parsed.email || userEmail;
        userName = parsed.name || userName;
      }
    } catch {}

    const timestampIso = new Date().toISOString();
    const logData: SystemErrorLog = {
      message: data.message || 'Erro de Sistema sem mensagem',
      stack: data.stack || '',
      componentStack: data.componentStack || '',
      severity: data.severity || 'error',
      timestamp: timestampIso,
      userEmail,
      userName,
      tenantId: getActiveTenantId() || 'jis',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      resolved: false,
      logCategory: data.metadata?.logCategory || 'system',
      driverId: data.metadata?.driverId,
      callId: data.metadata?.callId,
      serverCallReceivedTimestamp: data.metadata?.serverCallReceivedTimestamp,
      fcmToken: data.metadata?.fcmToken,
      failureReason: data.metadata?.failureReason,
      metadata: data.metadata || {}
    };

    // 1. Backup to LocalStorage (for offline recovery)
    try {
      const existingStr = localStorage.getItem('taxi_system_error_logs_backup');
      const existing = existingStr ? JSON.parse(existingStr) : [];
      existing.unshift(logData);
      localStorage.setItem('taxi_system_error_logs_backup', JSON.stringify(existing.slice(0, 50)));
    } catch {}

    // 2. Persist to Firestore
    if (db) {
      await addDoc(collection(db, 'system_error_logs'), {
        ...logData,
        createdAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('[ErrorLogger] Fallback saving error log:', err);
  }
}

// Global Window Listeners initialization
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logSystemError({
      message: event.message || 'Window Uncaught Error',
      stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      severity: 'error'
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logSystemError({
      message: typeof reason === 'string' ? reason : reason?.message || 'Unhandled Promise Rejection',
      stack: reason?.stack || '',
      severity: 'warning'
    });
  });
}
