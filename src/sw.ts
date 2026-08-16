/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();

// Precache static assets built by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// -----------------------------------------------------------------------------
// Push Event: Firebase Cloud Messaging (FCM) & Web Push Handler
// Receives background calls, alerts, and dispatch notifications even when the
// screen is locked, the app is minimized, or the browser tab is closed.
// -----------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let payloadData: any = {};

  if (event.data) {
    try {
      payloadData = event.data.json();
    } catch (e) {
      payloadData = { body: event.data.text() };
    }
  }

  console.log('[sw.ts Push] Background Push Message received:', payloadData);

  // Extract nested Firebase notification or raw data
  const rawNotif = payloadData.notification || {};
  const rawData = payloadData.data || payloadData;

  const isCall = 
    rawData.type === 'call_received' || 
    rawData.type === 'new_call' || 
    rawData.type === 'service_alert' || 
    rawData.notificationType === 'call_received' ||
    rawData.callId ||
    /chamada|corrida|pedido|despacho|serviço|passageiro/i.test(rawNotif.title || rawData.title || '') ||
    /chamada|corrida|pedido|despacho|serviço|passageiro/i.test(rawNotif.body || rawData.body || '');

  const title = rawNotif.title || rawData.title || (isCall ? '🚕 SUPER TÁXI - Chamada Recebida' : '🔔 SUPER TÁXI - Alerta do Sistema');
  const body = rawNotif.body || rawData.body || (isCall ? 'Nova solicitação de transporte na Central de Despacho. Toque para aceitar.' : 'Novo alerta operacional recebido.');
  const icon = rawNotif.icon || rawData.icon || '/icon-192.png';
  const badge = rawNotif.badge || rawData.badge || '/icon-192.png';
  const callId = rawData.callId || rawNotif.tag || '';
  const tag = rawNotif.tag || (callId ? `supertaxi_call_${callId}` : `supertaxi_alert_${Date.now()}`);

  const targetUrl = rawData.url || (callId ? `/?tab=dashboard&callId=${callId}` : '/?tab=dashboard');

  const options: any = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: true, // Crucial: Keeps notification persistent on lock screen / screen until user acts
    silent: false,
    vibrate: [500, 200, 500, 200, 500, 200, 800], // High-cadence vibration to wake up Android/iOS devices
    data: {
      url: targetUrl,
      callId,
      timestamp: Date.now(),
      type: rawData.type || (isCall ? 'call_received' : 'general'),
      ...rawData
    },
    actions: isCall ? [
      { action: 'accept_call', title: '✅ Aceitar Chamada' },
      { action: 'view_call', title: '👁️ Ver Detalhes' }
    ] : [
      { action: 'open_app', title: 'Abrir Aplicação' }
    ]
  };

  event.waitUntil(
    Promise.all([
      // 1. Show native OS notification with vibration and persistent wake
      self.registration.showNotification(title, options),
      
      // 2. Broadcast push message to any open application windows
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'FCM_PUSH_RECEIVED',
            payload: {
              title,
              body,
              options,
              data: options.data
            }
          });
        });
      })
    ])
  );
});

// -----------------------------------------------------------------------------
// Notification Click: Wakes/Focuses Application and Handles Actions
// -----------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const action = event.action;
  const targetUrl = notifData.url || '/';

  console.log('[sw.ts] Notification clicked. Action:', action, 'Data:', notifData);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an existing window is already open, focus it and post an event
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_ACTION_CLICKED',
            action: action || 'default_click',
            data: notifData,
            callId: notifData.callId
          });
          return client.focus();
        }
      }
      
      // If no window is currently open, open a new one pointing to the target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// -----------------------------------------------------------------------------
// Message Listener: Allows React client to communicate with Service Worker
// -----------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Trigger persistent local notification via SW on demand (e.g. from Firestore listener fallback)
  if (event.data && event.data.type === 'TRIGGER_LOCAL_PUSH') {
    const { title, options } = event.data.payload || {};
    if (title) {
      self.registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        requireInteraction: true,
        vibrate: [500, 200, 500, 200, 500, 200, 800],
        ...options
      });
    }
  }
});

// -----------------------------------------------------------------------------
// Lifecycle: Immediate Activation
// -----------------------------------------------------------------------------
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
