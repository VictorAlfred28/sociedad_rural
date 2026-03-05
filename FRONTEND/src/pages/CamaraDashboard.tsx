import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import SocioHomeContent from '../components/SocioHomeContent';

interface Comercio {
    id: string;
    nombre_apellido: string;
    dni: string;
    email: string;
    telefono: string;
    rubro: string;
    estado: string;
    direccion?: string;
}

export default function CamaraDashboard() {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const [comercios, setComercios] = useState<Comercio[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [activeTab, setActiveTab] = useState<'SOCIO' | 'COMERCIOS'>('COMERCIOS');
    const [editingComercio, setEditingComercio] = useState<Comercio | null>(null);

    const [formData, setFormData] = useState({
        nombre_comercio: '',
        cuit: '',
        email: '',
        telefono: '',
        rubro: '',
        direccion: ''
    });

    const [formLoading, setFormLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        fetchComercios();
    }, []);

    const fetchComercios = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/camara/mis-comercios`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await resp.json();
            if (resp.ok) {
                setComercios(data.dependientes || []);
            }
        } catch (error) {
            console.error("Error fetching commerces:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const openAddForm = () => {
        if (comercios.length >= 10) {
            setMessage({ text: 'Límite de 10 comercios alcanzado.', type: 'error' });
            return;
        }
        setEditingComercio(null);
        setFormData({ nombre_comercio: '', cuit: '', email: '', telefono: '', rubro: '', direccion: '' });
        setShowForm(true);
        setMessage({ text: '', type: '' });
    };

    const openEditForm = (com: Comercio) => {
        setEditingComercio(com);
        setFormData({
            nombre_comercio: com.nombre_apellido,
            cuit: com.dni,
            email: com.email,
            telefono: com.telefono,
            rubro: com.rubro,
            direccion: com.direccion || ''
        });
        setShowForm(true);
        setMessage({ text: '', type: '' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const url = editingComercio
                ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/camara/comercios/${editingComercio.id}`
                : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/comercios`;

            const method = editingComercio ? 'PUT' : 'POST';

            const body = editingComercio
                ? {
                    nombre_apellido: formData.nombre_comercio,
                    email: formData.email,
                    telefono: formData.telefono,
                    rubro: formData.rubro,
                    direccion: formData.direccion
                }
                : formData;

            const resp = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const data = await resp.json();

            if (!resp.ok) throw new Error(data.detail || 'Error en la operación');

            setMessage({
                text: editingComercio ? 'Actualización enviada para aprobación.' : 'Comercio registrado con éxito. Pendiente de aprobación.',
                type: 'success'
            });

            setTimeout(() => {
                setShowForm(false);
                fetchComercios();
            }, 2000);

        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] font-display text-slate-900 dark:text-slate-100 pb-20">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <span className="material-symbols-outlined">domain</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">Panel de Cámara</h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{user?.municipio || 'Gestión Municipal'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <NotificationBell />
                    <button onClick={() => logout()} className="size-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 pt-8">
                {/* Custom Tab Switcher */}
                <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
                    <button
                        onClick={() => setActiveTab('SOCIO')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'SOCIO' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'}`}
                    >
                        <span className="material-symbols-outlined text-xl">person</span>
                        Ingresar como Socio
                    </button>
                    <button
                        onClick={() => setActiveTab('COMERCIOS')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'COMERCIOS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'}`}
                    >
                        <span className="material-symbols-outlined text-xl">storefront</span>
                        Registrar Comercios
                    </button>
                </div>

                {activeTab === 'SOCIO' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                        <SocioHomeContent />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Metric Card */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-5">
                                <div className={`size-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${comercios.length >= 10 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    <span className="material-symbols-outlined">storefront</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cupos Disponibles</p>
                                    <h2 className="text-3xl font-black">{10 - comercios.length} <span className="text-lg font-medium text-slate-400">/ 10</span></h2>
                                </div>
                            </div>
                        </div>

                        {/* Section Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">Mis Comercios Adheridos</h3>
                            <button
                                onClick={openAddForm}
                                disabled={comercios.length >= 10}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 text-white font-bold py-2.5 px-5 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                            >
                                <span className="material-symbols-outlined">add</span>
                                Nuevo Comercio
                            </button>
                        </div>

                        {/* Info Box */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl p-4 mb-8 flex items-start gap-4">
                            <span className="material-symbols-outlined text-indigo-500">info</span>
                            <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium leading-relaxed">
                                Todas las altas y ediciones realizadas desde este panel quedan en estado <strong>PENDIENTE</strong> hasta que el Administrador Global las apruebe.
                            </p>
                        </div>

                        {/* List */}
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 grayscale opacity-30">
                                <div className="size-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="font-bold text-sm">Cargando datos...</p>
                            </div>
                        ) : comercios.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-20 flex flex-col items-center text-center">
                                <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-800 mb-4">search_off</span>
                                <p className="font-bold text-slate-400">No hay comercios registrados aún.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {comercios.map((com) => (
                                    <div key={com.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group transition-all hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900/30">
                                        <div className="flex items-center gap-4">
                                            <div className="size-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 transition-colors">
                                                <span className="material-symbols-outlined">shopping_bag</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-base leading-none mb-1">{com.nombre_apellido}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{com.rubro} • {com.dni}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${com.estado === 'APROBADO' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                                        }`}>
                                                        {com.estado}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => openEditForm(com)}
                                            className="size-10 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-90"
                                        >
                                            <span className="material-symbols-outlined text-xl">edit</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl relative animate-in slide-in-from-bottom-20 duration-500 focus-within:ring-0">
                        <button
                            onClick={() => setShowForm(false)}
                            className="absolute right-6 top-6 size-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <h3 className="text-2xl font-black mb-1">{editingComercio ? 'Editar Comercio' : 'Nuevo Comercio'}</h3>
                        <p className="text-slate-500 text-xs mb-8">Todos los campos son obligatorios.</p>

                        {message.text && (
                            <div className={`mb-6 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                                }`}>
                                <span className="material-symbols-outlined text-lg">{message.type === 'success' ? 'check_circle' : 'error'}</span>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nombre Comercial</label>
                                <input
                                    type="text" name="nombre_comercio" value={formData.nombre_comercio} onChange={handleInputChange} required
                                    className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    placeholder="Ej: Agropecuaria El Sol"
                                />
                            </div>

                            {!editingComercio && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">CUIT (Solo números)</label>
                                    <input
                                        type="number" name="cuit" value={formData.cuit} onChange={handleInputChange} required
                                        className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        placeholder="20XXXXXXXXX"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email</label>
                                    <input
                                        type="email" name="email" value={formData.email} onChange={handleInputChange} required
                                        className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        placeholder="contacto@corp.com"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Teléfono</label>
                                    <input
                                        type="tel" name="telefono" value={formData.telefono} onChange={handleInputChange} required
                                        className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        placeholder="+54 379..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Rubro</label>
                                <select
                                    name="rubro" value={formData.rubro} onChange={handleInputChange} required
                                    className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                                >
                                    <option value="" disabled className="text-slate-500">Seleccionar rubro comercial</option>
                                    <option value="Insumos Agropecuarios">Insumos Agropecuarios</option>
                                    <option value="Maquinaria">Maquinaria</option>
                                    <option value="Veterinaria">Veterinaria</option>
                                    <option value="Servicios Rurales">Servicios Rurales</option>
                                    <option value="Otro">Otro Rubro</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Dirección</label>
                                <input
                                    type="text" name="direccion" value={formData.direccion} onChange={handleInputChange} required
                                    className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    placeholder="Calle y número"
                                />
                            </div>

                            <div className="flex gap-3 items-center bg-indigo-50/50 dark:bg-indigo-900/5 p-4 rounded-2xl mt-4">
                                <span className="material-symbols-outlined text-indigo-500 text-lg">vpn_key</span>
                                <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400/70 font-bold leading-relaxed">
                                    La contraseña inicial será <strong>comercio1234</strong>. El comercio podrá reestablecerla tras la aprobación.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={formLoading}
                                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                            >
                                {formLoading ? (
                                    <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : editingComercio ? 'Guardar Cambios' : 'Enviar Solicitud'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1E293B;
                }
            `}</style>
        </div>
    );
}
