import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, UserPlus, Tag, Info, Trash2, Loader2, Link as LinkIcon } from 'lucide-react';
import { ApiService } from '../services/api';
import { AppNotification } from '../types';

const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const data = await ApiService.notifications.getAll();
            setNotifications(data);
            setUnreadCount(data.filter((n: any) => !n.read).length);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Polling cada 60 segundos
        const interval = setInterval(fetchNotifications, 60000);

        // Cerrar dropdown al hacer click fuera
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleMarkRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await ApiService.notifications.markRead(id);
            setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleMarkAllRead = async () => {
        setLoading(true);
        try {
            await ApiService.notifications.markAllRead();
            setNotifications(notifications.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'nuevo_socio': return <UserPlus className="w-4 h-4 text-blue-500" />;
            case 'nueva_promo': return <Tag className="w-4 h-4 text-purple-500" />;
            default: return <Info className="w-4 h-4 text-gray-500" />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700 rounded-full transition-colors focus:outline-none"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center transform translate-x-1/2 -translate-y-1/2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white font-bold items-center justify-center border border-white dark:border-slate-800">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-700/50">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            Notificaciones
                            {unreadCount > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{unreadCount} nuevas</span>}
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                disabled={loading}
                                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
                            >
                                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Marcar todas
                            </button>
                        )}
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No tienes notificaciones</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`p-4 border-b border-gray-100 dark:border-slate-700/50 flex gap-3 transition-colors ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'}`}
                                >
                                    <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.read ? 'bg-white dark:bg-slate-700 shadow-sm' : 'bg-gray-100 dark:bg-slate-700 opacity-60'}`}>
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <p className={`text-sm ${!notif.read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-600 dark:text-gray-400'}`}>
                                                {notif.title}
                                            </p>
                                            {!notif.read && (
                                                <button
                                                    onClick={(e) => handleMarkRead(notif.id, e)}
                                                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                    title="Marcar como leída"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                            {notif.message}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                {new Date(notif.created_at).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                            </span>
                                            {notif.link && (
                                                <a
                                                    href={notif.link}
                                                    className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5 hover:underline underline-offset-2"
                                                >
                                                    Ver <LinkIcon className="w-2.5 h-2.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-700/30 border-t border-gray-200 dark:border-slate-700 text-center">
                        <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium">
                            Ver todo el historial
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
