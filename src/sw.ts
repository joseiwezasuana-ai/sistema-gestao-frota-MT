/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();

// Precache static assets built by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// Listen for notification clicks to open/focus the web app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find a window client and focus it
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // If none, open a new window pointing to the homepage
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Force SW to activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
