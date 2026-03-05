import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD9tJXbbzcOjhn_pbRKYQmyeeyEi_nl1Bc",
    authDomain: "sociedad-rural-norte.firebaseapp.com",
    projectId: "sociedad-rural-norte",
    storageBucket: "sociedad-rural-norte.firebasestorage.app",
    messagingSenderId: "559939075419",
    appId: "1:559939075419:web:1d5a72f4468556ad0c2e7e",
    measurementId: "G-NG8X0DGVEZ"
};

// Intento de inicializar app
let app;
let messaging;

try {
    app = initializeApp(firebaseConfig);
    messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
} catch (error) {
    console.error('Firebase initialization error', error);
}

export const requestForToken = async () => {
    try {
        if (!messaging) return null;
        const currentToken = await getToken(messaging, {
            vapidKey: 'F4oRxGjMVM_lfGVDWMv7_s5qcM77x9fgInBmEEkpvtc'
        });
        if (currentToken) {
            console.log('FCM Token encontrado:', currentToken);
            return currentToken;
        } else {
            console.log('No registration token available. Request permission to generate one.');
            return null;
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
        return null;
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        if (!messaging) return;
        onMessage(messaging, (payload) => {
            console.log("Notificación recibida en foreground: ", payload);
            resolve(payload);
        });
    });

export { messaging };
