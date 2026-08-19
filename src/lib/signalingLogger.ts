import { db, collection, addDoc, serverTimestamp, getActiveTenantId, getDocs, query, orderBy, limit, deleteDoc, doc, writeBatch } from './firebase';

export type SignalingEventType = 
  | 'call_initiated'
  | 'call_received'
  | 'ringtone_triggered'
  | 'audio_context_unlocked'
  | 'call_attended'
  | 'call_rejected'
  | 'fcm_dispatch'
  | 'push_delivered'
  | 'push_failed'
  | 'network_status_change'
  | 'driver_online_sync';

export interface SignalingLog {
  id?: string;
  eventType: SignalingEventType;
  status: 'success' | 'failure' | 'warning' | 'info';
  callId?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  passengerName?: string;
  passengerPhone?: string;
  vehiclePlate?: string;
  message: string;
  details?: Record<string, any>;
  failureReason?: string;
  serverCallReceivedTimestamp?: string;
  fcmToken?: string;
  timestamp: string;
  tenantId?: string;
  userAgent?: string;
}

const LOCAL_STORAGE_KEY = 'taxi_signaling_communication_logs_backup';

export async function logSignalingEvent(data: {
  eventType: SignalingEventType;
  status: 'success' | 'failure' | 'warning' | 'info';
  message?: string;
  callId?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  passengerName?: string;
  passengerPhone?: string;
  vehiclePlate?: string;
  details?: Record<string, any>;
  failureReason?: string;
  serverCallReceivedTimestamp?: string;
  fcmToken?: string;
}): Promise<void> {
  try {
    const timestampIso = new Date().toISOString();
    const tenantId = getActiveTenantId() || 'jis';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    const defaultMessages: Record<SignalingEventType, string> = {
      call_initiated: 'Chamada de viagem iniciada pelo passageiro',
      call_received: 'Chamada recebida e sincronizada no visor do motorista',
      ringtone_triggered: 'Toque contínuo de alerta de chamada acionado no dispositivo',
      audio_context_unlocked: 'Contexto de áudio Web Audio desbloqueado no dispositivo',
      call_attended: 'Chamada atendida/aceite com sucesso',
      call_rejected: 'Chamada recusada ou cancelada pelo condutor',
      fcm_dispatch: 'Disparo de notificação push FCM',
      push_delivered: 'Notificação push entregue no telemóvel',
      push_failed: 'Falha no envio de push FCM',
      network_status_change: 'Mudança de estado de conectividade',
      driver_online_sync: 'Sincronização de estado online de motorista'
    };

    const logEntry: SignalingLog = {
      eventType: data.eventType,
      status: data.status,
      message: data.message || defaultMessages[data.eventType] || `Evento de sinalização: ${data.eventType}`,
      callId: data.callId || '',
      driverId: data.driverId || '',
      driverName: data.driverName || '',
      driverPhone: data.driverPhone || '',
      passengerName: data.passengerName || '',
      passengerPhone: data.passengerPhone || '',
      vehiclePlate: data.vehiclePlate || '',
      details: data.details || {},
      failureReason: data.failureReason || '',
      serverCallReceivedTimestamp: data.serverCallReceivedTimestamp || '',
      fcmToken: data.fcmToken || '',
      timestamp: timestampIso,
      tenantId,
      userAgent
    };

    // 1. Local storage buffer (always available offline)
    try {
      const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      const existing: SignalingLog[] = existingStr ? JSON.parse(existingStr) : [];
      existing.unshift(logEntry);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing.slice(0, 100)));
    } catch {}

    // 2. Persist in Firestore
    if (db) {
      await addDoc(collection(db, 'signaling_logs'), {
        ...logEntry,
        createdAt: serverTimestamp()
      });
    }

    console.log(`[Signaling Log] [${logEntry.eventType}] (${logEntry.status}):`, logEntry.message);
  } catch (err) {
    console.warn('[SignalingLogger] Error logging signaling event:', err);
  }
}

export function getLocalSignalingLogs(): SignalingLog[] {
  try {
    const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    return existingStr ? JSON.parse(existingStr) : [];
  } catch {
    return [];
  }
}
