// ============================================================
// FIREBASE MESSAGING SERVICE WORKER
// Requerido por FCM para recibir notificaciones en background
// y con la app cerrada en navegadores web.
// NOMBRE EXACTO: firebase-messaging-sw.js
// UBICACIÓN EXACTA: /public/ (raíz del directorio público)
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Configuración idéntica a FRONTEND/src/firebase.ts
firebase.initializeApp({
    apiKey: "AIzaSyD9tJXbbzcOjhn_pbRKYQmyeeyEi_nl1Bc",
    authDomain: "sociedad-rural-norte.firebaseapp.com",
    projectId: "sociedad-rural-norte",
    storageBucket: "sociedad-rural-norte.firebasestorage.app",
    messagingSenderId: "559939075419",
    appId: "1:559939075419:web:1d5a72f4468556ad0c2e7e"
});

const messaging = firebase.messaging();

// Handler: Recepción de mensajes en background / app cerrada
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notificación recibida en background:', payload);

    const notifTitle = payload.notification?.title || 'Sociedad Rural';
    const notifBody  = payload.notification?.body  || '';

    self.registration.showNotification(notifTitle, {
        body: notifBody,
        icon: '/assets/icon/icon.png',
        badge: '/assets/icon/icon.png',
        // sound se hereda del canal de notificación del OS
        data: payload.data || {}
    });
});

// Handler: Click sobre la notificación del sistema operativo
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const link = event.notification.data?.link_url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Si la app ya está abierta, enfocarla y navegar
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    client.focus();
                    client.postMessage({ type: 'NOTIFICATION_CLICK', link });
                    return;
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(link);
            }
        })
    );
});
