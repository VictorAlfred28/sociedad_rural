import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface Municipio {
    id: string;
    nombre: string;
    provincia: string;
    descripcion?: string;
    imagen_principal?: string;
    activo: boolean;
}

export interface Evento {
    id: string;
    municipio_id: string;
    titulo: string;
    subtitulo?: string;
    slug: string;
    tipo: string;
    organizador?: string;
    contacto?: string;
    lugar: string;
    direccion?: string;
    coordenadas_lat?: number;
    coordenadas_lng?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    es_evento_de_un_dia: boolean;
    estado: 'borrador' | 'publicado' | 'cancelado' | 'finalizado';
    destacado: boolean;
    publico: boolean;
    imagen_principal?: string;
    galeria_imagenes?: any[];
    video_url?: string;
    link_instagram?: string;
    link_facebook?: string;
    link_whatsapp?: string;
    link_externo?: string;
    descripcion_corta?: string;
    descripcion_larga?: string;
    precio?: string;
    capacidad?: number;
    requiere_inscripcion: boolean;
    created_at?: string;
}

export default function GestionEventos() {
    const { token, user } = useAuth();
    const [activeSubTab, setActiveSubTab] = useState<'inst' | 'social'>('inst');
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Evento>({
        id: '',
        municipio_id: '',
        titulo: '',
        subtitulo: '',
        slug: '',
        tipo: 'Remate',
        organizador: '',
        contacto: '',
        lugar: '',
        direccion: '',
        fecha_inicio: '',
        fecha_fin: '',
        es_evento_de_un_dia: true,
        estado: 'borrador',
        destacado: false,
        publico: true,
        imagen_principal: '',
        galeria_imagenes: [],
        video_url: '',
        link_instagram: '',
        link_facebook: '',
        link_whatsapp: '',
        link_externo: '',
        descripcion_corta: '',
        descripcion_larga: '',
        precio: '',
        requiere_inscripcion: false,
    });
    const [formLoading, setFormLoading] = useState(false);

    const fetchMunicipios = async () => {
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al obtener municipios');
            setMunicipios(data.municipios || []);
        } catch (err: any) {
            logger.error(f"Error fetching municipios: {err.message}");
        }
    };

    const fetchEventos = async () => {
        try {
            setLoading(true);
            setError('');
            const url = activeSubTab === 'inst'
                ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos`
                : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos-sociales`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al obtener eventos');

            setEventos(data.eventos || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMunicipios();
        fetchEventos();
    }, [token, activeSubTab]);

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.municipio_id) {
            setError('Debe seleccionar un municipio');
            return;
        }

        setFormLoading(true);
        setError('');

        try {
            const url = editingId
                ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos/${editingId}`
                : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos`;
            
            const payload = { ...formData };
            
            const res = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
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

    const handleEditClick = (evento: Evento) => {
        setFormData(evento);
        setEditingId(evento.id);
        setShowAddForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setFormData({
            id: '',
            municipio_id: '',
            titulo: '',
            subtitulo: '',
            slug: '',
            tipo: 'Remate',
            organizador: '',
            contacto: '',
            lugar: '',
            direccion: '',
            fecha_inicio: '',
            fecha_fin: '',
            es_evento_de_un_dia: true,
            estado: 'borrador',
            destacado: false,
            publico: true,
            imagen_principal: '',
            galeria_imagenes: [],
            video_url: '',
            link_instagram: '',
            link_facebook: '',
            link_whatsapp: '',
            link_externo: '',
            descripcion_corta: '',
            descripcion_larga: '',
            precio: '',
            requiere_inscripcion: false,
        });
        setEditingId(null);
        setShowAddForm(false);
    };

    const handleDelete = async (id: string, titulo: string) => {
        if (!window.confirm(`¿Seguro que deseas eliminar el evento "${titulo}"?`)) return;
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/eventos/${id}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al eliminar');
            fetchEventos();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const inputClass = "w-full bg-admin-bg border border-admin-border rounded-xl h-11 px-4 text-sm text-admin-text outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2";
    const selectClass = `${inputClass} appearance-none bg-[image:url('data:image/svg+xml;utf8,<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')] bg-no-repeat bg-right pr-10`;

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-admin-text tracking-tight">Gestión de Eventos Avanzada</h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Administra eventos por municipio con integración de redes sociales.
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
                    Eventos Institucionales
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-admin-rejected/10 border border-admin-rejected/20 text-admin-rejected text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined">error</span>
                    {error}
                </div>
            )}

            {/* Add Form Container */}
            {showAddForm && activeSubTab === 'inst' && (
                <div className="bg-admin-card border border-admin-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-admin-accent/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <h3 className="text-lg font-bold text-admin-text mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-admin-accent">event_note</span>
                        {editingId ? 'Editar Evento' : 'Crear Nuevo Evento'}
                    </h3>

                    <form onSubmit={handleAddSubmit} className="relative z-10 space-y-8">
                        {/* SECCIÓN: MUNICIPIO */}
                        <div className="bg-admin-bg/50 rounded-xl p-4 border border-admin-border/50">
                            <h4 className="text-sm font-bold text-admin-accent mb-4 uppercase tracking-wider">Municipio</h4>
                            <select
                                required
                                className={selectClass}
                                value={formData.municipio_id || ''}
                                onChange={e => setFormData({ ...formData, municipio_id: e.target.value })}
                            >
                                <option value="">Seleccionar municipio...</option>
                                {municipios.map(m => (
                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* SECCIÓN: DATOS PRINCIPALES */}
                        <div className="bg-admin-bg/50 rounded-xl p-4 border border-admin-border/50">
                            <h4 className="text-sm font-bold text-admin-accent mb-4 uppercase tracking-wider">Datos Principales</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Título del Evento *</label>
                                    <input
                                        type="text"
                                        required
                                        className={inputClass}
                                        placeholder="Ej. Gran Remate Anual"
                                        value={formData.titulo}
                                        onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Subtítulo</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Ej. De reproductores de raza"
                                        value={formData.subtitulo || ''}
                                        onChange={e => setFormData({ ...formData, subtitulo: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Tipo de Evento *</label>
                                    <select
                                        required
                                        className={selectClass}
                                        value={formData.tipo}
                                        onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                    >
                                        <option value="Remate">Remate</option>
                                        <option value="Festival">Festival</option>
                                        <option value="Exposición">Exposición</option>
                                        <option value="Charla">Charla / Conferencia</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Estado</label>
                                    <select
                                        className={selectClass}
                                        value={formData.estado}
                                        onChange={e => setFormData({ ...formData, estado: e.target.value as any })}
                                    >
                                        <option value="borrador">Borrador (No visible)</option>
                                        <option value="publicado">Publicado</option>
                                        <option value="cancelado">Cancelado</option>
                                        <option value="finalizado">Finalizado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Organizador</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Ej. Sociedad Rural"
                                        value={formData.organizador || ''}
                                        onChange={e => setFormData({ ...formData, organizador: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Contacto (Tel/Email)</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Ej. +54-3764-XXXXX"
                                        value={formData.contacto || ''}
                                        onChange={e => setFormData({ ...formData, contacto: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-4 md:col-span-2 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.destacado}
                                            onChange={e => setFormData({ ...formData, destacado: e.target.checked })}
                                            className="w-4 h-4 rounded accent-admin-accent"
                                        />
                                        <span className="text-sm text-admin-text">Destacar en portada</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.publico}
                                            onChange={e => setFormData({ ...formData, publico: e.target.checked })}
                                            className="w-4 h-4 rounded accent-admin-accent"
                                        />
                                        <span className="text-sm text-admin-text">Público</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: FECHA Y HORA */}
                        <div className="bg-admin-bg/50 rounded-xl p-4 border border-admin-border/50">
                            <h4 className="text-sm font-bold text-admin-accent mb-4 uppercase tracking-wider">Fecha y Hora</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Fecha de Inicio *</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        className={inputClass}
                                        value={formData.fecha_inicio || ''}
                                        onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha de Fin</label>
                                    <input
                                        type="datetime-local"
                                        disabled={formData.es_evento_de_un_dia}
                                        className={`${inputClass} disabled:opacity-50`}
                                        value={formData.fecha_fin || ''}
                                        onChange={e => setFormData({ ...formData, fecha_fin: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.es_evento_de_un_dia}
                                            onChange={e => setFormData({ ...formData, es_evento_de_un_dia: e.target.checked, fecha_fin: '' })}
                                            className="w-4 h-4 rounded accent-admin-accent"
                                        />
                                        <span className="text-sm text-admin-text">Evento de un solo día</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: UBICACIÓN */}
                        <div className="bg-admin-bg/50 rounded-xl p-4 border border-admin-border/50">
                            <h4 className="text-sm font-bold text-admin-accent mb-4 uppercase tracking-wider">Ubicación</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Lugar (Venue) *</label>
                                    <input
                                        type="text"
                                        required
                                        className={inputClass}
                                        placeholder="Ej. Predio Ferial SRNC"
                                        value={formData.lugar}
                                        onChange={e => setFormData({ ...formData, lugar: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Dirección Completa</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Ej. Ruta 14, Km 5, Corrientes"
                                        value={formData.direccion || ''}
                                        onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Latitud (Opcional)</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        className={inputClass}
                                        placeholder="-27.4898"
                                        value={formData.coordenadas_lat || ''}
                                        onChange={e => setFormData({ ...formData, coordenadas_lat: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Longitud (Opcional)</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        className={inputClass}
                                        placeholder="-55.5016"
                                        value={formData.coordenadas_lng || ''}
                                        onChange={e => setFormData({ ...formData, coordenadas_lng: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: REDES SOCIALES (CLAVE DEL SPEC) */}
                        <div className="bg-admin-bg/50 rounded-xl p-4 border border-admin-accent/30 border-dashed">
                            <h4 className="text-sm font-bold text-admin-accent mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">share</span>
                                Redes Sociales ⭐
                            </h4>
                            <p className="text-xs text-slate-400 mb-4">Los botones solo aparecerán si completas estos campos. Deja vacío si no aplica.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Instagram URL</label>
                                    <input
                                        type="url"
                                        className={inputClass}
                                        placeholder="https://instagram.com/..."
                                        value={formData.link_instagram || ''}
                                        onChange={e => setFormData({ ...formData, link_instagram: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Facebook URL</label>
                                    <input
                                        type="url"
                                        className={inputClass}
                                        placeholder="https://facebook.com/..."
                                        value={formData.link_facebook || ''}
                                        onChange={e => setFormData({ ...formData, link_facebook: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>WhatsApp URL</label>
                                    <input
                                        type="url"
                                        className={inputClass}
                                        placeholder="https://wa.me/541234567890"
                                        value={formData.link_whatsapp || ''}
                                        onChange={e => setFormData({ ...formData, link_whatsapp: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Link Externo</label>
                                    <input
                                        type="url"
                                        className={inputClass}
                                        placeholder="https://ejemplo.com/evento"
                                        value={formData.link_externo || ''}
                                        onChange={e => setFormData({ ...formData, link_externo: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: IMÁGENES */}
                        <div className="bg-admin-bg/50 rounded-xl p-4 border border-admin-border/50">
                            <h4 className="text-sm font-bold text-admin-accent mb-4 uppercase tracking-wider">Imágenes</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Imagen Principal</label>
                                    <input
                                        type="url"
                                        className={inputClass}
                                        placeholder="https://ejemplo.com/imagen.jpg"
                                        value={formData.imagen_principal || ''}
                                        onChange={e => setFormData({ ...formData, imagen_principal: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Video URL (YouTube, Vimeo, etc)</label>
                                    <input
                                        type="url"
                                        className={inputClass}
                                        placeholder="https://youtube.com/watch?v=..."
                                        value={formData.video_url || ''}
                                        onChange={e => setFormData({ ...formData, video_url: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: CONTENIDO */}
                        <div className="bg-admin-bg/50 rounded-xl p-4 border border-admin-border/50">
                            <h4 className="text-sm font-bold text-admin-accent mb-4 uppercase tracking-wider">Contenido</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelClass}>Descripción Corta</label>
                                    <textarea
                                        className={`${inputClass} min-h-[80px] py-3 resize-y`}
                                        placeholder="Resumen breve del evento (para preview)"
                                        value={formData.descripcion_corta || ''}
                                        onChange={e => setFormData({ ...formData, descripcion_corta: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Descripción Completa</label>
                                    <textarea
                                        className={`${inputClass} min-h-[120px] py-3 resize-y font-mono text-xs`}
                                        placeholder="Descripción detallada (puede contener HTML)"
                                        value={formData.descripcion_larga || ''}
                                        onChange={e => setFormData({ ...formData, descripcion_larga: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: DATOS ADICIONALES */}
                        <div className="bg-admin-bg/50 rounded-xl p-4 border border-admin-border/50">
                            <h4 className="text-sm font-bold text-admin-accent mb-4 uppercase tracking-wider">Datos Adicionales</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>Precio</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Ej. Gratis o $5000"
                                        value={formData.precio || ''}
                                        onChange={e => setFormData({ ...formData, precio: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Capacidad</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className={inputClass}
                                        placeholder="Ej. 500"
                                        value={formData.capacidad || ''}
                                        onChange={e => setFormData({ ...formData, capacidad: e.target.value ? parseInt(e.target.value) : undefined })}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer w-full h-11 px-4 rounded-xl border border-admin-border bg-admin-bg text-sm">
                                        <input
                                            type="checkbox"
                                            checked={formData.requiere_inscripcion}
                                            onChange={e => setFormData({ ...formData, requiere_inscripcion: e.target.checked })}
                                            className="w-4 h-4 rounded accent-admin-accent"
                                        />
                                        <span className="text-admin-text">Requiere inscripción</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex justify-end gap-4 pt-4 border-t border-admin-border">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="h-11 px-8 rounded-xl border border-admin-border bg-admin-card text-admin-text font-bold hover:bg-admin-card-hover transition-all"
                            >
                                Cancelar
                            </button>
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
                ) : eventos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                        <span className="material-symbols-outlined text-5xl opacity-50">calendar_month</span>
                        <p className="font-semibold tracking-wide">No hay eventos registrados.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-admin-border/50 bg-admin-bg/50">
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Evento</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Municipio</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Redes</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-admin-border/50">
                                {eventos.map(ev => {
                                    const municipio = municipios.find(m => m.id === ev.municipio_id);
                                    const hasRedes = ev.link_instagram || ev.link_facebook || ev.link_whatsapp || ev.link_externo;

                                    return (
                                        <tr key={ev.id} className="hover:bg-admin-card-hover/50 transition-colors">
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
                                                        <span className="text-xs text-slate-400 font-mono">{ev.tipo}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-sm font-semibold text-admin-text">{municipio?.nombre || 'No especificado'}</span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col text-sm">
                                                    {ev.fecha_inicio ? (
                                                        <>
                                                            <span className="font-semibold text-admin-text">
                                                                {new Date(ev.fecha_inicio).toLocaleDateString('es-AR')}
                                                            </span>
                                                            <span className="text-slate-400 font-mono text-xs">
                                                                {new Date(ev.fecha_inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic">Fecha a definir</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${ev.estado === 'publicado' ? 'bg-admin-approved/10 text-admin-approved border border-admin-approved/20' :
                                                    ev.estado === 'cancelado' ? 'bg-admin-rejected/10 text-admin-rejected border border-admin-rejected/20' :
                                                        'bg-admin-pending/10 text-admin-pending border border-admin-pending/20'
                                                    }`}>
                                                    {ev.estado}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-1">
                                                    {ev.link_instagram && <span className="text-xs px-2 py-1 bg-pink-500/10 text-pink-500 rounded-full">IG</span>}
                                                    {ev.link_facebook && <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded-full">FB</span>}
                                                    {ev.link_whatsapp && <span className="text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded-full">WA</span>}
                                                    {!hasRedes && <span className="text-xs text-slate-500">—</span>}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditClick(ev)}
                                                        title="Editar evento"
                                                        className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-accent hover:bg-admin-accent/10 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(ev.id, ev.titulo)}
                                                        title="Eliminar evento"
                                                        className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-admin-rejected hover:bg-admin-rejected/10 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
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
