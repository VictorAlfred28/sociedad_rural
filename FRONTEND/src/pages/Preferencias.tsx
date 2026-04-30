import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';
import paisaje from '../assets/paisaje.png';

export default function Preferencias() {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="relative min-h-screen flex flex-col font-display bg-[#f4eedd] text-stone-900 dark:text-stone-100 max-w-md mx-auto shadow-2xl overflow-x-hidden">
            {/* Fondo con imagen sutil */}
            <div 
                className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
                style={{
                    backgroundImage: `url(${paisaje})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat"
                }}
            ></div>

            <div className="relative z-10 flex-1 flex flex-col">
                <header className="sticky top-0 z-50 flex items-center bg-white/80 dark:bg-stone-900/80 backdrop-blur-md p-4 justify-between border-b border-stone-200/50 dark:border-stone-700/50">
                    <Link to="/perfil" className="text-stone-800 dark:text-stone-100 flex size-10 items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <h1 className="text-stone-800 dark:text-stone-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center font-display uppercase italic">Preferencias</h1>
                    <div className="flex w-10"></div>
                </header>

                <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6 space-y-8">
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 px-2">Visualización</h3>
                        <div className="bg-white dark:bg-stone-800 rounded-[2rem] shadow-xl border border-stone-200/50 dark:border-stone-700/50 overflow-hidden">
                            <div className="flex items-center gap-4 p-5">
                                <div className="size-12 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-500 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-stone-800 dark:text-stone-100">
                                        {theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}
                                    </p>
                                    <p className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">Apariencia del sistema</p>
                                </div>
                                <button
                                    onClick={toggleTheme}
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-[#245b31]' : 'bg-stone-200 dark:bg-stone-700'}`}
                                >
                                    <div className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${theme === 'dark' ? 'translate-x-[26px]' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </section>
                </main>

                <BottomNav />
            </div>
        </div>
    );
}
