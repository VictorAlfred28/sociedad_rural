import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { PushNotifications } from '@capacitor/push-notifications';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

export const CapacitorUI = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const wasOffline = useRef(false);

    // --- Push Notifications Setup ---
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const setupPushNotifications = async () => {
            try {
                // 1. Solicitar permiso
                const permResult = await PushNotifications.requestPermissions();
                if (permResult.receive !== 'granted') {
                    console.warn('[Push] Permiso denegado.');
                    return;
                }

                // 2. Registrar dispositivo con FCM
                await PushNotifications.register();

                // 3. Recibir el FCM Token y guardarlo en el backend
                PushNotifications.addListener('registration', async (token) => {
                    console.log('[Push] FCM Token:', token.value);
                    try {
                        const authToken = localStorage.getItem('token') || sessionStorage.getItem('token');
                        if (!authToken) return;
                        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/push/register-token`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`,
                            },
                            body: JSON.stringify({ token: token.value, plataforma: 'android' }),
                        });
                    } catch (e) {
                        console.error('[Push] Error al registrar token:', e);
                    }
                });

                // 4. Error en registro
                PushNotifications.addListener('registrationError', (err) => {
                    console.error('[Push] Error de registro FCM:', err.error);
                });

                // 5. Notificación recibida con app en primer plano → mostrar toast
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    toast(notification.title || 'Nueva notificación', {
                        icon: '🔔',
                        duration: 5000,
                    });
                });

                // 6. Tappear una notificación → navegar al destino
                PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                    const data = action.notification.data;
                    if (data?.route) {
                        navigate(data.route);
                    }
                });
            } catch (e) {
                console.error('[Push] Error setup push notifications:', e);
            }
        };

        setupPushNotifications();

        return () => {
            PushNotifications.removeAllListeners();
        };
    }, [navigate]);

    // --- Capacitor UI Setup (StatusBar, SplashScreen, Back Button, Network) ---
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const setupCapacitorUI = async () => {
            try {
                await StatusBar.setStyle({ style: Style.Dark });
                await StatusBar.setBackgroundColor({ color: '#245b31' });
                await SplashScreen.hide();
            } catch (e) {
                console.error('Error setting up Capacitor UI', e);
            }
        };

        setupCapacitorUI();

        const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                if (location.pathname === '/home' || location.pathname === '/login') {
                    CapacitorApp.exitApp();
                } else {
                    navigate(-1);
                }
            } else {
                CapacitorApp.exitApp();
            }
        });

        const networkListener = Network.addListener('networkStatusChange', status => {
            if (!status.connected) {
                wasOffline.current = true;
                toast.error('Sin conexión a Internet. Modo Offline activo.', { duration: 5000 });
            } else if (status.connected && wasOffline.current) {
                wasOffline.current = false;
                toast.success('¡Conexión restaurada!', { duration: 3000 });
            }
        });

        Network.getStatus().then(status => {
            if (!status.connected) {
                wasOffline.current = true;
                toast.error('Sin conexión a Internet. Modo Offline activo.', { duration: 5000 });
            }
        });

        return () => {
            backButtonListener.then(listener => listener.remove());
            networkListener.then(listener => listener.remove());
        };
    }, [navigate, location]);

    return null;
};
