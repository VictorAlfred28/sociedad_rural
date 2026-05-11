import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

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

    // Calcular posición segura del dropdown para evitar overflow en mobile
    const computeDropdownPosition = useCallback(() => {
        if (!buttonRef.current) return;

        const btnRect = buttonRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const isMobile = vw < 640; // sm breakpoint

        // Safe area insets (Capacitor/notch devices)
        const safeLeft = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0') || 0;
        const safeRight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sar') || '0') || 0;

        const PANEL_MARGIN = 12; // margen mínimo de los bordes
        const panelMaxWidth = isMobile
            ? Math.min(vw - (PANEL_MARGIN * 2) - safeLeft - safeRight, 400)
            : 384; // 96 * 4 = w-96

        // Intentar alinear a la derecha del botón (right-0 del parent)
        let rightOffset = vw - btnRect.right;

        // Si el panel se sale por la izquierda, corregirlo
        const leftEdge = vw - rightOffset - panelMaxWidth;
        if (leftEdge < PANEL_MARGIN + safeLeft) {
            rightOffset = vw - panelMaxWidth - PANEL_MARGIN - safeLeft;
        }
        // Si se sale por la derecha, también corregirlo
        if (rightOffset < PANEL_MARGIN + safeRight) {
            rightOffset = PANEL_MARGIN + safeRight;
        }

        setDropdownStyle({
            position: 'fixed',
            top: btnRect.bottom + 8,
            right: rightOffset,
            width: panelMaxWidth,
            maxWidth: `calc(100vw - ${PANEL_MARGIN * 2}px - env(safe-area-inset-left) - env(safe-area-inset-right))`,
            maxHeight: isMobile ? 'calc(80vh - env(safe-area-inset-bottom))' : '24rem',
            zIndex: 9999,
        });
    }, []);

    // Toggle Dropdown
    const toggleDropdown = () => {
        setIsOpen(prev => {
            if (!prev) {
                // Calcular posición justo antes de abrir
                setTimeout(computeDropdownPosition, 0);
            }
            return !prev;
        });
    };

    // Recalcular al cambiar tamaño
    useEffect(() => {
        if (!isOpen) return;
        computeDropdownPosition();
        window.addEventListener('resize', computeDropdownPosition);
        window.addEventListener('scroll', computeDropdownPosition, true);
        return () => {
            window.removeEventListener('resize', computeDropdownPosition);
            window.removeEventListener('scroll', computeDropdownPosition, true);
        };
    }, [isOpen, computeDropdownPosition]);

    // Cerrar al click afuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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
                ref={buttonRef}
                onClick={toggleDropdown}
                className={`size-12 rounded-full shadow-sm flex items-center justify-center relative transition-all duration-300 outline-none
                    ${isOpen ? 'bg-primary/10 text-primary dark:bg-primary/20 ring-2 ring-primary/30 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-md'}
                    ${isPulsing ? 'animate-bounce' : ''}
                `}
            >
                <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? 'scale-110' : ''}`}>
                    {unreadCount > 0 ? 'notifications_active' : 'notifications'}
                </span>

                {/* Badge bolita roja con número */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full shadow-sm border-2 border-white dark:border-slate-800 animate-in zoom-in">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Lista */}
            {isOpen && (
                <div
                    style={dropdownStyle}
                    className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 transform origin-top-right">
                    
                    {/* Header */}
                    <div className="px-5 py-4 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 z-10 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-lg tracking-tight">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    {unreadCount} nuevas
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button 
                                onClick={markAllAsRead}
                                className="text-xs font-semibold text-primary/80 hover:text-primary transition-colors flex items-center gap-1 bg-transparent hover:bg-primary/5 px-2 py-1 rounded-md"
                            >
                                <span className="material-symbols-outlined text-[14px]">done_all</span>
                                Marcar leídas
                            </button>
                        )}
                    </div>

                    {/* Contenido (con scroll suave) */}
                    <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col relative bg-white dark:bg-slate-900 custom-scrollbar">
                        {isLoading && notifications.length === 0 ? (
                            <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-3 animate-spin opacity-50">refresh</span>
                                <p className="text-sm font-medium">Cargando...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                <div className="size-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 shadow-inner">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">notifications_off</span>
                                </div>
                                <p className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">Bandeja Vacía</p>
                                <p className="text-sm text-slate-500 dark:text-slate-500">No tenés notificaciones por el momento.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`p-4 transition-all duration-200 relative group cursor-pointer 
                                            ${!notif.leido 
                                                ? 'bg-primary/5 hover:bg-primary/10' 
                                                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'} 
                                        `}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Icono */}
                                            <div className={`shrink-0 size-11 rounded-full flex items-center justify-center mt-1 shadow-sm
                                                ${!notif.leido 
                                                    ? 'bg-primary text-white' 
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}
                                                ${notif.titulo.toLowerCase().includes('soporte') && !notif.leido ? 'bg-amber-500 text-white' : ''}
                                            `}>
                                                <span className="material-symbols-outlined text-[20px]">
                                                    {getIconForType(notif.titulo, notif.tipo)}
                                                </span>
                                            </div>
                                            
                                            {/* Texto */}
                                            <div className="flex-1 pr-8">
                                                <div className="flex flex-col mb-1.5">
                                                    <p className={`text-[15px] leading-tight ${!notif.leido ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                                                        {notif.titulo}
                                                    </p>
                                                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
                                                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                        {timeAgo(notif.created_at)}
                                                    </span>
                                                </div>
                                                <p className={`text-sm leading-relaxed line-clamp-3 ${!notif.leido ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-500'}`}>
                                                    {notif.mensaje}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Acciones flotantes */}
                                        <div className="absolute top-4 right-3 flex flex-col gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                                            {!notif.leido && (
                                                <button 
                                                    onClick={(e) => markAsRead(notif.id, e)}
                                                    className="size-8 rounded-full bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-slate-600 flex items-center justify-center text-primary hover:bg-primary hover:text-white hover:border-primary transition-colors"
                                                    title="Marcar como leída"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">done</span>
                                                </button>
                                            )}
                                            <button 
                                                onClick={(e) => deleteNotification(notif.id, e)}
                                                className="size-8 rounded-full bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 hover:border-red-500 transition-colors"
                                                title="Eliminar"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                        
                                        {/* Indicador visual de "no leído" */}
                                        {!notif.leido && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
