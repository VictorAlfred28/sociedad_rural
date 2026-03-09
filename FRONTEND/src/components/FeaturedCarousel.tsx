import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Oferta {
    id: string;
    titulo: string;
    descripcion: string;
    tipo: 'promocion' | 'descuento' | 'beneficio';
    descuento_porcentaje: number | null;
    fecha_fin: string | null;
    imagen_url: string | null;
    comercio?: { nombre_apellido: string; rubro: string; municipio: string };
}

interface FeaturedCarouselProps {
    promociones: Oferta[];
    onViewPromotion: (comercio: any) => void;
}

const TIPO_CFG = {
    promocion: {
        label: 'Promoción', icon: 'local_offer',
        color: 'from-orange-500 to-amber-500',
    },
    descuento: {
        label: 'Descuento', icon: 'percent',
        color: 'from-emerald-600 to-teal-400',
    },
    beneficio: {
        label: 'Beneficio', icon: 'star',
        color: 'from-violet-600 to-indigo-400',
    },
};

const DEFAULT_ITEMS = [
    {
        id: 'd1',
        titulo: 'Beneficios Exclusivos',
        descripcion: 'Descuentos especiales para socios en toda la provincia.',
        tipo: 'promocion' as const,
        descuento_porcentaje: null,
        imagen_url: null,
        comercio: { nombre_apellido: 'Sociedad Rural', rubro: 'Asociación', municipio: 'Provincia' }
    }
];

export default function FeaturedCarousel({ promociones, onViewPromotion }: FeaturedCarouselProps) {
    const [index, setIndex] = useState(0);
    const items = promociones && promociones.length > 0 ? promociones : DEFAULT_ITEMS;

    useEffect(() => {
        if (items.length <= 1) return;
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % items.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [items.length]);

    // Reiniciar índice si cambian los items
    useEffect(() => {
        setIndex(0);
    }, [items.length]);

    const current = items[index];
    const cfg = TIPO_CFG[current.tipo as keyof typeof TIPO_CFG] || TIPO_CFG.promocion;

    return (
        <div className="relative w-full h-44 overflow-hidden rounded-[32px] bg-slate-900 border border-slate-200/50 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none isolate">
            <AnimatePresence mode="wait">
                <motion.div
                    key={current.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute inset-0 p-6 flex flex-col justify-center text-white"
                >
                    {/* Background Layer */}
                    {current.imagen_url ? (
                        <div className="absolute inset-0 -z-10 bg-slate-800">
                            <img src={current.imagen_url} alt="" className="w-full h-full object-cover opacity-90" />
                            {/* Gradient overlay para asegurar contraste en textos pero más claro */}
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/10 to-transparent flex" />
                        </div>
                    ) : (
                        <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${cfg.color}`} />
                    )}

                    {/* Contenido (Textos, Iconos, Botón) */}
                    <div className="flex items-center gap-5 relative z-10 w-full pr-16 text-left">
                        {/* Contenedor Izquierdo: Icono (solo si no hay imagen de fondo) */}
                        {!current.imagen_url && (
                            <div className="size-16 rounded-[22px] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg shrink-0">
                                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {cfg.icon}
                                </span>
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-white/10 text-white px-2.5 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-sm">
                                    {current.comercio?.nombre_apellido || 'S.R.N.C'}
                                </span>
                                {current.descuento_porcentaje && (
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-primary text-slate-900 px-2.5 py-1 rounded-full shadow-[0_0_15px_rgba(255,200,0,0.6)]">
                                        -{current.descuento_porcentaje}%
                                    </span>
                                )}
                            </div>
                            <h3 className="text-xl font-black tracking-tight leading-tight mb-1.5 uppercase italic truncate text-white drop-shadow-md">
                                {current.titulo}
                            </h3>
                            <p className="text-white/80 text-xs font-medium leading-snug line-clamp-2 max-w-[240px]">
                                {current.descripcion}
                            </p>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="absolute top-5 right-5 z-20">
                        <button
                            onClick={() => onViewPromotion(current.comercio)}
                            className="bg-primary hover:bg-primary/90 text-slate-900 pl-4 pr-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-primary/30 flex items-center justify-center gap-1 border border-primary/20 backdrop-blur-sm"
                        >
                            Ver
                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                    </div>

                    {/* Indicators */}
                    {items.length > 1 && (
                        <div className="absolute bottom-4 left-6 flex gap-1.5 z-10">
                            {items.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-primary shadow-[0_0_8px_rgba(255,200,0,0.6)]' : 'w-1.5 bg-white/30'}`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Decoración Icono (solo si no hay imagen de fondo) */}
                    {!current.imagen_url && (
                        <div className="absolute bottom-0 right-0 p-4 opacity-10 pointer-events-none translate-x-1/4 translate-y-1/4 -z-10">
                            <span className="material-symbols-outlined text-[120px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {cfg.icon}
                            </span>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
