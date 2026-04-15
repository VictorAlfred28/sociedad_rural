import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: Props) {
    const { token } = useAuth();
    const [passData, setPassData] = useState({ new: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (passData.new !== passData.confirm) return setError('Las contraseñas no coinciden.');
        if (passData.new.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');

        setLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/change-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ new_password: passData.new })
            });

            if (resp.ok) {
                setSuccess(true);
                setPassData({ new: '', confirm: '' });
                setTimeout(() => {
                    setSuccess(false);
                    onClose();
                }, 3000);
            } else {
                const d = await resp.json();
                throw new Error(d.detail || 'Error al cambiar contraseña');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-admin-card border border-admin-border w-full max-w-md rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                {/* Decoración */}
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <span className="material-symbols-outlined text-8xl">manage_accounts</span>
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-admin-text">👤 Configuración de Mi Cuenta</h3>
                            <p className="text-slate-500 text-xs">Gestiona tu acceso personal al sistema.</p>
                        </div>
                        <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full hover:bg-white/5 text-slate-400">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-admin-rejected/10 border border-admin-rejected/20 rounded-xl text-admin-rejected text-xs font-bold animate-in shake-1">
                            {error}
                        </div>
                    )}

                    {success ? (
                        <div className="py-10 text-center space-y-4 animate-in zoom-in-95">
                            <div className="size-16 rounded-full bg-admin-approved/20 text-admin-approved flex items-center justify-center mx-auto border border-admin-approved/30">
                                <span className="material-symbols-outlined text-4xl">task_alt</span>
                            </div>
                            <h2 className="text-xl font-bold text-white">¡Contraseña Actualizada!</h2>
                            <p className="text-slate-400 text-sm px-4">Tu nueva clave ha sido guardada con éxito. El modal se cerrará en breve...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[20px]">lock</span>
                                    <input
                                        type="password"
                                        required
                                        value={passData.new}
                                        onChange={e => setPassData({ ...passData, new: e.target.value })}
                                        className="w-full h-12 bg-admin-bg border border-admin-border rounded-xl pl-12 pr-4 text-sm text-admin-text outline-none focus:border-admin-accent transition-all"
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[20px]">verified_user</span>
                                    <input
                                        type="password"
                                        required
                                        value={passData.confirm}
                                        onChange={e => setPassData({ ...passData, confirm: e.target.value })}
                                        className="w-full h-12 bg-admin-bg border border-admin-border rounded-xl pl-12 pr-4 text-sm text-admin-text outline-none focus:border-admin-accent transition-all"
                                        placeholder="Repite la contraseña"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] h-12 bg-admin-accent text-white font-bold rounded-xl shadow-lg shadow-admin-accent/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Actualizando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
