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
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-admin-text tracking-tight">Gestión de Eventos</h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Administra eventos institucionales e importados de redes sociales.
                    </p>
                </div>
                {(activeSubTab === 'inst' || showAddForm) && (
                    <button
                        onClick={() => {
                            if (showAddForm) resetForm();
                            else setShowAddForm(true);
                        }}
                        className={`h-11 px-6 rounded-xl font-bold text-sm flex items-center gap-2 admin-transition relative overflow-hidden group ${showAddForm
                            ? 'bg-admin-card border border-admin-border text-admin-text hover:bg-admin-card-hover'
                            : 'bg-admin-accent text-admin-bg hover:bg-admin-accent/90'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {showAddForm ? 'close' : 'add'}
                        </span>
                        {showAddForm ? 'Cancelar' : 'Nuevo Evento'}
                    </button>
                )}
            </div>

            {/* Sub Tabs */}
            <div className="flex bg-admin-card border border-admin-border p-1 rounded-2xl self-start">
                <button
                    onClick={() => setActiveSubTab('inst')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${activeSubTab === 'inst' ? 'bg-admin-accent text-admin-bg shadow-lg shadow-admin-accent/20' : 'text-slate-400 hover:text-admin-text'}`}
                >
                    Institucionales
                </button>
                <button
                    onClick={() => setActiveSubTab('social')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${activeSubTab === 'social' ? 'bg-admin-accent text-admin-bg shadow-lg shadow-admin-accent/20' : 'text-slate-400 hover:text-admin-text'}`}
                >
                    Redes Sociales (Make)
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-admin-rejected/10 border border-admin-rejected/20 text-admin-rejected text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined">error</span>
                    {error}
                </div>
            )}

            {/* Add Form Container */}
            {showAddForm && (activeSubTab === 'inst' || editingIsSocial) && (
                <div className="bg-admin-card border border-admin-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-admin-accent/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <h3 className="text-lg font-bold text-admin-text mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-admin-accent">event_note</span>
                        {editingId ? 'Editar Evento' : 'Crear Nuevo Evento'}
                    </h3>

                    <form onSubmit={handleAddSubmit} className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Título del Evento</label>
                            <input
                                type="text"
                                required
                                className={inputClass}
                                placeholder="Ej. Gran Remate Anual de Reproductores"
                                value={formData.titulo}
                                onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Tipo</label>
                            <select
                                title="tipo"
                                className={inputClass}
                                value={formData.tipo}
                                onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                disabled={editingIsSocial}
                            >
                                <option value="Remate">Remate</option>
                                <option value="Festival">Festival</option>
                                <option value="Exposición">Exposición</option>
                                <option value="Charla">Charla / Conferencia</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Municipio *</label>
                            <select
                                required
                                className={inputClass}
                                value={formData.municipio_id}
                                onChange={e => setFormData({ ...formData, municipio_id: e.target.value })}
                                disabled={editingIsSocial}
                            >
                                <option value="">Seleccione un municipio</option>
                                {municipios.map((m: any) => (
                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Lugar</label>
                            <input
                                type="text"
                                required
                                className={inputClass}
                                placeholder="Ej. Predio Ferial SRNC"
                                value={formData.lugar}
                                onChange={e => setFormData({ ...formData, lugar: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Fecha</label>
                            <input
                                type="date"
                                required
                                className={inputClass}
                                value={formData.fecha}
                                onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Hora</label>
                            <input
                                type="time"
                                required
                                className={inputClass}
                                value={formData.hora}
                                onChange={e => setFormData({ ...formData, hora: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className={labelClass}>URL de Imagen (Opcional)</label>
                            <input
                                type="url"
                                className={inputClass}
                                placeholder="https://ejemplo.com/imagen.jpg"
                                value={formData.imagen_url}
                                onChange={e => setFormData({ ...formData, imagen_url: e.target.value })}
                            />
                            <p className="text-xs text-slate-500 mt-1">Si se deja vacío, se mostrará una imagen por defecto según el tipo de evento.</p>
                        </div>

                        <div>
                            <label className={labelClass}>Instagram URL</label>
                            <input
                                type="url"
                                className={inputClass}
                                placeholder="https://instagram.com/..."
                                value={formData.link_instagram}
                                onChange={e => setFormData({ ...formData, link_instagram: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Facebook URL</label>
                            <input
                                type="url"
                                className={inputClass}
                                placeholder="https://facebook.com/..."
                                value={formData.link_facebook}
                                onChange={e => setFormData({ ...formData, link_facebook: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>WhatsApp (URL o Número)</label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Ej. wa.me/..."
                                value={formData.link_whatsapp}
                                onChange={e => setFormData({ ...formData, link_whatsapp: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Link Externo (Web, Entradas)</label>
                            <input
                                type="url"
                                className={inputClass}
                                placeholder="https://..."
                                value={formData.link_externo}
                                onChange={e => setFormData({ ...formData, link_externo: e.target.value })}
                            />
                        </div>

                        {!editingIsSocial && (
                            <div>
                                <label className={labelClass}>Estado</label>
                                <select
                                    className={inputClass}
                                    value={formData.estado}
                                    onChange={e => setFormData({ ...formData, estado: e.target.value })}
                                >
                                    <option value="borrador">Borrador</option>
                                    <option value="publicado">Publicado</option>
                                    <option value="cancelado">Cancelado</option>
                                    <option value="finalizado">Finalizado</option>
                                </select>
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className={labelClass}>Descripción</label>
                            <textarea
                                required
                                className={`${inputClass} min-h-[100px] py-3 resize-y`}
                                placeholder="Detalles sobre el evento..."
                                value={formData.descripcion}
                                onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={formLoading}
                                className="h-11 px-8 rounded-xl bg-admin-accent text-admin-bg font-bold flex items-center gap-2 hover:bg-admin-accent/90 disabled:opacity-50 transition-all"
                            >
                                {formLoading ? (
                                    <span className="material-symbols-outlined animate-spin">refresh</span>
                                ) : (
                                    <span className="material-symbols-outlined">save</span>
                                )}
                                {formLoading ? 'Guardando...' : editingId ? 'Actualizar Evento' : 'Guardar Evento'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Events List */}
            <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden shadow-lg">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                        <span className="material-symbols-outlined text-4xl animate-spin text-admin-accent">refresh</span>
                        <p className="font-semibold tracking-wide">Cargando eventos...</p>
                    </div>
                ) : (activeSubTab === 'inst' ? eventos : socialEventos).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                        <span className="material-symbols-outlined text-5xl opacity-50">calendar_month</span>
                        <p className="font-semibold tracking-wide">No hay eventos registrados.</p>
                    </div>
                ) : (
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                        {(activeSubTab === 'inst' ? eventos : socialEventos).map(ev => {
                            const fechaStr = ev.fecha || null;
                            const dateObj = fechaStr ? new Date(fechaStr + 'T' + (ev.hora || '12:00:00')) : null;
                            const isPast = dateObj ? dateObj < new Date() : false;
                            
                            // Detectar si es de Instagram
                            const isInstagram = activeSubTab === 'social' && !(ev.external_id?.startsWith('manual_'));
                            
                            // Imagen con fallback
                            const fallbackImage = 'https://via.placeholder.com/400x250/242424/4ade80?text=Evento+Rural';
                            const imageSrc = ev.imagen_url || fallbackImage;

                            return (
                                <div key={ev.id} className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden hover:border-admin-accent/30 hover:shadow-lg hover:shadow-admin-accent/5 transition-all duration-300 group flex flex-col relative">
                                    {/* Overlay de carga por evento */}
                                    {actionLoading === ev.id && (
                                        <div className="absolute inset-0 bg-admin-bg/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-admin-accent transition-all">
                                            <span className="material-symbols-outlined animate-spin text-4xl mb-2">refresh</span>
                                            <span className="text-sm font-bold tracking-wide">Guardando...</span>
                                        </div>
                                    )}
                                    
                                    <div className="relative h-48 w-full overflow-hidden bg-admin-bg/50">
                                        <img 
                                            src={imageSrc} 
                                            alt={ev.titulo} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                            onError={(e) => { e.currentTarget.src = fallbackImage; }} 
                                        />
                                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                                            {activeSubTab === 'social' && (
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md shadow-sm border ${
                                                    ev.status === 'aprobado' ? 'bg-admin-approved/90 text-admin-bg border-admin-approved/50' :
                                                    ev.status === 'rechazado' ? 'bg-admin-rejected/90 text-admin-bg border-admin-rejected/50' :
                                                    'bg-admin-pending/90 text-admin-bg border-admin-pending/50'
                                                }`}>
                                                    {ev.status}
                                                </span>
                                            )}
                                        </div>
                                        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                                             <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-black/60 text-white backdrop-blur-md shadow-sm border border-white/10">
                                                {ev.tipo || 'Evento'}
                                             </span>
                                             {isInstagram && (
                                                 <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center gap-1.5 shadow-md">
                                                     <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                                                     Instagram
                                                 </span>
                                             )}
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <h4 className="font-bold text-admin-text text-lg line-clamp-2 mb-4 group-hover:text-admin-accent transition-colors leading-tight">{ev.titulo}</h4>
                                        <div className="flex flex-col gap-3 text-sm text-slate-400 mt-auto">
                                            <div className="flex items-center gap-2.5">
                                                <span className="material-symbols-outlined text-[18px] text-slate-500">calendar_today</span>
                                                {ev.fecha ? (
                                                    <span className={`${isPast ? 'line-through decoration-slate-500/50 opacity-70' : 'text-slate-300'}`}>
                                                        {new Date(ev.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                                        {ev.hora && ` - ${ev.hora.slice(0, 5)} HS`}
                                                    </span>
                                                ) : (
                                                    <span className="italic">Fecha a confirmar</span>
                                                )}
                                            </div>
                                            <div className="flex items-start gap-2.5">
                                                <span className="material-symbols-outlined text-[18px] text-slate-500 mt-0.5">location_on</span>
                                                {ev.lugar && ev.lugar !== 'A definir' ? (
                                                    <a
                                                        href={`https://maps.google.com/?q=${encodeURIComponent(ev.lugar)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="line-clamp-2 hover:text-admin-accent hover:underline transition-colors cursor-pointer text-slate-300"
                                                        title="Ver en Google Maps"
                                                    >
                                                        {ev.lugar}
                                                    </a>
                                                ) : (
                                                    <span className="italic">Lugar a confirmar</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Acciones */}
                                        <div className="mt-5 pt-4 border-t border-admin-border/50 flex items-center justify-end gap-2">
                                            {activeSubTab === 'inst' ? (
                                                <>
                                                    <button onClick={() => handleEditClick(ev)} disabled={actionLoading !== null} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-accent hover:bg-admin-accent/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title="Editar">
                                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                                    </button>
                                                    <button onClick={() => handleDelete(ev.id, ev.titulo, false)} disabled={actionLoading !== null} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-rejected hover:bg-admin-rejected/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title="Eliminar">
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {user?.rol === 'ADMIN' ? (
                                                        <>
                                                            <button onClick={() => handleEditClick(ev, true)} disabled={actionLoading !== null} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-accent hover:bg-admin-accent/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title="Editar">
                                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                                            </button>
                                                            {ev.status !== 'aprobado' && (
                                                                <button onClick={() => handleUpdateSocialStatus(ev.id, 'aprobado')} disabled={actionLoading !== null} className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold text-admin-approved bg-admin-approved/10 hover:bg-admin-approved/20 border border-admin-approved/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title="Aprobar">
                                                                    <span className="material-symbols-outlined text-[16px]">check_circle</span> Aprobar
                                                                </button>
                                                            )}
                                                            {ev.status !== 'rechazado' && (
                                                                <button onClick={() => handleUpdateSocialStatus(ev.id, 'rechazado')} disabled={actionLoading !== null} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-rejected hover:bg-admin-rejected/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title="Rechazar">
                                                                    <span className="material-symbols-outlined text-[20px]">cancel</span>
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleDelete(ev.id, ev.titulo, true)} disabled={actionLoading !== null} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-rejected hover:bg-admin-rejected/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title="Eliminar">
                                                                <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-slate-500 italic">Solo Admin</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

        </div>
    );
}
