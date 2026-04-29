import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';
import GestionDependientes from '../components/GestionDependientes';
import { motion } from 'framer-motion';

export default function Perfil() {
  const { user, token, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [municipiosDisponibles, setMunicipiosDisponibles] = useState<{ id: string; nombre: string }[]>([]);
  const [editData, setEditData] = useState({
    direccion: user?.direccion || '',
    telefono: user?.telefono || '',
    municipio: user?.municipio || '',
    barrio: user?.barrio || '',     // Barrio (nuevo)
    email: user?.email || ''
  });
  const [soundEnabled, setSoundEnabled] = useState(user?.sonido_notificaciones_habilitado ?? true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Cargar municipios al entrar en modo edición
  React.useEffect(() => {
    if (isEditing) {
      const fetchMunicipios = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`);
          const data = await res.json();
          if (data.municipios) setMunicipiosDisponibles(data.municipios);
        } catch (err) {
          console.error('Error cargando municipios:', err);
        }
      };
      fetchMunicipios();
    }
  }, [isEditing]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePencilClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar formato
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setStatusMsg({ type: 'error', text: 'Formato no permitido.' });
      return;
    }
    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMsg({ type: 'error', text: 'Imagen muy pesada (máx 5MB).' });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setStatusMsg({ type: 'info', text: 'Vista previa lista. Click en el círculo para confirmar.' });
  };

  const handleFileChange = async () => {
    if (!logoFile) return;

    setLoading(true);
    setStatusMsg({ type: 'info', text: 'Subiendo foto...' });

    const formData = new FormData();
    formData.append('file', logoFile);

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/perfil/foto`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401) window.dispatchEvent(new Event('auth-unauthorized'));
        throw new Error(data.detail || 'Error al subir foto');
      }

      const finalUrl = `${data.foto_url}${data.foto_url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      updateUser({ foto_url: finalUrl });
      setStatusMsg({ type: 'success', text: '✔ Foto actualizada con éxito' });
      setLogoPreview(null);
      setLogoFile(null);
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: 'info', text: 'Actualizando perfil...' });

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editData)
      });

      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401) window.dispatchEvent(new Event('auth-unauthorized'));
        throw new Error(data.detail || 'Error al actualizar perfil');
      }

      updateUser(data.user);
      setIsEditing(false);

      if (editData.email && editData.email !== user?.email) {
        setStatusMsg({ type: 'info', text: 'Email actualizado. Redirigiendo al login...' });
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
        return;
      }

      setStatusMsg({ type: 'success', text: 'Perfil actualizado' });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSoundToggle = async () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    setStatusMsg({ type: 'info', text: 'Actualizando preferencia de sonido...' });

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/preferencias/sonido`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sonido_habilitado: newValue })
      });

      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401) window.dispatchEvent(new Event('auth-unauthorized'));
        throw new Error(data.detail || 'Error al actualizar preferencia');
      }

      updateUser({ sonido_notificaciones_habilitado: newValue });
      setStatusMsg({ type: 'success', text: newValue ? 'Sonido activado' : 'Sonido desactivado' });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 2000);
    } catch (err: any) {
      setSoundEnabled(!newValue);
      setStatusMsg({ type: 'error', text: `Error: ${err.message}` });
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
        <header className="sticky top-0 z-50 flex items-center bg-white/80 dark:bg-stone-900/80 backdrop-blur-md p-4 justify-between border-b border-stone-200/50 dark:border-stone-700/50">
          <Link to="/home" className="text-stone-800 dark:text-stone-100 flex size-10 items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-stone-800 dark:text-stone-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center font-display uppercase italic text-nowrap">Mi Perfil</h1>
          <div className="flex w-10"></div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6 space-y-8">
          <section className="relative p-8 rounded-[2.5rem] bg-white dark:bg-stone-800 shadow-xl border border-stone-200/50 dark:border-stone-700/50 flex flex-col items-center">
            {/* Ornamento */}
            <div className="absolute top-0 right-0 p-6 text-[#245b31]/5 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-8xl">eco</span>
            </div>

            <div className="relative mb-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <div
                onClick={() => logoPreview ? handleFileChange() : handlePencilClick()}
                className={`size-32 rounded-[3rem] bg-stone-100 dark:bg-stone-900 border-4 shadow-2xl overflow-hidden flex items-center justify-center text-5xl font-black uppercase transition-all cursor-pointer ${logoPreview ? 'border-[#245b31] scale-105' : 'border-white dark:border-stone-700'}`}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="w-full h-full object-cover animate-pulse" />
                ) : user?.foto_url ? (
                  <img src={user.foto_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-stone-300 font-display">{user?.nombre_apellido?.charAt(0) || 'S'}</span>
                )}
              </div>
              <button
                onClick={logoPreview ? handleFileChange : handlePencilClick}
                disabled={loading}
                className={`absolute -bottom-2 -right-2 size-10 rounded-2xl shadow-lg border-2 border-white dark:border-stone-800 flex items-center justify-center active:scale-90 transition-all ${logoPreview ? 'bg-emerald-500 text-white' : 'bg-[#245b31] text-white'}`}
              >
                <span className="material-symbols-outlined text-xl">{logoPreview ? 'check' : 'photo_camera'}</span>
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="w-full space-y-5">
                <div className="space-y-4">
                  {[
                    { label: 'Dirección', value: editData.direccion, key: 'direccion', icon: 'home' },
                    { label: 'Teléfono', value: editData.telefono, key: 'telefono', icon: 'call' },
                    { label: 'Barrio', value: editData.barrio, key: 'barrio', icon: 'location_on' },
                    { label: 'Email', value: editData.email, key: 'email', icon: 'mail', type: 'email' }
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{field.label}</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg">{field.icon}</span>
                        <input
                          type={field.type || 'text'}
                          value={field.value}
                          onChange={e => setEditData({ ...editData, [field.key]: e.target.value })}
                          className="w-full bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 rounded-2xl h-14 pl-12 pr-4 text-stone-800 dark:text-stone-200 outline-none focus:border-[#245b31] transition-all font-bold"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Municipio / Localidad</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg">apartment</span>
                      <select
                        value={editData.municipio}
                        onChange={e => setEditData({ ...editData, municipio: e.target.value })}
                        className="w-full bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 rounded-2xl h-14 pl-12 pr-10 text-stone-800 dark:text-stone-200 outline-none focus:border-[#245b31] transition-all font-bold appearance-none"
                      >
                        <option value="">Seleccioná localidad</option>
                        {municipiosDisponibles.map(m => (
                          <option key={m.id} value={m.nombre}>{m.nombre}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-stone-400">expand_more</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-4 rounded-2xl text-stone-500 font-black uppercase tracking-widest text-[10px] bg-stone-100 dark:bg-stone-900 active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 rounded-2xl bg-[#245b31] text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#245b31]/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="w-full text-center space-y-4">
                <div>
                  <h2 className="text-2xl font-black text-stone-800 dark:text-white uppercase italic tracking-tighter leading-none font-display">{user?.nombre_apellido}</h2>
                  <p className="text-[#a87f5d] text-[10px] font-black uppercase tracking-[0.2em] mt-1">{user?.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  {[
                    { icon: 'apartment', text: user?.municipio || 'No especificado', label: 'Localidad' },
                    { icon: 'location_on', text: user?.direccion || 'Sin dirección', label: 'Dirección' },
                    { icon: 'call', text: user?.telefono || 'Sin teléfono', label: 'Teléfono' },
                    { icon: 'badge', text: user?.rol || 'Socio', label: 'Rol' }
                  ].map((item, idx) => (
                    <div key={idx} className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200/50 dark:border-stone-700/50 text-left">
                      <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1 block">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-stone-400 text-sm">{item.icon}</span>
                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300 truncate">{item.text}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full mt-6 py-4 rounded-2xl bg-[#f4eedd] border border-[#e5dfce] text-[#784e32] text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-[#e5dfce] active:scale-95 transition-all"
                >
                  Editar Perfil
                </button>
              </div>
            )}
          </section>

          {statusMsg.text && (
             <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border ${
                statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                statusMsg.type === 'error' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 
                'bg-[#245b31]/10 text-[#245b31] border-[#245b31]/20'
              }`}
            >
              {statusMsg.text}
            </motion.div>
          )}

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 px-2">Configuración y Seguridad</h3>
            <div className="bg-white dark:bg-stone-800 rounded-[2rem] shadow-xl border border-stone-200/50 dark:border-stone-700/50 overflow-hidden">
              {user?.rol !== 'ADMIN' && (
                <Link to="/cambio-password" title="Seguridad" className="flex items-center gap-4 p-5 border-b border-stone-100 dark:border-stone-700/50 active:bg-stone-50 dark:active:bg-stone-900 transition-all">
                  <div className="size-12 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">lock</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-stone-800 dark:text-stone-100">Seguridad</p>
                    <p className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">Cambiar contraseña</p>
                  </div>
                  <span className="material-symbols-outlined text-stone-300">chevron_right</span>
                </Link>
              )}
              
              <div className="flex items-center gap-4 p-5 border-b border-stone-100 dark:border-stone-700/50 active:bg-stone-50 dark:active:bg-stone-900 transition-all">
                <div className="size-12 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">notifications_active</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-stone-800 dark:text-stone-100">Notificaciones</p>
                  <p className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">Sonido habilitado</p>
                </div>
                <button
                  onClick={handleSoundToggle}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${soundEnabled ? 'bg-[#245b31]' : 'bg-stone-200 dark:bg-stone-700'}`}
                >
                  <motion.div 
                    animate={{ x: soundEnabled ? 26 : 4 }}
                    className="absolute top-1 size-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              <Link to="/preferencias" title="Preferencias" className="flex items-center gap-4 p-5 active:bg-stone-50 dark:active:bg-stone-900 transition-all">
                <div className="size-12 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">tune</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-stone-800 dark:text-stone-100">Preferencias</p>
                  <p className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">Personalizar app</p>
                </div>
                <span className="material-symbols-outlined text-stone-300">chevron_right</span>
              </Link>
            </div>
          </section>

          {user?.rol !== 'COMERCIO' && <GestionDependientes />}

          <div className="pt-4 space-y-8">
            <button 
              onClick={handleLogout} 
              className="w-full py-5 rounded-[2rem] bg-white dark:bg-stone-800 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-red-500/5 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">logout</span>
              Cerrar Sesión
            </button>

            <div className="text-center opacity-40">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500">Sociedad Rural</p>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-stone-400 mt-1">Versión 2.4.0 • 2024</p>
            </div>
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
