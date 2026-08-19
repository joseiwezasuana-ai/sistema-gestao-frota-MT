// Service Worker for PWA & Background Push Notifications (SUPER TÁXI - JIS ANGOLA)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Handle incoming background Push Notifications for continuous vibration & ring alert
self.addEventListener('push', (event) => {
  console.log('[sw.js] Background Push event received:', event);
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    payload = { title: '🚕 SUPER TÁXI - Chamada de Passageiro', body: event.data ? event.data.text() : 'Nova solicitação de serviço.' };
  }

  const rawNotif = payload.notification || {};
  const rawData = payload.data || payload || {};

  const title = rawNotif.title || rawData.title || '🚕 SUPER TÁXI - Nova Chamada Recebida!';
  const body = rawNotif.body || rawData.body || 'Atenção Motorista: Existe uma solicitação de táxi disponível em linha.';
  const callId = rawData.callId || '';

  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [800, 300, 800, 300, 800, 300, 1200], // Strong system vibration pattern
    tag: callId ? `supertaxi_call_${callId}` : `supertaxi_msg_${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: rawData.url || '/?view=driver',
      callId: callId,
      ...rawData
    },
    actions: [
      { action: 'accept_call', title: '✅ Atender Chamada' },
      { action: 'open_app', title: '👁️ Abrir App' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const urlToOpen = notifData.url || self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_ACTION_CLICKED',
            action: event.action || 'click',
            data: notifData
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
