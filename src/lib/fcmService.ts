import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { db } from './firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { logFcmDeliveryError } from './errorLogger';
import { logSignalingEvent } from './signalingLogger';

let messagingInstance: any = null;

/**
 * Initializes FCM Messaging on the client and registers the service worker if supported
 */
export async function getFcmMessaging() {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.warn('[FCM] Messaging is not supported in this browser environment.');
      return null;
    }

    const { getApp } = await import('firebase/app');
    const app = getApp();
    const { getMessaging } = await import('firebase/messaging');
    messagingInstance = getMessaging(app);

    // Register PWA Service Worker explicitly if needed
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[FCM] Service worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          // Fallback to firebase-messaging-sw.js
          navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((swErr) => {
            console.warn('[FCM] SW fallback registration warning:', swErr);
          });
        });
    }

    return messagingInstance;
  } catch (err) {
    console.warn('[FCM] Failed to initialize FCM Messaging:', err);
    return null;
  }
}

/**
 * Detects device platform for token registry
 */
function getDevicePlatform(): 'android' | 'ios' | 'web' {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'web';
}

/**
 * Requests FCM device token for driver, staff, or operator and stores it in Firestore
 */
export async function requestDriverFcmToken(user?: any): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission not granted by user:', permission);
      return null;
    }

    const messaging = await getFcmMessaging();
    if (!messaging) return null;

    let swRegistration: ServiceWorkerRegistration | undefined = undefined;
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.ready.catch(() => undefined);
    }

    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration
    }).catch(err => {
      console.warn('[FCM] Error obtaining FCM token for driver/user:', err);
      return null;
    });

    if (token) {
      console.log('[FCM] Driver/User FCM Token obtained:', token);
      localStorage.setItem('driver_fcm_token', token);
      localStorage.setItem('user_fcm_token', token);

      // Save token in Firestore user profile
      const uid = user?.uid || (user?.id ? String(user.id) : null);
      if (uid) {
        try {
          const userRef = doc(db, 'users', uid);
          await setDoc(userRef, {
            fcmToken: token,
            fcmTokens: {
              [token.substring(0, 16)]: {
                token,
                platform: getDevicePlatform(),
                updatedAt: new Date().toISOString()
              }
            },
            pushActive: true,
            lastTokenUpdate: new Date().toISOString()
          }, { merge: true });
          console.log(`[FCM] Synced FCM token for user ${uid}`);
        } catch (e) {
          console.warn('[FCM] Could not sync FCM token to user document:', e);
        }
      }

      // If user has a driver/vehicle name or ID, also register in drivers collection
      const driverName = user?.name || user?.driverName || user?.vehicleId;
      if (driverName && typeof driverName === 'string') {
        try {
          const driverRef = doc(db, 'drivers', driverName.toLowerCase().replace(/[^a-z0-9]/g, '_'));
          await setDoc(driverRef, {
            fcmToken: token,
            driverName: driverName,
            platform: getDevicePlatform(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn('[FCM] Could not sync token to drivers collection:', e);
        }
      }

      return token;
    }
  } catch (err) {
    console.warn('[FCM] Failed during requestDriverFcmToken:', err);
  }

  return null;
}

/**
 * Requests FCM device token from browser/device for passengers and stores it locally and in Firestore
 */
export async function requestPassengerFcmToken(callId?: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied or dismissed by passenger.');
      return null;
    }

    const messaging = await getFcmMessaging();
    if (!messaging) return null;

    let swRegistration: ServiceWorkerRegistration | undefined = undefined;
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.ready.catch(() => undefined);
    }

    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration
    }).catch(err => {
      console.warn('[FCM] Error getting FCM device token:', err);
      return null;
    });

    if (token) {
      console.log('[FCM] Passenger FCM Device Token obtained:', token);
      localStorage.setItem('passenger_fcm_token', token);

      // If callId is provided, attach token directly to the call request document
      if (callId) {
        try {
          const callRef = doc(db, 'calls', callId);
          await updateDoc(callRef, {
            fcmToken: token,
            passengerFcmToken: token,
            updatedAt: new Date().toISOString()
          });
          console.log(`[FCM] Attached FCM token to call ${callId}`);
        } catch (e) {
          console.warn('[FCM] Could not update call document with fcmToken:', e);
        }
      }

      return token;
    }
  } catch (err) {
    console.warn('[FCM] Failed during requestPassengerFcmToken execution:', err);
  }

  return null;
}

/**
 * Attach foreground FCM and ServiceWorker listeners for incoming notifications while app is open
 */
export async function listenToFcmForegroundMessages(onMessageReceived: (payload: any) => void) {
  const messaging = await getFcmMessaging();
  if (messaging) {
    try {
      const { onMessage } = await import('firebase/messaging');
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground push notification received via onMessage:', payload);
        onMessageReceived(payload);
      });
    } catch (err) {
      console.warn('[FCM] Could not register foreground onMessage listener:', err);
    }
  }

  // Also listen for messages forwarded by Service Worker
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && (event.data.type === 'FCM_PUSH_RECEIVED' || event.data.type === 'NOTIFICATION_ACTION_CLICKED')) {
        console.log('[FCM] Message received from Service Worker:', event.data);
        onMessageReceived(event.data);
      }
    });
  }
}

/**
 * Triggers a persistent local notification via Service Worker (with vibration and lock-screen wake)
 */
export async function triggerLocalNotificationViaSw(title: string, options: NotificationOptions = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const defaultOptions: any = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    requireInteraction: true,
    renotify: true,
    vibrate: [500, 200, 500, 200, 500, 200, 800],
    ...options
  };

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, defaultOptions);
      return;
    } catch (e) {
      console.warn('[FCM] SW showNotification fallback:', e);
    }
  }

  try {
    new Notification(title, defaultOptions);
  } catch (e) {}
}

/**
 * Sends push notification payload to server route /api/fcm/send-passenger-push
 */
export async function sendPassengerPushNotification({
  fcmToken,
  callId,
  title,
  body,
  notificationType
}: {
  fcmToken?: string | null;
  callId?: string;
  title: string;
  body: string;
  notificationType: 'ride_accepted' | 'price_proposed' | 'driver_arrived' | 'ride_completed' | 'general';
}) {
  try {
    const activeToken = fcmToken || localStorage.getItem('passenger_fcm_token');

    console.log(`[FCM Service] Triggering passenger push '${title}' (type '${notificationType}') for call '${callId}'`);

    const response = await fetch('/api/fcm/send-passenger-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fcmToken: activeToken || null,
        callId: callId || null,
        title,
        body,
        notificationType
      })
    });

    const result = await response.json();
    console.log('[FCM Service] Server response:', result);

    // Fallback local Web Push / ServiceWorker notification
    await triggerLocalNotificationViaSw(title, {
      body,
      tag: callId || 'passenger_notification'
    });

    return result;
  } catch (err) {
    console.warn('[FCM Service] Push notification request failed:', err);
    return null;
  }
}

/**
 * Sends push notification payload to driver via server route /api/fcm/send-driver-push
 */
export async function sendDriverPushNotification({
  fcmToken,
  callId,
  driverId,
  title,
  body,
  notificationType
}: {
  fcmToken?: string | null;
  callId?: string;
  driverId?: string;
  title: string;
  body: string;
  notificationType?: string;
}) {
  const callReceivedTimestamp = new Date().toISOString();
  const targetDriverId = driverId || 'motorista_desconhecido';
  try {
    const activeToken = fcmToken || localStorage.getItem('driver_fcm_token');

    console.log(`[FCM Service] Triggering driver push '${title}' for driver '${targetDriverId}', call '${callId}'`);

    const response = await fetch('/api/fcm/send-driver-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fcmToken: activeToken || null,
        callId: callId || null,
        driverId: targetDriverId,
        title,
        body,
        notificationType: notificationType || 'call_received'
      })
    });

    const result = await response.json();
    console.log('[FCM Service] Driver push server response:', result);

    if (!result.success || result.error) {
      await logFcmDeliveryError({
        driverId: targetDriverId,
        serverCallReceivedTimestamp: result.serverCallReceivedTimestamp || callReceivedTimestamp,
        callId: callId,
        errorMessage: result.error || 'Falha retornada pelo servidor no envio do push FCM',
        failureReason: result.error || 'Erro de envio FCM',
        fcmToken: activeToken || undefined
      });
    }

    // Fallback local notification
    await triggerLocalNotificationViaSw(title, {
      body,
      tag: callId ? `call_${callId}` : `driver_alert_${Date.now()}`
    });

    return result;
  } catch (err: any) {
    console.warn('[FCM Service] Driver push notification request failed:', err);
    await logFcmDeliveryError({
      driverId: targetDriverId,
      serverCallReceivedTimestamp: callReceivedTimestamp,
      callId: callId,
      errorMessage: err?.message || 'Falha de rede ou servidor inacessível ao disparar push FCM',
      failureReason: 'Falha de conexão / Fetch Error',
      fcmToken: fcmToken || undefined,
      stack: err?.stack
    });
    return null;
  }
}
