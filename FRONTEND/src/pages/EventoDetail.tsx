import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import paisaje from '../assets/paisaje.png';

interface EventoDetailData {
    id: string;
    titulo: string;
    descripcion: string;
    lugar: string;
    fecha?: string;
    fecha_evento?: string;
    hora?: string;
    tipo: string;
    imagen_url: string | null;
    link_instagram?: string;
    link_facebook?: string;
    link_whatsapp?: string;
    link_externo?: string;
    slug?: string;
    metadata?: any;
}

export default function EventoDetail() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();
    
    const [evento, setEvento] = useState<EventoDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const fetchEvento = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/eventos/${slug}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Evento no encontrado');
                setEvento(data.evento);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        if (slug) fetchEvento();
    }, [slug, token]);

    const getImage = (ev: EventoDetailData) => {
        if (ev.imagen_url) return ev.imagen_url;
        if (ev.tipo === 'Social') return 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?q=80&w=800&auto=format&fit=crop';
        if (ev.tipo === 'Remate') return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop';
        if (ev.tipo === 'Festival' || ev.tipo === 'Exposición') return 'https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=800&auto=format&fit=crop';
        return 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=800&auto=format&fit=crop';
    };

    const getBadgeClass = (tipo: string) => {
        if (tipo === 'Social') return 'bg-gradient-to-r from-purple-600 to-pink-600';
        if (tipo === 'Remate') return 'bg-amber-700';
        return 'bg-emerald-700';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-900 max-w-md mx-auto shadow-2xl">
                <div className="flex flex-col items-center gap-4 text-emerald-700">
                    <span className="material-symbols-outlined text-4xl animate-spin">autorenew</span>
                    <p className="font-bold text-xs uppercase tracking-widest">Cargando detalle...</p>
                </div>
            </div>
        );
    }

    if (error || !evento) {
        return (
            <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-900 max-w-md mx-auto shadow-2xl">
                <header className="flex items-center p-4">
                    <button onClick={() => navigate('/eventos')} className="text-stone-800 dark:text-stone-100 flex size-10 items-center justify-center rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                </header>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-500">
                    <span className="material-symbols-outlined text-5xl mb-4 text-red-400">error</span>
                    <h2 className="text-xl font-bold text-stone-800 dark:text-stone-200 mb-2">Evento no encontrado</h2>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    const fechaStr = evento.fecha_evento || evento.fecha || (evento.metadata?.timestamp ? evento.metadata.timestamp.split('T')[0] : null);
    const dateObj = fechaStr ? new Date(fechaStr + 'T' + (evento.hora || '12:00:00')) : null;
    const esSocial = evento.tipo === 'Social';
    const lugarDisplay = evento.lugar && evento.lugar !== 'A definir' ? evento.lugar : null;

    // Manejo de Carousel y Video para Instagram
    const isVideo = evento.metadata?.media_type === 'VIDEO';
    const isCarousel = evento.metadata?.media_type === 'CAROUSEL_ALBUM' && evento.metadata?.children?.data?.length > 0;

    return (
        <div className="relative min-h-screen flex flex-col font-display bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 md:max-w-3xl md:border-x md:border-stone-200 dark:md:border-stone-800 mx-auto shadow-2xl overflow-x-hidden">
            {/* Fondo sutil */}
            <div
                className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
                style={{
                    backgroundImage: `url(${paisaje})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat"
                }}
            ></div>

            {/* Header Flotante Transparente */}
            <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
                <button 
                    onClick={() => navigate(-1)} 
                    className="flex size-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md hover:bg-black/40 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <button className="flex size-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md hover:bg-black/40 transition-colors">
                    <span className="material-symbols-outlined">share</span>
                </button>
            </header>

            <div className="relative z-10 flex-1 pb-24">
                {/* Hero Media */}
                <div className="relative w-full md:aspect-[16/9] aspect-[4/3] bg-stone-900 flex items-center justify-center overflow-hidden">
                    {isVideo ? (
                        <video 
                            src={evento.metadata?.original_media_url || evento.imagen_url || ''} 
                            controls 
                            playsInline
                            className="w-full h-full object-contain bg-black"
                            poster={evento.imagen_url || undefined}
                        />
                    ) : isCarousel ? (
                        <div className="relative w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar" onScroll={(e) => {
                            const scrollLeft = (e.target as HTMLElement).scrollLeft;
                            const width = (e.target as HTMLElement).clientWidth;
                            setCurrentSlide(Math.round(scrollLeft / width));
                        }}>
                            {evento.metadata.children.data.map((child: any, idx: number) => (
                                <div key={child.id || idx} className="w-full h-full shrink-0 snap-center relative flex items-center justify-center bg-black">
                                    {child.media_type === 'VIDEO' ? (
                                        <video src={child.media_url} controls playsInline className="w-full h-full object-contain" />
                                    ) : (
                                        <img src={child.media_url} alt={`${evento.titulo} - ${idx}`} className="w-full h-full object-contain" />
                                    )}
                                </div>
                            ))}
                            {/* Indicadores de Carousel */}
                            <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1.5 z-20">
                                {evento.metadata.children.data.map((_: any, idx: number) => (
                                    <div key={idx} className={`h-1.5 rounded-full transition-all ${currentSlide === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <img 
                            src={getImage(evento)} 
                            alt={evento.titulo}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?q=80&w=800&auto=format&fit=crop';
                                e.currentTarget.onerror = null;
                            }}
                            className="w-full h-full object-cover"
                        />
                    )}
                    
                    {!isVideo && !isCarousel && <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent pointer-events-none"></div>}
                    
                    <div className={`absolute bottom-6 left-6 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-lg flex items-center gap-1.5 z-20 ${getBadgeClass(evento.tipo || 'Social')}`}>
                        {esSocial && <span style={{ fontSize: '12px' }}>📱</span>}
                        {evento.tipo || 'Redes'}
                    </div>
                </div>

                {/* Contenido */}
                <div className="relative -mt-6 z-30 bg-stone-50 dark:bg-stone-900 rounded-t-3xl px-6 py-8 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                    <h1 className="text-2xl font-bold leading-tight font-display italic text-stone-800 dark:text-stone-100 uppercase tracking-tighter mb-4">
                        {evento.titulo}
                    </h1>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {dateObj ? (
                            <div className="flex flex-col bg-white dark:bg-stone-800 p-3 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 shadow-sm">
                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Fecha</span>
                                <span className="text-sm font-bold text-stone-800 dark:text-stone-200">
                                    {dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                </span>
                                <span className="text-xs text-stone-500 font-medium">
                                    {evento.hora ? evento.hora.slice(0, 5) + ' HS' : 'A confirmar'}
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col bg-white dark:bg-stone-800 p-3 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 shadow-sm">
                                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Fecha</span>
                                <span className="text-sm font-bold text-stone-800 dark:text-stone-200">A confirmar</span>
                            </div>
                        )}

                        <div className="flex flex-col bg-white dark:bg-stone-800 p-3 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 shadow-sm">
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Ubicación</span>
                            {lugarDisplay ? (
                                <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(lugarDisplay)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-bold text-stone-800 dark:text-stone-200 hover:text-emerald-600 transition-colors line-clamp-2"
                                >
                                    {lugarDisplay}
                                </a>
                            ) : (
                                <span className="text-sm font-bold text-stone-500">A definir</span>
                            )}
                        </div>
                    </div>

                    {/* Descripcion */}
                    <div className="mb-8">
                        <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 uppercase tracking-widest mb-3">
                            Acerca del Evento
                        </h3>
                        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-line">
                            {evento.descripcion || "No hay detalles adicionales para este evento."}
                        </p>
                    </div>

                    {/* Botones Sociales / Acciones */}
                    <div className="flex flex-col gap-3">
                        {(!evento.link_externo && !evento.link_whatsapp && !evento.link_instagram && !evento.link_facebook) ? (
                            <div className="text-xs font-bold text-stone-400 uppercase tracking-widest text-center mt-4">
                                No hay enlaces asociados a este evento.
                            </div>
                        ) : (
                            <>
                                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">
                                    Enlaces de Interés
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {evento.link_externo && (
                                        <a 
                                            href={evento.link_externo} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 font-bold uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform shadow-md"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                            Más Información / Entradas
                                        </a>
                                    )}
                                    {evento.link_whatsapp && (
                                        <a 
                                            href={evento.link_whatsapp.startsWith('http') ? evento.link_whatsapp : `https://wa.me/${evento.link_whatsapp.replace(/[^0-9]/g, '')}`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#25D366] text-white font-bold uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform shadow-md"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">chat</span>
                                            Consultar por WhatsApp
                                        </a>
                                    )}
                                    {evento.link_instagram && (
                                        <a 
                                            href={evento.link_instagram} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform shadow-md"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                                            Ver en Instagram
                                        </a>
                                    )}
                                    {evento.link_facebook && (
                                        <a 
                                            href={evento.link_facebook} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#1877F2] text-white font-bold uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform shadow-md"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                                            Ver en Facebook
                                        </a>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
