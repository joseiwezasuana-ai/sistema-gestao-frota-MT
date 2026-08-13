import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

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

    // Register FCM Service Worker explicitly if needed
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((reg) => {
          console.log('[FCM] Service worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[FCM] Service worker registration failed:', err);
        });
    }

    return messagingInstance;
  } catch (err) {
    console.warn('[FCM] Failed to initialize FCM Messaging:', err);
    return null;
  }
}

/**
 * Requests FCM device token from browser/device and stores it locally and in Firestore
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

    const { getToken } = await import('firebase/messaging');
    
    // Attempt token retrieval
    const token = await getToken(messaging, {
      vapidKey: undefined // Uses standard FCM token generation
    }).catch(err => {
      console.warn('[FCM] Error getting FCM device token:', err);
      return null;
    });

    if (token) {
      console.log('[FCM] FCM Device Token obtained:', token);
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
 * Attach foreground FCM listener for incoming notifications while app is active
 */
export async function listenToFcmForegroundMessages(onMessageReceived: (payload: any) => void) {
  const messaging = await getFcmMessaging();
  if (!messaging) return;

  try {
    const { onMessage } = await import('firebase/messaging');
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground push notification received:', payload);
      onMessageReceived(payload);
    });
  } catch (err) {
    console.warn('[FCM] Could not register foreground message listener:', err);
  }
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

    console.log(`[FCM Service] Triggering push notification '${title}' type '${notificationType}' for call '${callId}'`);

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

    // Fallback local Web Push / ServiceWorker notification if passenger is on same client device
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const options = {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: callId || 'passenger_notification',
        renotify: true,
        requireInteraction: true
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, options).catch(() => {});
        }).catch(() => {});
      }
    }

    return result;
  } catch (err) {
    console.warn('[FCM Service] Push notification request failed:', err);
    return null;
  }
}
