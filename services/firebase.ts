// Firebase está inicializado de forma lazy (dentro de funciones) para evitar
// que un error en la carga del SDK crashee toda la aplicación.

let messagingInstance: any = null;

const getFirebaseMessaging = async () => {
    if (messagingInstance) return messagingInstance;
    try {
        const { initializeApp } = await import("firebase/app");
        const { getMessaging } = await import("firebase/messaging");

        const firebaseConfig = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID
        };

        // Si no hay configuración de Firebase, no inicializar
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            console.warn("Firebase: variables de entorno no configuradas. Notificaciones desactivadas.");
            return null;
        }

        const app = initializeApp(firebaseConfig);
        messagingInstance = getMessaging(app);
        return messagingInstance;
    } catch (error) {
        console.warn("Firebase: no se pudo inicializar el servicio de mensajería:", error);
        return null;
    }
};

export const requestNotificationPermission = async (): Promise<string | null> => {
    try {
        // Verificar soporte del browser
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
            console.warn("Firebase: este browser no soporta notificaciones.");
            return null;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return null;

        const { getToken } = await import("firebase/messaging");
        const messaging = await getFirebaseMessaging();
        if (!messaging) return null;

        const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });

        if (token) {
            localStorage.setItem("fcm_token", token);
            return token;
        }
    } catch (error) {
        console.warn("Firebase: error obteniendo token de notificación:", error);
    }
    return null;
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        getFirebaseMessaging().then(messaging => {
            if (!messaging) return;
            import("firebase/messaging").then(({ onMessage }) => {
                onMessage(messaging, (payload) => resolve(payload));
            });
        });
    });
