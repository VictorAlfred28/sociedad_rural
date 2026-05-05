import React, { useState, useEffect } from 'react';
import { useAuth, Socio } from '../context/AuthContext';

export default function GestionDependientes() {
    const { user, token } = useAuth();
    const [dependientes, setDependientes] = useState<Socio[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        nombre_apellido: '',
        dni_cuit: '',
        tipo_vinculo: '',
        telefono: '',
        email: '',
    });
    const [formLoading, setFormLoading] = useState(false);

    // Un dependiente no puede tener dependientes, pero un COMERCIO sí (aunque tenga titular si fue creado por una cámara)
    const isTitular = !user?.titular_id || user?.rol === 'COMERCIO';
    const isComercio = user?.rol === 'COMERCIO';

    const title = isComercio ? 'Mis Empleados' : 'Grupo Familiar';
    const addTitle = isComercio ? 'Agregar Empleado' : 'Agregar Familiar';
    const vinculosPermitidos = isComercio
        ? ['Empleado', 'Encargado', 'Otro']
        : ['Cónyuge', 'Hijo/a', 'Padre/Madre', 'Otro'];

    const fetchDependientes = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/mis-dependientes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                window.dispatchEvent(new Event('auth-unauthorized'));
                return;
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            setDependientes(data.dependientes || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isTitular) fetchDependientes();
    }, [isTitular]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');

        try {
            const bodyData = { ...formData };
            if (!bodyData.email) delete (bodyData as any).email;

            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/agregar-dependiente`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(bodyData)
            });
            if (res.status === 401) {
                window.dispatchEvent(new Event('auth-unauthorized'));
                return;
            }
            const data = await res.json();
            if (!res.ok) {
                const errMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
                throw new Error(errMsg);
            }

            setFormData({ nombre_apellido: '', dni_cuit: '', tipo_vinculo: '', telefono: '', email: '' });
            setShowAddForm(false);
            fetchDependientes();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de desvincular este miembro?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/dependientes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            fetchDependientes();
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (!isTitular) return null;

    const inputClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl h-11 px-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-colors";

    return (
        <div className="w-full mt-6">
            <div className="flex items-center justify-between px-2 mb-3">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                    {title} {!isComercio && `- ${dependientes.length} / 3`}
                </h3>
                {!showAddForm && (
                    <button
                        onClick={() => {
                            if (!isComercio && dependientes.length >= 3) {
                                alert("Ya alcanzaste el máximo permitido de 3 familiares.");
                                return;
                            }
                            setShowAddForm(true);
                        }}
                        disabled={!isComercio && dependientes.length >= 3}
                        className={`text-xs font-bold flex items-center gap-1 transition-all ${
                            !isComercio && dependientes.length >= 3
                                ? 'text-slate-400 cursor-not-allowed opacity-50'
                                : 'text-primary hover:brightness-110 active:scale-95'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Nuevo
                    </button>
                )}
            </div>

            {showAddForm && (
                <form onSubmit={handleAdd} className="bg-white dark:bg-slate-900 border border-primary/20 p-4 rounded-2xl shadow-sm flex flex-col gap-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-slate-900 dark:text-slate-100 font-bold text-sm">{addTitle}</h4>
                        <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400">
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    </div>

                    {error && <p className="text-red-500 text-xs px-1">{error}</p>}

                    <input
                        placeholder="Nombre y apellido" required className={inputClass}
                        value={formData.nombre_apellido} onChange={e => setFormData({ ...formData, nombre_apellido: e.target.value })}
                    />
                    <input
                        placeholder="DNI o CUIT" required className={inputClass}
                        value={formData.dni_cuit} onChange={e => setFormData({ ...formData, dni_cuit: e.target.value })}
                    />
                    <select
                        required className={inputClass}
                        value={formData.tipo_vinculo} onChange={e => setFormData({ ...formData, tipo_vinculo: e.target.value })}
                    >
                        <option value="" disabled>Seleccionar vínculo...</option>
                        {vinculosPermitidos.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <input
                        placeholder="Email (opcional)" type="email" className={inputClass}
                        value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />

                    <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-2">
                            Contraseña Inicial
                        </label>
                        <input
                            type="text" readOnly disabled
                            value="Familia1234"
                            className={`${inputClass} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed`}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Esta es la contraseña inicial que el miembro debe usar para acceder.
                        </p>
                    </div>

                    <button
                        type="submit" disabled={formLoading}
                        className="mt-2 h-11 rounded-xl bg-primary text-slate-900 font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform disabled:opacity-50"
                    >
                        {formLoading ? 'Guardando...' : 'Guardar y Vincular'}
                    </button>
                </form>
            )}

            {loading ? (
                <p className="text-center text-slate-400 text-sm py-4">Cargando...</p>
            ) : dependientes.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 text-center">
                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-4xl mb-2">group_off</span>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No tienes miembros vinculados.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {dependientes.map(dep => (
                        <div key={dep.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                                {dep.nombre_apellido.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col flex-1 truncate">
                                <span className="text-slate-900 dark:text-slate-100 font-bold text-sm truncate">{dep.nombre_apellido}</span>
                                <span className="text-slate-500 dark:text-slate-400 text-xs">{dep.tipo_vinculo} • DNI {dep.dni}</span>
                            </div>
                            <button
                                onClick={() => handleDelete(dep.id)}
                                className="text-red-400 hover:text-red-500 bg-red-50 dark:bg-red-400/10 h-8 w-8 rounded-full flex items-center justify-center transition-colors"
                                title="Desvincular"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
