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
    const items = promociones.length > 0 ? promociones : DEFAULT_ITEMS;

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
        <div className="relative w-full h-44 overflow-hidden rounded-[32px] bg-slate-200 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
            <AnimatePresence mode="wait">
                <motion.div
                    key={current.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className={`absolute inset-0 bg-gradient-to-br ${cfg.color} p-6 flex flex-col justify-center text-white`}
                >
                    {/* Background Image if exists */}
                    {current.imagen_url && (
                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                            <img src={current.imagen_url} alt="" className="w-full h-full object-cover" />
                        </div>
                    )}

                    <div className="flex items-center gap-5 relative z-10">
                        <div className="size-16 rounded-[22px] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg overflow-hidden shrink-0">
                            {current.imagen_url ? (
                                <img src={current.imagen_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {cfg.icon}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                    {current.comercio?.nombre_apellido || 'S.R.N.C'}
                                </span>
                                {current.descuento_porcentaje && (
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white text-slate-900 px-2 py-0.5 rounded-full">
                                        -{current.descuento_porcentaje}%
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-black tracking-tight leading-tight mb-1 uppercase italic truncate">
                                {current.titulo}
                            </h3>
                            <p className="text-white/90 text-xs font-medium leading-snug line-clamp-2 max-w-[220px]">
                                {current.descripcion}
                            </p>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="absolute top-6 right-6 z-20">
                        <button
                            onClick={() => onViewPromotion(current.comercio)}
                            className="bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                            Ver Promo
                        </button>
                    </div>

                    {/* Indicators */}
                    {items.length > 1 && (
                        <div className="absolute bottom-4 left-6 flex gap-1.5 z-10">
                            {items.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                                />
                            ))}
                        </div>
                    )}

                    <div className="absolute bottom-0 right-0 p-4 opacity-10 pointer-events-none translate-x-1/4 translate-y-1/4">
                        <span className="material-symbols-outlined text-[120px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {cfg.icon}
                        </span>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
