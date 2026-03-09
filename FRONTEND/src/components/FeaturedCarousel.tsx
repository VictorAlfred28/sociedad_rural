import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FeaturedItem {
    id: string;
    title: string;
    subtitle: string;
    image?: string;
    color: string;
    icon: string;
}

const ITEMS: FeaturedItem[] = [
    {
        id: '1',
        title: 'Beneficios Exclusivos',
        subtitle: 'Descuentos especiales para socios en toda la provincia.',
        color: 'from-orange-500 to-amber-500',
        icon: 'star'
    },
    {
        id: '2',
        title: 'Red de Comercios',
        subtitle: 'Más de 50 locales adheridos con beneficios directos.',
        color: 'from-emerald-500 to-teal-500',
        icon: 'storefront'
    },
    {
        id: '3',
        title: 'Sociedad Rural',
        subtitle: 'Fortaleciendo el crecimiento de nuestra comunidad.',
        color: 'from-blue-600 to-indigo-500',
        icon: 'agriculture'
    }
];

export default function FeaturedCarousel() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % ITEMS.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-full h-44 overflow-hidden rounded-3xl bg-slate-200 dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <AnimatePresence mode="wait">
                <motion.div
                    key={ITEMS[index].id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className={`absolute inset-0 bg-gradient-to-br ${ITEMS[index].color} p-6 flex flex-col justify-center text-white`}
                >
                    <div className="flex items-center gap-4">
                        <div className="size-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
                            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {ITEMS[index].icon}
                            </span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-black tracking-tight leading-tight mb-1 uppercase italic">
                                {ITEMS[index].title}
                            </h3>
                            <p className="text-white/90 text-sm font-medium leading-snug max-w-[200px]">
                                {ITEMS[index].subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Indicators */}
                    <div className="absolute bottom-4 left-6 flex gap-1.5">
                        {ITEMS.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                            />
                        ))}
                    </div>

                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <span className="material-symbols-outlined text-9xl leading-none">{ITEMS[index].icon}</span>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
