
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [emailOrDni, setEmailOrDni] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let loginEmail = emailOrDni;

            // Simple check: if it doesn't have '@', assume it's a DNI
            if (!emailOrDni.includes('@')) {
                const { data, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('dni', emailOrDni)
                    .single();

                if (profileError || !data?.email) {
                    throw new Error('No se encontró un usuario con ese DNI');
                }
                loginEmail = data.email;
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password,
            });

            if (error) throw error;

            // Check role
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                console.log('Login successful for:', user.email);
                const { data, error: roleError } = await supabase.from('profiles').select('role').eq('id', user.id).single();

                if (roleError) console.error('Error fetching role:', roleError);
                console.log('Fetched role:', data?.role);

                if (data?.role === 'admin') {
                    navigate('/admin');
                } else {
                    navigate('/');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            <div className="hidden lg:flex w-1/2 bg-surface-dark relative items-center justify-center p-12 text-white">
                <div className="absolute inset-0 bg-black/60 z-10"></div>
                <div className="absolute inset-0 bg-[url('https://picsum.photos/1080/1920?random=100')] bg-cover bg-center"></div>
                <div className="relative z-20 max-w-lg space-y-8 animate-in fade-in zoom-in duration-700">
                    <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-6 shadow-2xl shadow-primary/30">
                        <span className="material-symbols-outlined text-4xl text-black font-bold">agriculture</span>
                    </div>
                    <div>
                        <h2 className="text-5xl font-black mb-4 leading-tight">Sociedad Rural <br /> Digital</h2>
                        <p className="text-xl text-gray-300">Impulsando el crecimiento de nuestra comunidad agropecuaria a través de la tecnología y la colaboración.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex -space-x-3">
                            {[1, 2, 3, 4].map(i => (
                                <img key={i} src={`https://picsum.photos/40/40?random=${i}`} className="size-10 rounded-full border-2 border-surface-dark" alt="User" />
                            ))}
                        </div>
                        <p className="text-sm self-center text-gray-400 font-medium">Más de +500 socios conectados</p>
                    </div>
                </div>
            </div>
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background-light dark:bg-background-dark">
                <div className="w-full max-w-md space-y-10">
                    <div>
                        <h2 className="text-4xl font-black text-text-main dark:text-white">Bienvenido</h2>
                        <p className="text-gray-500 mt-3 font-medium">Ingresa tus credenciales para acceder al portal de socios.</p>
                    </div>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl text-sm font-bold">
                            {error}
                        </div>
                    )}
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-bold text-text-main dark:text-white mb-2">Email o DNI</label>
                            <input
                                type="text"
                                value={emailOrDni}
                                onChange={(e) => setEmailOrDni(e.target.value)}
                                className="w-full rounded-2xl border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 focus:ring-primary focus:border-primary shadow-sm"
                                placeholder="Ingresa tu email o DNI"
                                required
                            />
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm font-bold text-text-main dark:text-white">Contraseña</label>
                                <a href="#" className="text-xs text-primary font-bold hover:underline">¿Olvidaste tu contraseña?</a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-2xl border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 pr-12 focus:ring-primary focus:border-primary shadow-sm"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <span className="material-symbols-outlined">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-green-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl shadow-green-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </button>
                    </form>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-light dark:border-border-dark"></div></div>
                        <div className="relative flex justify-center text-sm"><span className="px-4 bg-background-light dark:bg-background-dark text-gray-400">O ingresa con</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button className="flex items-center justify-center gap-2 py-3 border border-border-light dark:border-border-dark rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition">
                            <img src="https://www.google.com/favicon.ico" className="size-4" /> Google
                        </button>
                        <button className="flex items-center justify-center gap-2 py-3 border border-border-light dark:border-border-dark rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition">
                            <span className="material-symbols-outlined text-blue-600">facebook</span> Facebook
                        </button>
                    </div>
                    <div className="text-center text-sm text-gray-500">
                        ¿No eres socio aún? <Link to="/register" className="text-primary font-bold hover:underline">Solicita tu ingreso</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
