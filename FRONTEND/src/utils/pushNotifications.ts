import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { playNotificationSound } from './soundNotification';

export const initPushNotifications = async () => {
    if (!Capacitor.isNativePlatform()) {
        console.log('Push notifications not available on web platform');
        return;
    }

    try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            throw new Error('User denied permissions!');
        }

        await PushNotifications.register();

        // Crear canal de notificaciones para Android (Requerido para Android 8.0+)
        if (Capacitor.getPlatform() === 'android') {
            await PushNotifications.createChannel({
                id: 'high_importance_channel',
                name: 'Notificaciones Importantes',
                description: 'Canal principal para notificaciones de la app',
                importance: 5, // 5 = High importance
                visibility: 1, // 1 = Public
                sound: 'notification', // Referencia a notification.mp3 (sin extensión)
                vibration: true,
            });
            console.log('Notification channel created');
        }

        PushNotifications.addListener('registration', (token) => {
            console.log('Push registration success, token: ' + token.value);
            // Send token to backend or save in store
        });

        PushNotifications.addListener('registrationError', (error: any) => {
            console.error('Error on registration: ' + JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
            console.log('Push received: ' + JSON.stringify(notification));
            
            // Reproducir sonido si está habilitado en foreground
            const soundEnabled = notification.data?.sound_enabled !== 'false';
            if (soundEnabled && Capacitor.isNativePlatform()) {
                // En Android/iOS, el sonido se maneja principalmente a través del payload de Firebase
                // Pero podemos reproducir un sonido adicional si es necesario
                await playNotificationSound(true, 'notification');
            }
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push action performed: ' + JSON.stringify(notification));
            // Handle deep linking based on data payload
        });
    } catch (e) {
        console.error('Push notification setup failed', e);
    }
};
