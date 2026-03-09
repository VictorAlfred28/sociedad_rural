import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestForToken, onMessageListener } from '../firebase';

interface Notification {
    id: string;
    titulo: string;
    mensaje: string;
    leido: boolean;
    link_url?: string;
    created_at: string;
}

export default function NotificationBell() {
    const { user, token } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Cargar notificaciones
    const loadNotifications = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/notificaciones`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notificaciones);
                setUnreadCount(data.no_leidas);
            }
        } catch (err) {
            console.error("Error cargando notificaciones", err);
        }
    };

    // Solicitar permiso Push y mandar Token a backend
    const setupPushNotifications = async () => {
        if (!token) return;
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

    // Listener Foreground FCM (Firebase)
    useEffect(() => {
        onMessageListener()
            .then((payload: any) => {
                // Cuando llega algo mientras la app está abierta, recargamos notificaciones
                loadNotifications();
            })
            .catch((err) => console.log('failed: ', err));
    }, []);

    // Marcar como leídas al abrir
    const toggleDropdown = async () => {
        const newState = !isOpen;
        setIsOpen(newState);
        if (newState && unreadCount > 0) {
            setUnreadCount(0); // optimista
            try {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/notificaciones/marcar-leidas`, {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                // Marcar visualmente locales como leídas
                setNotifications(prev => prev.map(n => ({ ...n, leido: true })));
            } catch (err) {
                console.error(err);
            }
        }
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

        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        return `Hace ${diffDays} d`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Botón de la campanita */}
            <button
                onClick={toggleDropdown}
                className="size-12 rounded-full bg-white dark:bg-slate-800 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-300 relative hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
                <span className="material-symbols-outlined">notifications</span>

                {/* Badge bolita roja animada si hay no leídas */}
                {unreadCount > 0 && (
                    <span className="absolute top-2.5 right-3 size-3 bg-red-500 rounded-full border border-white dark:border-slate-800 shadow-sm animate-pulse flex items-center justify-center">
                        {unreadCount > 9 && <span className="text-[8px] text-white font-bold leading-none absolute">9+</span>}
                    </span>
                )}
            </button>

            {/* Dropdown Lista */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                {unreadCount} nuevas
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50 relative">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_off</span>
                                <p className="text-sm">No tienes notificaciones recientes.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!notif.leido ? 'bg-primary/5' : ''} ${notif.titulo.includes('Soporte') ? 'border-l-4 border-amber-500 bg-amber-500/5' : ''}`}
                                >
                                    <div className="flex items-start gap-2">
                                        {notif.titulo.includes('Soporte') && (
                                            <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">priority_high</span>
                                        )}
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{notif.titulo}</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2 line-clamp-2">{notif.mensaje}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-auto">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">{timeAgo(notif.created_at)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
