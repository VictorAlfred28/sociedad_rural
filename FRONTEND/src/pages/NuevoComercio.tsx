import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ComercioDTO } from '../types/comercio';
import { ProfesionalDTO } from '../types/profesional';
import { ComercioForm } from '../components/forms/ComercioForm';
import { ProfesionalForm } from '../components/forms/ProfesionalForm';

export default function NuevoComercio({ inlineMode = false, onSuccess }: { inlineMode?: boolean, onSuccess?: () => void }) {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'comercios' | 'profesionales'>('comercios');

    const [formDataComercio, setFormDataComercio] = useState<ComercioDTO>({
        nombre_comercio: '',
        cuit: '',
        email: '',
        telefono: '',
        rubro: '',
        direccion: '',
        municipio: '',
        provincia: 'Corrientes'
    });

    const [formDataProfesional, setFormDataProfesional] = useState<ProfesionalDTO>({
        nombreApellido: '',
        dni: '',
        nroMatricula: '',
        profesion: '',
        domicilio: '',
        telefono: '',
        email: '',
        municipio: '',
        provincia: 'Corrientes'
    });

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleChangeComercio = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormDataComercio({
            ...formDataComercio,
            [e.target.name]: e.target.value
        });
    };

    const handleChangeProfesional = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormDataProfesional({
            ...formDataProfesional,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmitComercio = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/comercios`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formDataComercio)
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.detail || 'Error al crear el comercio');
            }

            setSuccessMsg(`Comercio creado con éxito.`);

            setFormDataComercio({
                nombre_comercio: '',
                cuit: '',
                email: '',
                telefono: '',
                rubro: '',
                direccion: '',
                municipio: '',
                provincia: 'Corrientes'
            });

            setTimeout(() => {
                if (onSuccess) {
                    onSuccess();
                } else if (!inlineMode) {
                    navigate('/admin');
                }
            }, 3000);

        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitProfesional = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/profesionales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formDataProfesional)
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.detail || 'Error al crear el profesional');
            }

            setSuccessMsg(`Profesional creado con éxito.`);

            setFormDataProfesional({
                nombreApellido: '',
                dni: '',
                nroMatricula: '',
                profesion: '',
                domicilio: '',
                telefono: '',
                email: '',
                municipio: '',
                provincia: 'Corrientes'
            });

            setTimeout(() => {
                if (onSuccess) {
                    onSuccess();
                } else if (!inlineMode) {
                    navigate('/admin');
                }
            }, 3000);

        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const content = (
        <main className={`flex-1 ${inlineMode ? 'p-4' : 'p-6'}`}>
            <div className={inlineMode ? "mb-6" : "hidden"}>
                <div className="flex border-b border-admin-border mb-6">
                    <button
                        onClick={() => setActiveTab('comercios')}
                        className={`py-3 px-6 text-sm font-bold tracking-widest uppercase transition-colors relative ${
                            activeTab === 'comercios'
                                ? 'text-admin-accent'
                                : 'text-slate-400 hover:text-admin-text'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">storefront</span>
                            Altas de Comercios
                        </div>
                        {activeTab === 'comercios' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-admin-accent" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('profesionales')}
                        className={`py-3 px-6 text-sm font-bold tracking-widest uppercase transition-colors relative ${
                            activeTab === 'profesionales'
                                ? 'text-admin-accent'
                                : 'text-slate-400 hover:text-admin-text'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
                            Altas de Profesionales
                        </div>
                        {activeTab === 'profesionales' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-admin-accent" />
                        )}
                    </button>
                </div>

                <h2 className="text-xl font-bold tracking-tight text-admin-text mt-2">
                    {activeTab === 'comercios' ? 'Alta de Comercio' : 'Alta de Profesional'}
                </h2>
                <p className="text-slate-400 text-sm">
                    {activeTab === 'comercios' 
                        ? 'Registra un nuevo comercio usando el DTO Estandarizado.' 
                        : 'Registra un nuevo profesional asociado a la red.'}
                </p>
            </div>

            {successMsg && (
                <div className="mb-6 p-4 bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl text-[#10b981] text-sm font-medium text-center">
                    {successMsg}
                </div>
            )}

            {errorMsg && (
                <div className="mb-6 p-4 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl text-[#ef4444] text-sm font-medium text-center">
                    {errorMsg}
                </div>
            )}

            {activeTab === 'comercios' ? (
                <ComercioForm 
                    formData={formDataComercio}
                    onChange={handleChangeComercio}
                    onSubmit={handleSubmitComercio}
                    isLoading={isLoading}
                    mode="ADMIN"
                    buttonText="Autorizar y Dar de Alta"
                    showPasswordHint={true}
                />
            ) : (
                <ProfesionalForm 
                    formData={formDataProfesional}
                    onChange={handleChangeProfesional}
                    onSubmit={handleSubmitProfesional}
                    isLoading={isLoading}
                    mode="ADMIN"
                    buttonText="Autorizar y Dar de Alta"
                    showPasswordHint={true}
                />
            )}
        </main>
    );

    if (inlineMode) {
        return content;
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
            <header className="flex items-center bg-white dark:bg-slate-900 p-4 sticky top-0 z-10 border-b border-primary/10">
                <Link to="/admin" className="text-slate-900 dark:text-slate-100 flex size-10 shrink-0 items-center justify-center cursor-pointer">
                    <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <div className="flex-1 pr-10 text-center">
                    <h2 className="text-lg font-bold leading-tight tracking-tight">Gestión Integral</h2>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Administración</p>
                </div>
            </header>
            {content}
        </div>
    );
}
