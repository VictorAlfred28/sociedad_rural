import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

export const CapacitorUI = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const wasOffline = useRef(false);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const setupCapacitorUI = async () => {
            try {
                // Configurar StatusBar (Color corporativo verde)
                await StatusBar.setStyle({ style: Style.Dark });
                await StatusBar.setBackgroundColor({ color: '#245b31' });

                // Ocultar SplashScreen ahora que React ha montado
                await SplashScreen.hide();
            } catch (e) {
                console.error("Error setting up Capacitor UI", e);
            }
        };

        setupCapacitorUI();

        // Manejar el botón físico "Atrás" en Android
        const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                // Si la ruta actual es /home, /login o rutas raíz, no volvemos atrás, cerramos la app.
                if (location.pathname === '/home' || location.pathname === '/login') {
                    CapacitorApp.exitApp();
                } else {
                    navigate(-1);
                }
            } else {
                CapacitorApp.exitApp();
            }
        });

        // Manejar eventos de Red (Offline/Online)
        const networkListener = Network.addListener('networkStatusChange', status => {
            if (!status.connected) {
                wasOffline.current = true;
                toast.error('Sin conexión a Internet. Modo Offline activo.', { duration: 5000 });
            } else if (status.connected && wasOffline.current) {
                wasOffline.current = false;
                toast.success('¡Conexión restaurada!', { duration: 3000 });
                // Aquí en el futuro se gatillará el refetch de React Query
            }
        });

        // Verificación inicial de red
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

    return null; // Este componente no renderiza nada, solo maneja efectos secundarios
};
