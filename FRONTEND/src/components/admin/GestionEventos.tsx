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
    created_at: string;
    status?: 'borrador' | 'aprobado' | 'rechazado'; // Para eventos sociales
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

    // Form State
    const [formData, setFormData] = useState({
        titulo: '',
        descripcion: '',
        lugar: '',
        fecha: '',
        hora: '',
        tipo: 'Remate',
        imagen_url: '',
    });
    const [formLoading, setFormLoading] = useState(false);

    const fetchEventos = async () => {
        try {
            setLoading(true);
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
                setEventos(data.eventos || []);
            } else {
                // Mapear para que use campos consistentes
                const normalized = (data.eventos || []).map((ev: any) => ({
                    ...ev,
                    fecha: ev.fecha_evento,
                    hora: ev.hora_evento,
                    descripcion: ev.descripcion_limpia
                }));
                setSocialEventos(normalized);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEventos();
    }, [token, activeSubTab]);

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
                        descripcion_limpia: formData.descripcion,
                        lugar: formData.lugar,
                        fecha_evento: formData.fecha,
                        hora_evento: formData.hora,
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
            fetchEventos();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdateSocialStatus = async (id: string, newStatus: string) => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos-sociales/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Error al actualizar estado');
            }
            fetchEventos();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
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
        });
        setEditingId(evento.id);
        setEditingIsSocial(isSocial);
        setShowAddForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setFormData({ titulo: '', descripcion: '', lugar: '', fecha: '', hora: '', tipo: 'Remate', imagen_url: '' });
        setEditingId(null);
        setEditingIsSocial(false);
        setShowAddForm(false);
    };

    const handleDelete = async (id: string, titulo: string, isSocial: boolean) => {
        if (!window.confirm(`¿Seguro que deseas eliminar el evento "${titulo}"?`)) return;
        try {
            const path = isSocial ? 'eventos-sociales' : 'eventos';
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/${path}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al eliminar');
            fetchEventos();
        } catch (err: any) {
            alert(err.message);
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
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-admin-border/50 bg-admin-bg/50">
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Evento</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Fecha y Hora</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Lugar</th>
                                    {activeSubTab === 'social' && <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Estado</th>}
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-admin-border/50">
                                {(activeSubTab === 'inst' ? eventos : socialEventos).map(ev => {
                                    const fechaStr = ev.fecha || null;
                                    const dateObj = fechaStr ? new Date(fechaStr + 'T' + (ev.hora || '12:00:00')) : null;
                                    const isPast = dateObj ? dateObj < new Date() : false;

                                    return (
                                        <tr key={ev.id} className="hover:bg-admin-card-hover/50 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 border ${ev.tipo === 'Remate' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                                                        ev.tipo === 'Festival' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' :
                                                            'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                                        }`}>
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            {ev.tipo === 'Remate' ? 'gavel' : ev.tipo === 'Festival' ? 'stadium' : 'event'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-admin-text line-clamp-1">{ev.titulo}</h4>
                                                        <span className="text-xs text-slate-400 font-mono mt-0.5 inline-block">{ev.tipo}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col text-sm">
                                                    {ev.fecha ? (
                                                        <>
                                                            <span className={`font-semibold ${isPast ? 'text-slate-500 line-through decoration-slate-500/50' : 'text-admin-text'}`}>
                                                                {new Date(ev.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                                            </span>
                                                            <span className="text-slate-400 font-mono text-xs">{ev.hora ? ev.hora.slice(0, 5) + ' HS' : 'Hora a confirmar'}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic">Fecha a confirmar</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                {ev.lugar && ev.lugar !== 'A definir' ? (
                                                    <a
                                                        href={`https://maps.google.com/?q=${encodeURIComponent(ev.lugar)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-semibold text-admin-text line-clamp-1 flex items-center gap-1.5 opacity-80 hover:text-admin-accent transition-colors group/link"
                                                        title="Ver en Google Maps"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px] group-hover/link:animate-bounce">pin_drop</span>
                                                        <span className="group-hover/link:underline">{ev.lugar}</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-slate-500 italic">Lugar a confirmar</span>
                                                )}
                                            </td>
                                            {activeSubTab === 'social' && (
                                                <td className="py-4 px-6 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${ev.status === 'aprobado' ? 'bg-admin-approved/10 text-admin-approved border border-admin-approved/20' :
                                                        ev.status === 'rechazado' ? 'bg-admin-rejected/10 text-admin-rejected border border-admin-rejected/20' :
                                                            'bg-admin-pending/10 text-admin-pending border border-admin-pending/20'
                                                        }`}>
                                                        {ev.status}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-end gap-2">
                                                    {activeSubTab === 'inst' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleEditClick(ev)}
                                                                title="Editar evento"
                                                                className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-accent hover:bg-admin-accent/10 transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(ev.id, ev.titulo, false)}
                                                                title="Eliminar evento"
                                                                className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-rejected hover:bg-admin-rejected/10 transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {user?.rol === 'ADMIN' ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleEditClick(ev, true)}
                                                                        title="Editar evento"
                                                                        className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-accent hover:bg-admin-accent/10 transition-colors"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                                                    </button>
                                                                    {ev.status !== 'aprobado' && (
                                                                        <button
                                                                            onClick={() => handleUpdateSocialStatus(ev.id, 'aprobado')}
                                                                            title="Aprobar: hacer público para los socios"
                                                                            className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold text-admin-approved bg-admin-approved/10 hover:bg-admin-approved/20 border border-admin-approved/20 hover:border-admin-approved/40 transition-all"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                                                            Aprobar
                                                                        </button>
                                                                    )}
                                                                    {ev.status !== 'rechazado' && (
                                                                        <button
                                                                            onClick={() => handleUpdateSocialStatus(ev.id, 'rechazado')}
                                                                            title="Rechazar / Ocultar evento"
                                                                            className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-rejected hover:bg-admin-rejected/10 transition-colors"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[20px]">cancel</span>
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleDelete(ev.id, ev.titulo, true)}
                                                                        title="Eliminar permanentemente"
                                                                        className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-rejected hover:bg-admin-rejected/10 transition-colors"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-slate-500 italic">Solo Admin</span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}
