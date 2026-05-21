// ============================================================
// PWA Service Worker — cache estático + Firebase Cloud Messaging
// No cachea APIs ni servicios externos (Supabase, backend, etc.)
// ============================================================

const CACHE_NAME = 'sociedad-rural-static-v2';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json'];

const SKIP_CACHE = /\/api\/|supabase|firebase|googleapis|gstatic|googletagmanager/i;

// ── Firebase Messaging (background) ─────────────────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD9tJXbbzcOjhn_pbRKYQmyeeyEi_nl1Bc',
  authDomain: 'sociedad-rural-norte.firebaseapp.com',
  projectId: 'sociedad-rural-norte',
  storageBucket: 'sociedad-rural-norte.firebasestorage.app',
  messagingSenderId: '559939075419',
  appId: '1:559939075419:web:1d5a72f4468556ad0c2e7e',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notifTitle = payload.notification?.title || 'Sociedad Rural';
  const notifBody = payload.notification?.body || '';

  self.registration.showNotification(notifTitle, {
    body: notifBody,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link_url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', link });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});

// ── Instalación y cache estático ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (SKIP_CACHE.test(url.href)) return;

  // Solo assets estáticos (html, js, css, imágenes, manifest, sw)
  const isStatic =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/');

  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
