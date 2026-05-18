import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { playNotificationSound } from './utils/soundNotification';

// ─── Firebase Web Config ───────────────────────────────────────────────────
// Las claves se cargan desde variables de entorno VITE_FIREBASE_*.
// Ningún valor sensible debe quedar hardcodeado en el código fuente.
// Para desarrollo local: copiar .env.example a .env y completar los valores.
// Para producción (Vercel): configurar cada variable en el dashboard.
//
// NOTA: Las Firebase Web API Keys son identificadores públicos por diseño
// (no son equivalentes a claves secretas del servidor). Sin embargo, moverlas
// a env vars sigue siendo buena práctica para evitar rotaciones manuales en
// el código y mantener separación de entornos (dev/staging/prod).
// ──────────────────────────────────────────────────────────────────────────

const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
    measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID     as string,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

// Validar que las variables críticas estén presentes
const requiredKeys: (keyof typeof firebaseConfig)[] = [
    'apiKey', 'projectId', 'messagingSenderId', 'appId'
];
const missingKeys = requiredKeys.filter(k => !firebaseConfig[k]);
if (missingKeys.length > 0) {
    console.warn(
        `[Firebase] Variables de entorno faltantes: ${missingKeys.map(k => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`).join(', ')}. ` +
        'Las Push Notifications estarán deshabilitadas.'
    );
}

// Inicializar app de forma segura
let app: ReturnType<typeof initializeApp> | undefined;
let messaging: ReturnType<typeof getMessaging> | null = null;

try {
    if (missingKeys.length === 0) {
        app = initializeApp(firebaseConfig);
        messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
    }
} catch (error) {
    console.error('[Firebase] Error de inicialización:', error);
}

// ─── requestForToken ────────────────────────────────────────────────────────
export const requestForToken = async (): Promise<string | null> => {
    try {
        if (!messaging || !VAPID_KEY) return null;

        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

        if (currentToken) {
            // Solo loguear en entorno de desarrollo — nunca en producción
            if (import.meta.env.DEV) {
                console.log('[Firebase] FCM Token:', currentToken);
            }
            return currentToken;
        } else {
            if (import.meta.env.DEV) {
                console.log('[Firebase] No hay token disponible. Solicitá permiso de notificaciones.');
            }
            return null;
        }
    } catch (err) {
        if (import.meta.env.DEV) {
            console.warn('[Firebase] Error al obtener token:', err);
        }
        return null;
    }
};

// ─── onMessageListener ──────────────────────────────────────────────────────
// Escucha continua en foreground. Retorna una función de cleanup (unsubscribe).
export const onMessageListener = (callback: (payload: any) => void): (() => void) => {
    if (!messaging) return () => {};

    return onMessage(messaging, (payload) => {
        if (import.meta.env.DEV) {
            console.log('[Firebase] Notificación en foreground:', payload);
        }

        // Reproducir sonido si el payload lo indica (fire-and-forget, no async para evitar el error
        // "A listener indicated an asynchronous response by returning true, but the message channel
        // closed before a response was received" de Chrome)
        const soundEnabled = payload.data?.['sound_enabled'] !== 'false';
        if (soundEnabled) {
            playNotificationSound(true, 'notification').catch(() => {});
        }

        callback(payload);
    });
};

export { messaging };
