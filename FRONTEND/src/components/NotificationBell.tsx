import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { requestForToken, onMessageListener } from '../firebase';
import { playNotificationSound } from '../utils/soundNotification';

interface Notification {
    id: string;
    titulo: string;
    mensaje: string;
    leido: boolean;
    link_url?: string;
    created_at: string;
    tipo?: string;
}

export default function NotificationBell() {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Cargar notificaciones
    const loadNotifications = async () => {
        if (!token) return;
        try {
            setIsLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/notificaciones`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (res.status === 401) {
                window.dispatchEvent(new Event('auth-unauthorized'));
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notificaciones);
                setUnreadCount(data.no_leidas);
            }
        } catch (err) {
            console.error("Error cargando notificaciones", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Solicitar permiso Push y mandar Token a backend
    const setupPushNotifications = async () => {
        if (!token) return;
        
        // Bloqueo crítico: Evitar que Firebase Web pise la lógica nativa
        if (Capacitor.isNativePlatform()) {
            console.log("Entorno Nativo detectado: Delegando push a CapacitorUI");
            return;
        }

        try {
            const fcmToken = await requestForToken();
            if (fcmToken) {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/push-tokens`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ token: fcmToken, plataforma: 'web' })
                });
            }
        } catch (error) {
            console.error("Permiso Push denegado o error: ", error);
        }
    };

    useEffect(() => {
        if (user) {
            loadNotifications();
            // Solo intentamos pedir permiso al navegador si el usuario interactua o tras unos segundos
            const timer = setTimeout(() => {
                setupPushNotifications();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [user, token]);

    // Listener Foreground FCM (Firebase) - escucha continua con cleanup
    useEffect(() => {
        const unsubscribe = onMessageListener(async (payload: any) => {
            // Cuando llega algo mientras la app está abierta, recargamos notificaciones
            loadNotifications();
            
            // Animación sutil de la campanita
            setIsPulsing(true);
            setTimeout(() => setIsPulsing(false), 2000);

            // Reproducir sonido si el usuario lo tiene habilitado
            if (user?.sonido_notificaciones_habilitado ?? true) {
                await playNotificationSound(true, 'notification');
            }
        });

        // Cleanup: desregistrar listener al desmontar componente
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [user?.sonido_notificaciones_habilitado]);

    // Listener: Deep Link desde click en notificación del OS (Service Worker)
    useEffect(() => {
        const handleSWMessage = (event: MessageEvent) => {
            if (event.data?.type === 'NOTIFICATION_CLICK') {
                const link = event.data.link;
                if (link && link !== '/') {
                    navigate(link);
                }
                loadNotifications(); // Refrescar badge al volver
            }
        };
        navigator.serviceWorker?.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    }, [navigate]);

    // Toggle Dropdown
    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    // Cerrar al click afuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    // Formato Fecha amigable
    const timeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);

        if (diffMins < 1) return `Recién`;
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        return `Hace ${diffDays} d`;
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0) return;
        const previousCount = unreadCount;
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, leido: true })));
        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/notificaciones/marcar-leidas`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error("Fallo al marcar leídas", err);
            setUnreadCount(previousCount);
            loadNotifications();
        }
    };

    const markAsRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const notif = notifications.find(n => n.id === id);
        if (!notif || notif.leido) return;

        setNotifications(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/notificaciones/${id}/leer`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error("Fallo al marcar leída individual", err);
            loadNotifications();
        }
    };

    const deleteNotification = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const notif = notifications.find(n => n.id === id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (notif && !notif.leido) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }

        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/notificaciones/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error("Fallo al eliminar notificación", err);
            loadNotifications();
        }
    };

    const handleNotificationClick = (notif: Notification) => {
        if (!notif.leido) {
            markAsRead(notif.id, { stopPropagation: () => {} } as React.MouseEvent);
        }
        if (notif.link_url && notif.link_url !== '/') {
            navigate(notif.link_url);
            setIsOpen(false);
        }
    };

    const getIconForType = (titulo: string, tipo?: string) => {
        const lowerTitle = titulo.toLowerCase();
        if (lowerTitle.includes("soporte") || tipo === "soporte") return "priority_high";
        if (lowerTitle.includes("pago") || tipo === "pago") return "payments";
        if (lowerTitle.includes("promoción") || lowerTitle.includes("oferta") || tipo === "promocion") return "sell";
        if (lowerTitle.includes("evento") || tipo === "evento") return "event";
        if (lowerTitle.includes("bienvenido") || lowerTitle.includes("registro")) return "waving_hand";
        return "notifications";
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Botón de la campanita */}
            <button
                onClick={toggleDropdown}
                className={`size-12 rounded-full shadow-md flex items-center justify-center relative transition-all duration-300 outline-none
                    ${isOpen ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}
                    ${isPulsing ? 'animate-bounce' : ''}
                `}
            >
                <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? 'scale-110' : ''}`}>
                    {unreadCount > 0 ? 'notifications_active' : 'notifications'}
                </span>

                {/* Badge bolita roja con número */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full shadow border-2 border-white dark:border-slate-800 animate-in zoom-in">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Lista */}
            {isOpen && (
                <div className="absolute right-0 sm:right-0 -right-20 mt-3 w-[90vw] sm:w-96 max-h-[80vh] sm:max-h-96 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col animate-in fade-in slide-in-from-top-4 origin-top-right">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg tracking-tight">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    {unreadCount} nuevas
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button 
                                onClick={markAllAsRead}
                                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-[14px]">done_all</span>
                                Marcar leídas
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50 relative">
                        {isLoading && notifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 animate-spin">refresh</span>
                                <p className="text-sm">Cargando...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400">
                                <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                                    <span className="material-symbols-outlined text-3xl opacity-50">notifications_off</span>
                                </div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No tenés notificaciones por el momento.</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Te avisaremos cuando haya novedades.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`p-4 transition-colors relative group cursor-pointer border-l-4 
                                        ${!notif.leido ? 'bg-primary/5 hover:bg-primary/10 border-primary' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent'} 
                                    `}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`shrink-0 size-10 rounded-full flex items-center justify-center mt-0.5
                                            ${!notif.leido ? 'bg-primary/20 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}
                                            ${notif.titulo.includes('Soporte') ? 'bg-amber-100 text-amber-600' : ''}
                                        `}>
                                            <span className="material-symbols-outlined text-xl">
                                                {getIconForType(notif.titulo, notif.tipo)}
                                            </span>
                                        </div>
                                        
                                        <div className="flex-1 pr-6">
                                            <p className={`text-sm mb-0.5 ${!notif.leido ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
                                                {notif.titulo}
                                            </p>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2 line-clamp-2">
                                                {notif.mensaje}
                                            </p>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                {timeAgo(notif.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Botones de acción en hover (Desktop) o siempre visibles (Mobile) */}
                                    <div className="absolute top-4 right-2 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        {!notif.leido && (
                                            <button 
                                                onClick={(e) => markAsRead(notif.id, e)}
                                                className="size-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                                                title="Marcar como leída"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">done</span>
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => deleteNotification(notif.id, e)}
                                            className="size-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Eliminar"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </div>
                                    
                                    {!notif.leido && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"></div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
