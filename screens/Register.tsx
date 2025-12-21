
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [dni, setDni] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Sign up user
            const { data: { user }, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (signUpError) throw signUpError;

            if (user) {
                // 2. Update profile with additional details
                // The trigger has likely already created the row, so we update it.
                // We'll give it a slight delay or just try update.
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        dni: dni,
                        role: 'socio'
                    })
                    .eq('id', user.id);

                if (profileError) {
                    console.error('Error update profile:', profileError);
                    // Don't block registration success if profile update fails, but warn.
                }

                navigate('/');
            }
        } catch (err: any) {
            setError(err.message || 'Error al registrarse');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            <div className="hidden lg:flex w-1/2 bg-surface-dark relative items-center justify-center p-12 text-white">
                <div className="absolute inset-0 bg-black/60 z-10"></div>
                <div className="absolute inset-0 bg-[url('https://picsum.photos/1080/1920?random=101')] bg-cover bg-center"></div>
                <div className="relative z-20 max-w-lg space-y-8 animate-in fade-in zoom-in duration-700">
                    <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-6 shadow-2xl shadow-primary/30">
                        <span className="material-symbols-outlined text-4xl text-black font-bold">person_add</span>
                    </div>
                    <div>
                        <h2 className="text-5xl font-black mb-4 leading-tight">Únete a la <br /> Comunidad</h2>
                        <p className="text-xl text-gray-300">Regístrate para acceder a todos los beneficios, gestionar tus pagos y conectar con comercios.</p>
                    </div>
                </div>
            </div>
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background-light dark:bg-background-dark">
                <div className="w-full max-w-md space-y-8">
                    <div>
                        <h2 className="text-4xl font-black text-text-main dark:text-white">Crear Cuenta</h2>
                        <p className="text-gray-500 mt-3 font-medium">Completa tus datos para registrarte.</p>
                    </div>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl text-sm font-bold">
                            {error}
                        </div>
                    )}
                    <form className="space-y-4" onSubmit={handleRegister}>
                        <div>
                            <label className="block text-sm font-bold text-text-main dark:text-white mb-2">Nombre Completo</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full rounded-2xl border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 focus:ring-primary focus:border-primary shadow-sm"
                                placeholder="Juan Perez"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-text-main dark:text-white mb-2">DNI / CUIT</label>
                            <input
                                type="text"
                                value={dni}
                                onChange={(e) => setDni(e.target.value)}
                                className="w-full rounded-2xl border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 focus:ring-primary focus:border-primary shadow-sm"
                                placeholder="20123456789"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-text-main dark:text-white mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-2xl border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 focus:ring-primary focus:border-primary shadow-sm"
                                placeholder="socio@rural.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-text-main dark:text-white mb-2">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-2xl border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 focus:ring-primary focus:border-primary shadow-sm"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-green-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl shadow-green-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? 'Registrando...' : 'Registrarse'}
                        </button>
                    </form>

                    <div className="text-center text-sm text-gray-500 mt-6">
                        ¿Ya tienes cuenta? <Link to="/login" className="text-primary font-bold hover:underline">Inicia Sesión</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
