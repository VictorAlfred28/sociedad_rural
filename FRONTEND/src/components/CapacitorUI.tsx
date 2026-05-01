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
                // Verificar permisos antes de registrar
                let permResult = await PushNotifications.checkPermissions();
                
                if (permResult.receive === 'prompt') {
                    permResult = await PushNotifications.requestPermissions();
                }

                if (permResult.receive !== 'granted') {
                    console.warn('[Push] Permiso denegado — sin notificaciones push.');
                    return;
                }

                // Registrar solo si hay permisos — aislado en su propio try/catch
                // para que un fallo de FCM/google-services.json no crashee la app
                try {
                    await PushNotifications.register();
                } catch (regError) {
                    console.warn('[Push] PushNotifications.register() falló (¿falta google-services.json?):', regError);
                    return; // Seguimos sin push, la app continúa normalmente
                }

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

                PushNotifications.addListener('registrationError', (err) => {
                    console.error('[Push] Error de registro FCM:', err.error);
                });

                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    toast(notification.title || 'Nueva notificación', {
                        icon: '🔔',
                        duration: 5000,
                    });
                });

                PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                    const data = action.notification.data;
                    if (data?.route) {
                        navigate(data.route);
                    }
                });
            } catch (e) {
                console.error('[Push] Error crítico en setup push notifications — la app continúa sin push:', e);
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
