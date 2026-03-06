import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

export default function Preferencias() {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-x-hidden">
            <div className="flex items-center bg-background-light dark:bg-background-dark p-4 sticky top-0 z-10 border-b border-primary/10 justify-between">
                <Link to="/perfil" className="text-slate-900 dark:text-slate-100 flex size-10 shrink-0 items-center justify-center cursor-pointer">
                    <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Preferencias</h2>
            </div>

            <div className="flex-1 px-4 py-6">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest pb-3 px-2">Visualización</h3>
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-primary/5 overflow-hidden">
                    <div className="flex items-center gap-4 px-4 py-4">
                        <div className="flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 size-10">
                            <span className="material-symbols-outlined">{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
                        </div>
                        <div className="flex flex-col flex-1">
                            <p className="text-slate-700 dark:text-slate-300 text-base font-medium">
                                {theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}
                            </p>
                            <p className="text-slate-400 text-xs">Ajustar apariencia del sistema</p>
                        </div>
                        <div
                            onClick={toggleTheme}
                            className="relative inline-flex items-center cursor-pointer"
                        >
                            <div className={`w-11 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
