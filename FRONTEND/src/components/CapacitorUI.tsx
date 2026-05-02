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

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        /**
         * Envía el token FCM al backend.
         * Si no hay sesión activa, lo guarda en localStorage como "pendiente"
         * para enviarlo al navegar post-login (ver efecto de retry abajo).
         */
        const sendTokenToBackend = async (tokenValue: string): Promise<boolean> => {
            const authToken = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!authToken) {
                localStorage.setItem('fcm_token_pending', tokenValue);
                console.warn('[Push] Sin sesión activa — token FCM guardado como pendiente.');
                return false;
            }

            // Deduplicación local: si ya enviamos este token exacto, no re-enviamos
            const lastSent = localStorage.getItem('fcm_token_sent');
            if (lastSent === tokenValue) {
                console.log('[Push] Token sin cambios — ya registrado en backend.');
                return true;
            }

            try {
                const res = await fetch(`${API_URL}/api/push-tokens`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({ token: tokenValue, plataforma: 'android' }),
                });

                if (res.ok) {
                    localStorage.setItem('fcm_token_sent', tokenValue);
                    localStorage.removeItem('fcm_token_pending');
                    console.log('[Push] ✅ Token FCM registrado en backend.');
                    return true;
                } else {
                    const body = await res.text();
                    console.error(`[Push] ❌ Backend rechazó token. Status: ${res.status} — ${body}`);
                    return false;
                }
            } catch (e) {
                console.error('[Push] ❌ Error de red al registrar token:', e);
                return false;
            }
        };

        const setupPushNotifications = async () => {
            try {
                let permResult = await PushNotifications.checkPermissions();

                if (permResult.receive === 'prompt') {
                    permResult = await PushNotifications.requestPermissions();
                }

                if (permResult.receive !== 'granted') {
                    console.warn('[Push] Permiso denegado — sin notificaciones push.');
                    return;
                }

                // Aislado: si falla register (ej. falta google-services.json) no crashea la app
                try {
                    await PushNotifications.register();
                } catch (regError) {
                    console.warn('[Push] PushNotifications.register() falló:', regError);
                    return;
                }

                // Token nuevo o refresh de FCM
                PushNotifications.addListener('registration', async (token) => {
                    console.log('[Push] FCM Token obtenido:', token.value);
                    await sendTokenToBackend(token.value);
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
                console.error('[Push] Error crítico en setup — la app continúa sin push:', e);
            }
        };

        setupPushNotifications();

        return () => {
            PushNotifications.removeAllListeners();
        };
    }, [navigate]);

    // --- Retry: enviar token pendiente cuando hay sesión activa ---
    // Se dispara en cada cambio de ruta (cubre el caso post-login navigation)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const pendingToken = localStorage.getItem('fcm_token_pending');
        if (!pendingToken) return;

        const authToken = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!authToken) return;

        // Si ya fue enviado exitosamente, limpiar el pendiente
        const alreadySent = localStorage.getItem('fcm_token_sent');
        if (alreadySent === pendingToken) {
            localStorage.removeItem('fcm_token_pending');
            return;
        }

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        fetch(`${API_URL}/api/push-tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ token: pendingToken, plataforma: 'android' }),
        })
            .then(async (res) => {
                if (res.ok) {
                    localStorage.setItem('fcm_token_sent', pendingToken);
                    localStorage.removeItem('fcm_token_pending');
                    console.log('[Push] ✅ Token pendiente enviado post-login.');
                } else {
                    console.warn('[Push] Token pendiente rechazado. Se reintentará en la próxima navegación.');
                }
            })
            .catch((e) => console.error('[Push] Error enviando token pendiente:', e));
    }, [location.pathname]);

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
