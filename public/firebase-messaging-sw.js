// Firebase Cloud Messaging Background Service Worker (SUPER TÁXI - JIS ANGOLA, LUENA-MOXICO)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyACKzcsBb9U2HOMV9YRGvCjkXxNHx0iC-s",
  authDomain: "joseiwezasuana-org.firebaseapp.com",
  projectId: "joseiwezasuana-org",
  storageBucket: "joseiwezasuana-org.firebasestorage.app",
  messagingSenderId: "617761169333",
  appId: "1:617761169333:web:64e837b008d27c26dd83fc"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background FCM message received:', payload);
  const rawNotif = payload.notification || {};
  const rawData = payload.data || {};

  const isCall = 
    rawData.type === 'call_received' || 
    rawData.type === 'new_call' || 
    rawData.type === 'service_alert' || 
    rawData.callId ||
    /chamada|corrida|pedido|despacho|serviço/i.test(rawNotif.title || rawData.title || '');

  const title = rawNotif.title || rawData.title || (isCall ? '🚕 SUPER TÁXI - Chamada Recebida' : '🔔 SUPER TÁXI - Notificação da Central');
  const body = rawNotif.body || rawData.body || (isCall ? 'Nova solicitação de serviço na Central de Despacho.' : 'Você recebeu uma atualização na frota.');
  const callId = rawData.callId || '';

  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [800, 300, 800, 300, 800, 300, 1200],
    tag: callId ? `supertaxi_call_${callId}` : `supertaxi_msg_${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: rawData.url || (isCall ? '/?tab=dashboard' : (rawData.isPassenger ? '/?app=passenger' : '/')),
      callId: callId,
      ...rawData
    },
    actions: isCall ? [
      { action: 'accept_call', title: '✅ Aceitar Chamada' },
      { action: 'view_call', title: '👁️ Ver Detalhes' }
    ] : [
      { action: 'open_app', title: 'Abrir App' }
    ]
  };

  return self.registration.showNotification(title, options);
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
