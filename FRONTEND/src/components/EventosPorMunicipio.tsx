import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Municipio {
    id: string;
    nombre: string;
    provincia: string;
}

interface Evento {
    id: string;
    municipio_id: string;
    titulo: string;
    subtitulo?: string;
    fecha_inicio?: string;
    imagen_principal?: string;
    descripcion_corta?: string;
    lugar: string;
    link_instagram?: string;
    link_facebook?: string;
    link_whatsapp?: string;
    link_externo?: string;
    precio?: string;
    estado: string;
}

export default function EventosPorMunicipio() {
    const { token } = useAuth();
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [municipioSeleccionado, setMunicipioSeleccionado] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchMunicipios();
        fetchEventos();
    }, [token]);

    const fetchMunicipios = async () => {
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al obtener municipios');
            
            const muns = data.municipios || [];
            setMunicipios(muns);
            if (muns.length > 0 && !municipioSeleccionado) {
                setMunicipioSeleccionado(muns[0].id);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const fetchEventos = async () => {
        try {
            setLoading(true);
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/eventos/publicos`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al obtener eventos');
            setEventos(data.eventos || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const eventosFiltrados = municipioSeleccionado
        ? eventos.filter(e => e.municipio_id === municipioSeleccionado)
        : [];

    const handleAbrirDetalle = (evento: Evento) => {
        // Aquí se podría abrir un modal o navegar a una página de detalles
        console.log('Ver detalles de evento:', evento);
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Eventos por Municipio
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Descubre eventos y actividades en tu municipio
                </p>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                    {error}
                </div>
            )}

            {/* Selector de Municipios */}
            <div className="flex flex-wrap gap-2">
                {municipios.map(municipio => (
                    <button
                        key={municipio.id}
                        onClick={() => setMunicipioSeleccionado(municipio.id)}
                        className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                            municipioSeleccionado === municipio.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600'
                        }`}
                    >
                        {municipio.nombre}
                    </button>
                ))}
            </div>

            {/* Contenido */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-slate-600 dark:text-slate-400">Cargando eventos...</p>
                    </div>
                </div>
            ) : eventosFiltrados.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <p className="text-slate-600 dark:text-slate-400 mb-2">No hay eventos en este municipio</p>
                        <p className="text-sm text-slate-500 dark:text-slate-500">
                            Pronto habrá eventos disponibles
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {eventosFiltrados.map(evento => (
                        <div
                            key={evento.id}
                            className="rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow"
                        >
                            {/* Imagen */}
                            <div className="relative h-48 bg-gradient-to-br from-blue-400 to-purple-600 overflow-hidden">
                                {evento.imagen_principal ? (
                                    <img
                                        src={evento.imagen_principal}
                                        alt={evento.titulo}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-6xl text-white/30">📅</span>
                                    </div>
                                )}
                                {evento.precio && (
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-slate-900">
                                        {evento.precio}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-4 flex flex-col h-full">
                                {/* Título */}
                                <div className="mb-3">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                                        {evento.titulo}
                                    </h3>
                                    {evento.subtitulo && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                            {evento.subtitulo}
                                        </p>
                                    )}
                                </div>

                                {/* Fecha */}
                                {evento.fecha_inicio && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-3">
                                        <span className="material-symbols-outlined text-base">calendar_today</span>
                                        {new Date(evento.fecha_inicio).toLocaleDateString('es-AR', {
                                            weekday: 'short',
                                            day: '2-digit',
                                            month: 'short'
                                        })}
                                    </div>
                                )}

                                {/* Ubicación */}
                                {evento.lugar && (
                                    <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 mb-3">
                                        <span className="material-symbols-outlined text-base">location_on</span>
                                        <span className="line-clamp-2">{evento.lugar}</span>
                                    </div>
                                )}

                                {/* Descripción */}
                                {evento.descripcion_corta && (
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                                        {evento.descripcion_corta}
                                    </p>
                                )}

                                {/* Redes Sociales */}
                                {(evento.link_instagram || evento.link_facebook || evento.link_whatsapp || evento.link_externo) && (
                                    <div className="flex flex-wrap gap-2 mb-4 mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                                        {evento.link_instagram && (
                                            <a
                                                href={evento.link_instagram}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 transition-colors text-xs font-semibold"
                                                title="Ver en Instagram"
                                            >
                                                <span className="material-symbols-outlined text-base">public</span>
                                                Instagram
                                            </a>
                                        )}
                                        {evento.link_facebook && (
                                            <a
                                                href={evento.link_facebook}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-semibold"
                                                title="Ver en Facebook"
                                            >
                                                <span className="material-symbols-outlined text-base">public</span>
                                                Facebook
                                            </a>
                                        )}
                                        {evento.link_whatsapp && (
                                            <a
                                                href={evento.link_whatsapp}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors text-xs font-semibold"
                                                title="Contactar por WhatsApp"
                                            >
                                                <span className="material-symbols-outlined text-base">message</span>
                                                WhatsApp
                                            </a>
                                        )}
                                        {evento.link_externo && (
                                            <a
                                                href={evento.link_externo}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 transition-colors text-xs font-semibold"
                                                title="Ver más información"
                                            >
                                                <span className="material-symbols-outlined text-base">link</span>
                                                Más Info
                                            </a>
                                        )}
                                    </div>
                                )}

                                {/* CTA Button */}
                                <button
                                    onClick={() => handleAbrirDetalle(evento)}
                                    className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                                >
                                    Ver Detalles
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
