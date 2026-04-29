import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/ui/PasswordInput';
import { motion } from 'framer-motion';

export default function CambioPassword() {
    const { token, logout, updateUser } = useAuth();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (password.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (password === 'Familia1234') {
            setErrorMsg('No puedes usar la contraseña temporal como nueva contraseña.');
            return;
        }

        if (password !== confirmPassword) {
            setErrorMsg('Las contraseñas no coinciden');
            return;
        }

        setIsLoading(true);

        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ new_password: password })
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.detail || 'Error al actualizar contraseña');
            }

            setSuccessMsg('¡Contraseña actualizada con éxito! Redirigiendo...');

            // Actualizar objeto de sesión en memoria para que el guard no vuelva a redirigir
            updateUser({ must_change_password: false, password_changed: true });

            setTimeout(() => {
                navigate('/home');
            }, 2000);

        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col font-display bg-[#f4eedd] text-stone-900 dark:text-stone-100 max-w-md mx-auto shadow-2xl overflow-x-hidden">
            {/* Fondo con imagen sutil */}
            <div 
                className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
                style={{
                    backgroundImage: "url('/src/assets/vaquita.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat"
                }}
            ></div>

            <div className="relative z-10 flex-1 flex flex-col">
                <header className="flex flex-col gap-2 p-8 pb-4 pt-12 items-center text-center">
                    <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="size-20 flex items-center justify-center rounded-[2rem] bg-[#245b31] text-white shadow-xl mb-4"
                    >
                        <span className="material-symbols-outlined text-4xl">lock_reset</span>
                    </motion.div>
                    <h1 className="text-3xl font-black text-stone-800 dark:text-white uppercase italic tracking-tighter font-display leading-none">Seguridad</h1>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mt-2 max-w-[240px]">
                        Actualiza tu contraseña para proteger tu cuenta
                    </p>
                </header>

                <main className="flex-1 p-6 space-y-8 flex flex-col">
                    <section className="bg-white dark:bg-stone-800 p-8 rounded-[2.5rem] shadow-xl border border-stone-200/50 dark:border-stone-700/50 space-y-6 relative overflow-hidden">
                        {/* Ornamento */}
                        <div className="absolute -top-4 -right-4 p-6 text-[#245b31]/5 opacity-10 pointer-events-none">
                            <span className="material-symbols-outlined text-7xl">shield</span>
                        </div>

                        {successMsg && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 text-[10px] font-black uppercase tracking-widest text-center"
                            >
                                {successMsg}
                            </motion.div>
                        )}

                        {errorMsg && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 text-[10px] font-black uppercase tracking-widest text-center"
                            >
                                {errorMsg}
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                                <PasswordInput
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-14 w-full rounded-2xl bg-stone-50 dark:bg-stone-900 px-6 text-sm font-bold shadow-sm outline-none border border-stone-200 dark:border-stone-800 focus:border-[#245b31] transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                                <PasswordInput
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-14 w-full rounded-2xl bg-stone-50 dark:bg-stone-900 px-6 text-sm font-bold shadow-sm outline-none border border-stone-200 dark:border-stone-800 focus:border-[#245b31] transition-all"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !!successMsg}
                                className="w-full py-5 rounded-[2rem] bg-[#245b31] text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-[#245b31]/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
                            </button>
                        </form>
                    </section>

                    <div className="text-center pt-4">
                        <button 
                            onClick={logout} 
                            className="text-stone-400 font-black uppercase tracking-[0.3em] text-[10px] hover:text-[#784e32] transition-colors decoration-[#784e32]/30 underline underline-offset-8"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}
