import React, { useEffect, useState, useRef } from 'react';
import { LogOut, User, CreditCard, AlertTriangle, CheckCircle, MapPin, Phone, Loader2, ExternalLink, MessageCircle, Facebook, Instagram, PhoneCall, Camera, Download, Share2 } from 'lucide-react';
import { ApiService } from '../services/api';
import { Profile } from '../types';
import { useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';

export const Portal = ({ onLogout }: { onLogout: () => void }) => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [userPhoto, setUserPhoto] = useState<string | null>(null);
    const [offers, setOffers] = useState<any[]>([]);
    const [promotions, setPromotions] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loadingContent, setLoadingContent] = useState(true);
    const cardRef = useRef<HTMLDivElement>(null);

    const location = useLocation();

    useEffect(() => {
        // Cargar perfil
        const stored = localStorage.getItem('user_data');
        if (stored) {
            const parsedProfile = JSON.parse(stored);
            setProfile(parsedProfile);
            // Intentar cargar foto guardada localmente para este usuario
            const savedPhoto = localStorage.getItem(`profile_photo_${parsedProfile.id}`);
            if (savedPhoto) setUserPhoto(savedPhoto);

            // Actualizar ubicación si es posible
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((position) => {
                    ApiService.user.updateLocation(position.coords.latitude, position.coords.longitude)
                        .catch(err => console.error("Error updating location:", err));
                });
            }
        }

        // Cargar contenido dinámico
        const fetchContent = async () => {
            try {
                const [comercios, promos, evts] = await Promise.all([
                    ApiService.comercios.getAll(),
                    ApiService.promociones.getAll(),
                    ApiService.eventos.getAll()
                ]);
                // Filtrar ofertas (comercios con descuento > 0)
                setOffers(comercios.filter(c => c.descuento_base > 0));
                setPromotions(promos);
                setEvents(evts);
            } catch (err) {
                console.error("Error loading portal content:", err);
            } finally {
                setLoadingContent(false);
            }
        };
        fetchContent();
    }, []);


    // Detectar retorno de Mercado Pago
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const status = params.get('status');
        if (status === 'success') {
            alert("¡Pago realizado con éxito! Tu cuota se actualizará en breve.");
        } else if (status === 'failure') {
            alert("El pago no pudo ser procesado. Intente nuevamente.");
        }
    }, [location]);

    const handlePayment = async () => {
        setPaymentLoading(true);
        try {
            const response = await ApiService.payments.createPreference(5000, `Cuota Mensual - ${profile?.apellido}`);
            if (response.init_point) {
                window.location.href = response.init_point;
            } else {
                alert("Error al obtener link de pago");
            }
        } catch (error) {
            console.error("Error pago:", error);
            alert("No se pudo iniciar el pago. Verifique conexión.");
        } finally {
            setPaymentLoading(false);
        }
    };

    const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setUserPhoto(base64String);
                if (profile?.id) {
                    localStorage.setItem(`profile_photo_${profile.id}`, base64String);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDownloadCard = async () => {
        if (cardRef.current) {
            try {
                // Renderizar el carnet a canvas
                const canvas = await html2canvas(cardRef.current, {
                    scale: 2, // Mayor calidad
                    backgroundColor: null,
                    useCORS: true
                });

                // Crear link de descarga
                const link = document.createElement('a');
                link.download = `Carnet_Rural_${profile?.apellido || 'Socio'}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (error) {
                console.error("Error descargando carnet:", error);
                alert("No se pudo descargar la imagen. Intenta hacer una captura de pantalla.");
            }
        }
    };

    const StatusBadge = ({ status, isMoroso }: { status: string, isMoroso?: boolean }) => {
        const isActivo = status === 'activo' && !isMoroso;
        let label = status || 'Pendiente';
        if (isMoroso) label = 'Deuda Pendiente';

        return (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${isActivo ? 'bg-green-100/20 text-green-300 border-green-400' : 'bg-red-100/20 text-red-300 border-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isActivo ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                {label}
            </div>
        );
    };

    // --- SKELETON COMPONENTS ---
    const SkeletonOffer = () => (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-pulse">
            <div className="h-24 bg-gray-200 dark:bg-slate-700"></div>
            <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-1/2"></div>
                <div className="h-8 bg-gray-50 dark:bg-slate-700 rounded w-full mt-2"></div>
            </div>
        </div>
    );

    const SkeletonPromo = () => (
        <div className="h-44 bg-gray-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
    );

    const SkeletonEvent = () => (
        <div className="flex gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-gray-700 animate-pulse">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 dark:bg-slate-700 rounded-xl"></div>
            <div className="flex-1 space-y-3 mt-1">
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/3"></div>
                <div className="h-10 bg-gray-100 dark:bg-slate-700 rounded w-full"></div>
            </div>
        </div>
    );

    const isRestricted = profile?.estado !== 'activo' || profile?.is_moroso;

    return (
        <div className="min-h-screen font-sans pb-20 transition-colors duration-300">
            {/* Header */}
            <header className="bg-rural-green text-white shadow-lg sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rural-gold rounded-full flex items-center justify-center text-rural-green font-bold text-xl border-2 border-white">
                            SR
                        </div>
                        <div>
                            <h1 className="font-serif font-bold text-lg leading-tight hidden sm:block">Sociedad Rural</h1>
                            <p className="text-xs text-gray-300">Portal del Socio</p>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Cerrar Sesión</span>
                    </button>
                </div>
            </header>

            {/* Contenido Principal */}
            <main className="max-w-4xl mx-auto px-4 py-4 sm:py-8 space-y-8">

                {/* Saludo */}
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-serif font-bold text-gray-800 dark:text-gray-100">Hola, {profile?.nombre}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Bienvenido a tu panel de gestión.</p>
                </div>

                {/* --- CARNET DIGITAL PREMIUM --- */}
                <div className="flex flex-col items-center gap-6">

                    {/* Contenedor de la Tarjeta (Render Target) */}
                    <div className="relative group perspective-1000 w-full max-w-md mx-auto">
                        <div
                            ref={cardRef}
                            className={`relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 transform bg-gradient-to-br from-[#1B4332] via-[#0f291e] to-[#081f16] border border-rural-gold/30 ${isRestricted ? 'grayscale-[0.5]' : ''}`}
                        >
                            {/* Textura de Fondo (Ruido/Patrón) */}
                            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/leather.png')]"></div>

                            {/* Elementos Decorativos */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-rural-gold/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-rural-green/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                            {/* Contenido del Carnet */}
                            <div className="relative z-10 h-full p-4 sm:p-6 flex flex-col justify-between text-white">

                                {/* Header Carnet */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rural-gold to-yellow-200 p-0.5 shadow-lg">
                                            <div className="w-full h-full rounded-full bg-rural-green flex items-center justify-center font-bold font-serif text-rural-gold text-sm border border-white/20">
                                                SR
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-serif font-bold text-sm sm:text-lg tracking-wide text-rural-gold leading-none">SOCIEDAD RURAL</span>
                                            <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] text-gray-300">Norte de Corrientes</span>
                                        </div>
                                    </div>
                                    <StatusBadge status={profile?.estado || 'pendiente'} isMoroso={profile?.is_moroso} />
                                </div>

                                {/* Cuerpo Carnet */}
                                <div className="flex items-center gap-4 sm:gap-5 mt-2">
                                    {/* Foto de Perfil */}
                                    <div className="relative group/photo shrink-0">
                                        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border-2 border-rural-gold/50 p-1 shadow-lg bg-black/20 overflow-hidden relative">
                                            {userPhoto ? (
                                                <img src={userPhoto} alt="Perfil" className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                <div className="w-full h-full bg-rural-green/50 flex items-center justify-center rounded-full">
                                                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-rural-gold/50" />
                                                </div>
                                            )}

                                            {/* Overlay para subir foto */}
                                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/photo:opacity-100 transition-opacity cursor-pointer rounded-full">
                                                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Datos del Socio */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg sm:text-2xl font-serif font-bold text-white truncate drop-shadow-md">
                                            {profile?.nombre} {profile?.apellido}
                                        </h3>
                                        <p className="text-rural-gold font-medium text-xs sm:text-base mb-1 uppercase tracking-wide">
                                            {profile?.rol === 'comun' ? 'Socio Activo' : profile?.rol}
                                        </p>
                                        <div className="flex flex-col gap-0.5 mt-1 sm:mt-2 text-[10px] sm:text-sm text-gray-300 font-mono">
                                            <span>DNI: {profile?.dni}</span>
                                            <span>SOCIO N°: {profile?.id?.substring(0, 8).toUpperCase()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Carnet */}
                                <div className="flex justify-between items-end mt-2">
                                    <div className="text-[8px] sm:text-[10px] text-gray-400">
                                        <p>Válido para presentación digital.</p>
                                        <p>Renovación anual automática.</p>
                                    </div>

                                    {/* QR Code */}
                                    <div className="bg-white p-1 rounded-lg shadow-lg relative overflow-hidden group/qr">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${profile?.id}&bgcolor=ffffff`}
                                            alt="QR Acceso"
                                            className={`w-12 h-12 sm:w-20 sm:h-20 mix-blend-multiply ${isRestricted ? 'blur-[1px] opacity-50' : ''}`}
                                        />
                                        {isRestricted && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-red-500/10">
                                                <AlertTriangle className="w-6 h-6 text-red-600" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isRestricted && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-red-600/90 text-white text-[10px] sm:text-xs font-bold px-4 py-1.5 rounded-full shadow-xl flex items-center gap-2 border border-white/20">
                                <AlertTriangle className="w-3 h-3" /> CARNET RESTRINGIDO - REGULARIZAR PAGO
                            </div>
                        )}
                    </div>

                    {/* Controles del Carnet */}
                    <div className="flex gap-4 w-full max-w-sm justify-center">
                        <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer shadow-sm transition-colors">
                            <Camera className="w-4 h-4" />
                            <span className="hidden xs:inline">Cambiar</span> Foto
                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                        <button
                            onClick={handleDownloadCard}
                            className="flex items-center gap-2 px-4 py-2 bg-rural-green text-white rounded-lg text-xs font-medium hover:bg-[#143225] shadow-md transition-all hover:scale-105"
                        >
                            <Download className="w-4 h-4" />
                            Descargar
                        </button>
                    </div>
                </div>

                {/* --- MENSAJE DE MOROSIDAD / BLOQUEO --- */}
                {isRestricted && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 sm:p-5 flex gap-4">
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-full h-fit animate-bounce">
                            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-amber-900 dark:text-amber-200">Acceso a beneficios restringido</h4>
                            <p className="text-amber-800 dark:text-amber-300 text-sm mt-1">
                                Tu carnet se encuentra temporalmente inactivo. Para seguir disfrutando de los descuentos y eventos, por favor regulariza tu cuota social.
                            </p>
                            <button
                                onClick={handlePayment}
                                className="mt-3 text-sm font-bold bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
                            >
                                Regularizar Pago Ahora
                            </button>
                        </div>
                    </div>
                )}

                {/* --- DATOS Y PAGOS GRID --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    {/* Estado de Cuenta */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 relative overflow-hidden transition-all hover:shadow-md">
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full opacity-50 pointer-events-none"></div>

                        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 relative z-10">
                            <CreditCard className="w-5 h-5 text-blue-500" /> Estado de Cuenta
                        </h3>

                        <div className="flex flex-col items-center justify-center py-2 relative z-10 text-center">
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Cuota Mensual</p>
                            <div className="flex items-baseline gap-1 my-2">
                                <span className="text-4xl font-serif font-bold text-gray-900 dark:text-white">$5.000</span>
                                <span className="text-gray-500 text-xs font-bold">ARS</span>
                            </div>

                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mb-6 ${!profile?.is_moroso ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                {!profile?.is_moroso ? <><CheckCircle className="w-3 h-3 mr-1.5" /> Al día</> : <><AlertTriangle className="w-3 h-3 mr-1.5" /> Pago Pendiente</>}
                            </span>

                            <button
                                onClick={handlePayment}
                                disabled={paymentLoading}
                                className="w-full bg-[#009EE3] hover:bg-[#0081B9] text-white py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                {paymentLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>Pagar con Mercado Pago <ExternalLink className="w-4 h-4" /></>
                                )}
                            </button>
                            <p className="text-[10px] text-gray-400 mt-4 max-w-[200px]">
                                Transacción procesada de forma segura por Mercado Pago.
                            </p>
                        </div>
                    </div>

                    {/* Datos Personales */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col transition-all hover:shadow-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <User className="w-5 h-5 text-rural-green" /> Mis Datos
                            </h3>
                            <button className="text-rural-green dark:text-green-400 text-xs font-bold hover:underline">Gestionar</button>
                        </div>

                        <div className="space-y-4 flex-1">
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50">
                                <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Localidad</p>
                                    <span className="text-gray-700 dark:text-gray-200 text-sm font-bold leading-tight block mt-0.5">
                                        {profile?.ciudad || 'Paso de los Libres'}, Corrientes
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50">
                                <Phone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Teléfono de contacto</p>
                                    <span className="text-gray-700 dark:text-gray-200 text-sm font-bold block mt-0.5">{profile?.telefono || '+54 3772 42XXXX'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- SECCIONES DINÁMICAS (BLOQUEADAS SI MOROSO) --- */}
                <div className={`space-y-12 transition-all duration-500 ${isRestricted ? 'opacity-40 pointer-events-none select-none blur-[2px]' : ''}`}>

                    {/* SECCIÓN A: OFERTAS (COMERCIOS) */}
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-serif font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                                <span className="bg-rural-gold text-rural-green w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">A</span>
                                Beneficios en Comercio
                            </h3>
                            <button className="text-xs font-bold text-rural-green dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors">Explorar todo</button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                            {loadingContent ? (
                                [1, 2, 3, 4].map(i => <SkeletonOffer key={i} />)
                            ) : offers.length > 0 ? (
                                offers.slice(0, 4).map(offer => (
                                    <div key={offer.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-1">
                                        <div className="h-28 bg-gray-100 relative overflow-hidden">
                                            <img
                                                src={offer.logo_url || `https://picsum.photos/seed/shop-${offer.id}/300/200`}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                alt=""
                                            />
                                            <div className="absolute top-2 right-2 bg-rural-green/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg border border-white/20">
                                                {offer.descuento_base}% CLUB
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{offer.nombre}</p>
                                            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate mb-3">{offer.rubro}</p>
                                            <button className="w-full py-2 bg-gray-50 dark:bg-slate-700/50 rounded-xl text-[10px] font-bold text-rural-green dark:text-green-400 hover:bg-rural-green hover:text-white transition-all border border-transparent hover:border-rural-green active:scale-95">
                                                Obtener Descuento
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="col-span-full text-center text-gray-400 py-6 text-sm italic">Cargando beneficios cercanos...</p>
                            )}
                        </div>
                    </section>

                    {/* SECCIÓN B: PROMOCIONES (CARDS CON IMAGEN) */}
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-serif font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                                <span className="bg-amber-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">B</span>
                                Promociones de Temporada
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {loadingContent ? (
                                [1, 2].map(i => <SkeletonPromo key={i} />)
                            ) : promotions.length > 0 ? (
                                promotions.map(promo => (
                                    <div key={promo.id} className="relative rounded-2xl overflow-hidden shadow-xl h-48 group cursor-pointer border border-white/10">
                                        <img src={promo.imagen_url || `https://picsum.photos/seed/promo-${promo.id}/800/400`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt="" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                                        <div className="absolute top-4 right-4 sm:hidden">
                                            <div className="bg-white/20 backdrop-blur-md p-2 rounded-full border border-white/30">
                                                <Download className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                        <div className="absolute bottom-0 left-0 p-6 text-white w-full">
                                            <p className="text-[10px] font-bold text-rural-gold uppercase tracking-[0.3em] mb-1.5 drop-shadow-lg">{promo.comercio_nombre || 'COMERCIO ALIADO'}</p>
                                            <h4 className="text-lg sm:text-xl font-bold leading-tight mb-3 group-hover:text-rural-gold transition-colors">{promo.titulo}</h4>
                                            <div className="flex items-center justify-between">
                                                <button className="bg-rural-gold text-rural-green px-5 py-2 rounded-full text-xs font-bold hover:bg-white hover:scale-105 transition-all shadow-lg active:scale-95">
                                                    Ver Promoción
                                                </button>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-md">
                                                    Validez: {promo.fecha_hasta ? new Date(promo.fecha_hasta).toLocaleDateString() : 'Limitada'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full p-8 text-center bg-gray-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                                    <p className="text-gray-400 text-sm">No hay promociones especiales esta semana.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECCIÓN C: EVENTOS */}
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-serif font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                                <span className="bg-green-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">C</span>
                                Agenda Rural
                            </h3>
                            <button className="text-xs font-bold text-rural-green dark:text-green-400 group flex items-center gap-1">Ver Calendario <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></button>
                        </div>

                        <div className="space-y-4">
                            {loadingContent ? (
                                [1, 2].map(i => <SkeletonEvent key={i} />)
                            ) : events.length > 0 ? (
                                events.map(evt => (
                                    <div key={evt.id} className="flex gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group cursor-pointer hover:border-rural-green/30">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 dark:bg-green-950/20 rounded-2xl flex flex-col items-center justify-center shrink-0 border border-gray-100 dark:border-green-900/30 group-hover:bg-rural-green group-hover:text-white transition-colors duration-500">
                                            <span className="text-[10px] font-bold uppercase tracking-wider group-hover:text-rural-gold">{new Date(evt.fecha).toLocaleDateString('es-AR', { month: 'short' })}</span>
                                            <span className="text-2xl sm:text-3xl font-serif font-bold">{new Date(evt.fecha).getDate()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-rural-green transition-colors">{evt.titulo}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 leading-relaxed">{evt.descripcion}</p>
                                            <div className="flex items-center justify-between mt-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-50 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                        <MapPin className="w-3 h-3" /> {evt.lugar || 'Sede Rural'}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-50 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                        <User className="w-3 h-3" /> Abierto
                                                    </span>
                                                </div>
                                                <button className="text-[10px] font-bold text-rural-green dark:text-green-400 hover:scale-105 transition-transform bg-green-50 dark:bg-green-900/40 px-3 py-1.5 rounded-lg active:scale-95">
                                                    Agendar →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 bg-gray-50 dark:bg-slate-900/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                                    <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm font-medium">No se encontraron eventos próximos en tu zona.</p>
                                </div>
                            )}
                        </div>
                    </section>

                </div>

                {/* --- CANALES DE CONTACTO --- */}
                <div className="pt-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md">
                        <div className="bg-gray-50/50 dark:bg-slate-700/30 px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-serif font-bold text-gray-800 dark:text-gray-100 text-lg">Asistencia y Canales Oficiales</h3>
                            <span className="bg-green-500 w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                        </div>

                        <div className="p-4 sm:p-6 grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
                            <ContactButton
                                href="https://wa.me/"
                                icon={MessageCircle}
                                label="WhatsApp"
                                sub="Secretaría Rural"
                                colorClass="bg-[#25D366]"
                                bgClass="bg-green-50 dark:bg-green-900/20"
                                borderClass="border-green-100 dark:border-green-900/30"
                            />
                            <ContactButton
                                href="tel:+543794000000"
                                icon={PhoneCall}
                                label="Sede Central"
                                sub="0800-RURAL-OFF"
                                colorClass="bg-rural-brown"
                                bgClass="bg-orange-50 dark:bg-orange-900/20"
                                borderClass="border-orange-100 dark:border-orange-900/30"
                            />
                            <ContactButton
                                href="https://instagram.com"
                                icon={Instagram}
                                label="Instagram"
                                sub="Nuestra Comunidad"
                                colorClass="bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]"
                                bgClass="bg-pink-50 dark:bg-pink-900/20"
                                borderClass="border-pink-100 dark:border-pink-900/30"
                            />
                            <ContactButton
                                href="https://facebook.com"
                                icon={Facebook}
                                label="Facebook"
                                sub="Prensa Rural"
                                colorClass="bg-[#1877F2]"
                                bgClass="bg-blue-50 dark:bg-blue-900/20"
                                borderClass="border-blue-100 dark:border-blue-900/30"
                            />
                        </div>
                        <div className="p-4 bg-gray-50/30 dark:bg-slate-900/10 text-center text-[10px] text-gray-400 font-medium">
                            Sociedad Rural Corrientes • Versión 8.0 CTO Build • © {new Date().getFullYear()}
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
};


const ContactButton = ({ href, icon: Icon, label, sub, colorClass, bgClass, borderClass }: any) => (
    <a href={href} target="_blank" rel="noreferrer" className={`flex items-center gap-3 p-4 rounded-xl border ${borderClass} ${bgClass} hover:brightness-95 transition-all group`}>
        <div className={`${colorClass} text-white p-2.5 rounded-full shadow-lg group-hover:scale-110 transition-transform`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{sub}</p>
        </div>
    </a>
);
