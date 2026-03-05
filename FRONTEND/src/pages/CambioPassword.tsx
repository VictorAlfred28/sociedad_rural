import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/ui/PasswordInput';

export default function CambioPassword() {
    const { token, logout } = useAuth();
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

            setSuccessMsg('¡Contraseña actualizada con éxito!');

            setTimeout(() => {
                // Redirigir a la pantalla principal
                navigate('/home');
            }, 2000);

        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
            <header className="flex flex-col gap-2 p-6 pb-2 pt-12 items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-3xl bg-primary text-slate-900 shadow-md mb-2">
                    <span className="material-symbols-outlined text-3xl">lock_reset</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Cambio de Contraseña</h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Por seguridad, debes actualizar tu contraseña temporal antes de continuar.
                </p>
            </header>

            <main className="flex-1 p-6 flex flex-col justify-center">
                {successMsg && (
                    <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm font-medium text-center">
                        {successMsg}
                    </div>
                )}

                {errorMsg && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium text-center">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5 focus-within:text-primary transition-colors">
                        <label htmlFor="password" className="text-xs font-bold uppercase tracking-widest pl-1">Nueva Contraseña</label>
                        <PasswordInput
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimo 6 caracteres"
                            className="h-12 w-full rounded-xl bg-white dark:bg-slate-900 px-4 text-sm font-medium shadow-sm outline-none border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-400"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5 focus-within:text-primary transition-colors">
                        <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-widest pl-1">Confirmar Contraseña</label>
                        <PasswordInput
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repite tu nueva contraseña"
                            className="h-12 w-full rounded-xl bg-white dark:bg-slate-900 px-4 text-sm font-medium shadow-sm outline-none border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-400"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !!successMsg}
                        className="mt-4 flex w-full items-center justify-center rounded-xl h-14 bg-primary text-slate-900 text-base font-bold shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none">
                        {isLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </button>
                </form>

                <div className="mt-8 text-center pt-8 border-t border-slate-200 dark:border-slate-800">
                    <button onClick={logout} className="text-slate-500 font-medium text-sm underline underline-offset-4 decoration-slate-300">
                        Cerrar Sesión
                    </button>
                </div>
            </main>
        </div>
    );
}
