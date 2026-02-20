import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, Trash2 } from 'lucide-react';
import { ApiService } from '../services/api';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [changingPass, setChangingPass] = useState(false);
    const [showCurrentPass, setShowCurrentPass] = useState(false);

    if (!isOpen) return null;

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            alert("Las contraseñas nuevas no coinciden");
            return;
        }
        if (passwords.new.length < 6) {
            alert("La nueva contraseña debe tener al menos 6 caracteres");
            return;
        }

        setChangingPass(true);
        try {
            await ApiService.user.changePassword(passwords.current, passwords.new);
            alert("¡Contraseña actualizada con éxito!");
            setPasswords({ current: '', new: '', confirm: '' });
            onClose();
        } catch (err: any) {
            alert(err.message || "Error al cambiar la contraseña");
        } finally {
            setChangingPass(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-serif font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-rural-green" /> Cambiar Contraseña
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Contraseña Actual</label>
                        <div className="relative">
                            <input
                                type={showCurrentPass ? "text" : "password"}
                                required
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-rural-green dark:text-white"
                                value={passwords.current}
                                onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                            />
                            <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Nueva Contraseña</label>
                        <input
                            type="password"
                            required
                            placeholder="Mínimo 6 caracteres"
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-rural-green dark:text-white mb-4"
                            value={passwords.new}
                            onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                        />
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Confirmar Nueva Contraseña</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-rural-green dark:text-white"
                            value={passwords.confirm}
                            onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all dark:hover:bg-slate-700"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={changingPass}
                            className="flex-[2] bg-rural-green text-white py-3 rounded-xl font-bold shadow-lg shadow-green-200 dark:shadow-none hover:bg-[#143225] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {changingPass ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Actualizar Clave</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
