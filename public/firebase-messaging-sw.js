// Firebase Cloud Messaging Background Service Worker (SUPER TÁXI - JIS. SU, LDA LUENA-MOXICO)
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
  const title = payload.notification?.title || payload.data?.title || '🚕 TAXICONTROL - Notificação da Corrida';
  const body = payload.notification?.body || payload.data?.body || 'Você recebeu uma atualização na sua corrida de táxi.';

  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [300, 100, 300, 100, 300, 100, 300],
    tag: payload.data?.callId || 'taxi_ride_update',
    renotify: true,
    requireInteraction: true,
    data: {
      url: self.location.origin + '/?app=passenger',
      callId: payload.data?.callId
    }
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || (self.location.origin + '/?app=passenger');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url && client.url.includes('passenger') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
