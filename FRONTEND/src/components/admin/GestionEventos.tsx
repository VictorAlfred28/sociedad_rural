import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface Evento {
    id: string;
    titulo: string;
    descripcion: string;
    lugar: string;
    fecha: string;
    hora: string;
    tipo: string;
    imagen_url: string | null;
    municipio_id?: string;
    link_instagram?: string;
    link_facebook?: string;
    link_whatsapp?: string;
    link_externo?: string;
    estado?: string;
    destacado?: boolean;
    publico?: boolean;
    slug?: string;
    created_at: string;
    status?: 'borrador' | 'aprobado' | 'rechazado'; // Para eventos sociales
    fuente?: string;
    external_id?: string;
}

export default function GestionEventos() {
    const { token, user } = useAuth();
    const [activeSubTab, setActiveSubTab] = useState<'inst' | 'social'>('inst');
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [socialEventos, setSocialEventos] = useState<Evento[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingIsSocial, setEditingIsSocial] = useState(false);
    const [municipios, setMunicipios] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        titulo: '',
        descripcion: '',
        lugar: '',
        fecha: '',
        hora: '',
        tipo: 'Remate',
        imagen_url: '',
        municipio_id: '',
        link_instagram: '',
        link_facebook: '',
        link_whatsapp: '',
        link_externo: '',
        estado: 'borrador',
        destacado: false,
        publico: true,
    });
    const [formLoading, setFormLoading] = useState(false);

    const fetchEventos = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            setError('');
            const url = activeSubTab === 'inst'
                ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/eventos`
                : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos-sociales`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al obtener eventos');

            if (activeSubTab === 'inst') {
                // Filtrar solo los creados por admin
                setEventos(data.eventos.filter((ev: any) => ev.fuente === 'admin') || []);
            } else {
                // Mapear para que use campos consistentes (ahora vienen directos de BD)
                const normalized = (data.eventos || []).filter((ev: any) => ev.fuente !== 'admin').map((ev: any) => ({
                    ...ev,
                    status: ev.estado === 'publicado' ? 'aprobado' : ev.estado === 'borrador' ? 'borrador' : 'rechazado'
                }));
                setSocialEventos(normalized);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchEventos();
    }, [token, activeSubTab]);

    useEffect(() => {
        const fetchMunicipios = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`);
                const data = await res.json();
                setMunicipios(data.municipios || []);
            } catch (err) {
                console.error('Error fetching municipios', err);
            }
        };
        fetchMunicipios();
    }, []);

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');

        try {
            let url = '';
            let payload: any = {};
            let method = '';

            if (editingId) {
                if (editingIsSocial) {
                    url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos-sociales/${editingId}`;
                    method = 'PUT';
                    payload = {
                        titulo: formData.titulo,
                        descripcion: formData.descripcion,
                        lugar: formData.lugar,
                        fecha: formData.fecha,
                        hora: formData.hora,
                        imagen_url: formData.imagen_url
                    };
                } else {
                    url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos/${editingId}`;
                    method = 'PUT';
                    payload = formData;
                }
            } else {
                url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos`;
                method = 'POST';
                payload = formData;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || `Error al ${editingId ? 'actualizar' : 'crear'} evento`);

            resetForm();
            await fetchEventos(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdateSocialStatus = async (id: string, newStatus: string) => {
        try {
            setActionLoading(id);
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos-sociales/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus === 'aprobado' ? 'publicado' : newStatus === 'borrador' ? 'borrador' : 'cancelado' })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Error al actualizar estado');
            }
            await fetchEventos(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleEditClick = (evento: Evento, isSocial: boolean = false) => {
        setFormData({
            titulo: evento.titulo,
            descripcion: evento.descripcion,
            lugar: evento.lugar,
            fecha: evento.fecha || '',
            hora: evento.hora || '',
            tipo: evento.tipo || 'Remate',
            imagen_url: evento.imagen_url || '',
            municipio_id: evento.municipio_id || '',
            link_instagram: evento.link_instagram || '',
            link_facebook: evento.link_facebook || '',
            link_whatsapp: evento.link_whatsapp || '',
            link_externo: evento.link_externo || '',
            estado: evento.estado || 'borrador',
            destacado: evento.destacado || false,
            publico: evento.publico !== undefined ? evento.publico : true,
        });
        setEditingId(evento.id);
        setEditingIsSocial(isSocial);
        setShowAddForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setFormData({
            titulo: '', descripcion: '', lugar: '', fecha: '', hora: '',
            tipo: 'Remate', imagen_url: '', municipio_id: '',
            link_instagram: '', link_facebook: '', link_whatsapp: '',
            link_externo: '', estado: 'borrador', destacado: false, publico: true
        });
        setEditingId(null);
        setEditingIsSocial(false);
        setShowAddForm(false);
    };

    const handleDelete = async (id: string, titulo: string, isSocial: boolean) => {
        if (!window.confirm(`¿Seguro que deseas eliminar el evento "${titulo}"?`)) return;
        try {
            setActionLoading(id);
            const path = isSocial ? 'eventos-sociales' : 'eventos';
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/${path}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al eliminar');
            await fetchEventos(true);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const inputClass = "w-full bg-admin-bg border border-admin-border rounded-xl h-11 px-4 text-sm text-admin-text outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2";

    return (
        <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden shadow-lg">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                    <span className="material-symbols-outlined text-4xl animate-spin text-admin-accent">
                        refresh
                    </span>
                    <p className="font-semibold tracking-wide">Cargando eventos...</p>
                </div>
            ) : (activeSubTab === 'inst' ? eventos : socialEventos).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                    <span className="material-symbols-outlined text-5xl opacity-50">
                        calendar_month
                    </span>
                    <p className="font-semibold tracking-wide">
                        No hay eventos registrados.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                    {(activeSubTab === 'inst' ? eventos : socialEventos).map(ev => {
                        const fechaStr = ev.fecha || null;
                        const dateObj = fechaStr ? new Date(fechaStr + 'T' + (ev.hora || '12:00:00')) : null;
                        const isPast = dateObj ? dateObj < new Date() : false;

                        const isInstagram =
                            activeSubTab === 'social' && !(ev.external_id?.startsWith('manual_'));

                        const fallbackImage =
                            'https://via.placeholder.com/400x250/242424/4ade80?text=Evento+Rural';

                        const imageSrc = ev.imagen_url || fallbackImage;

                        return (
                            <div key={ev.id} className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden hover:border-admin-accent/30 hover:shadow-lg hover:shadow-admin-accent/5 transition-all duration-300 group flex flex-col relative">

                                {/* overlay loading */}
                                {actionLoading === ev.id && (
                                    <div className="absolute inset-0 bg-admin-bg/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-admin-accent">
                                        <span className="material-symbols-outlined animate-spin text-4xl mb-2">
                                            refresh
                                        </span>
                                        <span className="text-sm font-bold">Guardando...</span>
                                    </div>
                                )}

                                {/* imagen */}
                                <div className="relative h-48 w-full overflow-hidden bg-admin-bg/50">
                                    <img
                                        src={imageSrc}
                                        alt={ev.titulo}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        onError={(e) => {
                                            e.currentTarget.src = fallbackImage;
                                        }}
                                    />
                                </div>

                                {/* contenido */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <h4 className="font-bold text-admin-text text-lg mb-4 line-clamp-2">
                                        {ev.titulo}
                                    </h4>

                                    <div className="text-sm text-slate-400 space-y-2 mt-auto">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">
                                                calendar_today
                                            </span>
                                            {ev.fecha ? (
                                                <span className={isPast ? "line-through opacity-60" : ""}>
                                                    {new Date(ev.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                                                </span>
                                            ) : (
                                                <span className="italic">Fecha a confirmar</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
