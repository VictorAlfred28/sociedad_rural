import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';
import GestionDependientes from '../components/GestionDependientes';

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
    email: user?.email || ''
  });
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
      if (err.message.includes("Token expirado")) {
        // Ya se disparó el evento en el fetch, o podemos dispararlo aquí si no estamos seguros
      }
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

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-x-hidden">
      <div className="flex items-center bg-background-light dark:bg-background-dark p-4 sticky top-0 z-10 border-b border-primary/10 justify-between">
        <Link to="/home" className="text-slate-900 dark:text-slate-100 flex size-10 shrink-0 items-center justify-center cursor-pointer">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Mi Perfil</h2>
      </div>

      <div className="flex p-6">
        <div className="flex w-full flex-col gap-6 items-center">
          <div className="flex gap-4 flex-col items-center">
            <div className="relative group">
              <div className="hidden">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                />
              </div>
              <div
                onClick={() => logoPreview ? handleFileChange() : handlePencilClick()}
                className={`bg-primary/20 bg-center bg-no-repeat aspect-square bg-cover rounded-full border-4 shadow-lg min-h-32 w-32 overflow-hidden flex items-center justify-center text-primary text-5xl font-bold uppercase transition-all cursor-pointer ${logoPreview ? 'ring-4 ring-primary ring-offset-4 ring-offset-white dark:ring-offset-slate-900 shadow-primary/30' : 'border-white dark:border-slate-800'}`}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="w-full h-full object-cover animate-pulse" />
                ) : user?.foto_url ? (
                  <img src={user.foto_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.nombre_apellido ? user.nombre_apellido.charAt(0) : 'S'
                )}
              </div>
              <button
                onClick={logoPreview ? handleFileChange : handlePencilClick}
                disabled={loading}
                className={`absolute bottom-0 right-0 p-2 rounded-full shadow-md border-2 border-white dark:border-slate-800 flex items-center justify-center active:scale-90 transition-all cursor-pointer ${logoPreview ? 'bg-emerald-500 text-white' : 'bg-primary text-slate-900'}`}
              >
                <span className="material-symbols-outlined text-sm">{logoPreview ? 'check' : 'edit'}</span>
              </button>
            </div>

            <div className="flex flex-col items-center justify-center w-full">
              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="w-full space-y-4 px-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dirección</label>
                    <input
                      type="text"
                      value={editData.direccion}
                      onChange={e => setEditData({ ...editData, direccion: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl h-12 px-4 text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-colors text-lg font-bold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                    <input
                      type="text"
                      value={editData.telefono}
                      onChange={e => setEditData({ ...editData, telefono: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl h-12 px-4 text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-colors font-medium"
                      placeholder="Tu teléfono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Municipio / Localidad</label>
                    <div className="relative">
                      <select
                        value={editData.municipio}
                        onChange={e => setEditData({ ...editData, municipio: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl h-12 px-4 text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-colors font-medium appearance-none"
                      >
                        <option value="">Seleccioná un municipio</option>
                        {municipiosDisponibles.map(m => (
                          <option key={m.id} value={m.nombre}>{m.nombre}</option>
                        ))}
                        <option value="No especificado">No especificado</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Correo electrónico</label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={e => setEditData({ ...editData, email: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl h-12 px-4 text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-colors font-medium"
                      placeholder="Tu correo electrónico"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 h-11 rounded-xl text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 h-11 rounded-xl bg-primary text-slate-900 font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-tight text-center">{user?.nombre_apellido || 'Cargando...'}</p>
                  <p className="text-primary font-medium text-base leading-normal text-center mb-1">{user?.email || 'N/A'}</p>

                  {user?.municipio && (
                    <p className="text-slate-600 dark:text-slate-300 font-medium text-sm mt-1 text-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1 text-primary">apartment</span>
                      {user.municipio}
                    </p>
                  )}
                  {user?.direccion && (
                    <p className="text-slate-600 dark:text-slate-300 font-medium text-sm mt-1 text-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1 text-primary">location_on</span>
                      {user.direccion}
                    </p>
                  )}
                  {user?.telefono && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 text-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1 text-primary">call</span>
                      {user.telefono}
                    </p>
                  )}
                  <p className="text-slate-500 font-medium text-sm leading-normal text-center uppercase tracking-widest mt-2">{user?.rol}</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-6 flex min-w-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-11 px-6 bg-primary text-slate-900 text-sm font-bold shadow-sm active:scale-95 transition-transform"
                  >
                    <span className="truncate">Editar Perfil</span>
                  </button>
                </>
              )}
            </div>
          </div>
          {statusMsg.text && (
            <div className={`mt-2 p-3 rounded-xl text-xs font-bold text-center animate-in fade-in slide-in-from-top-2 border ${statusMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
              statusMsg.type === 'error' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                'bg-primary/20 text-primary-light border-primary/30'
              }`}>
              {statusMsg.text}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 pb-24">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest pb-3 pt-4 px-2">Configuración</h3>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-primary/5 overflow-hidden">
          {user?.rol !== 'ADMIN' && (
            <Link to="/cambio-password" className="flex items-center gap-4 px-4 py-4 border-b border-slate-50 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 transition-colors cursor-pointer">
              <div className="flex items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 size-10">
                <span className="material-symbols-outlined">lock</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-base font-medium flex-1">Seguridad</p>
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
            </Link>
          )}
          <Link to="/preferencias" className="flex items-center gap-4 px-4 py-4 active:bg-slate-50 dark:active:bg-slate-800 transition-colors cursor-pointer">
            <div className="flex items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 size-10">
              <span className="material-symbols-outlined">settings</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-base font-medium flex-1">Preferencias</p>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
          </Link>
        </div>

        {user?.rol !== 'COMERCIO' && <GestionDependientes />}


        <div className="mt-8 px-2">
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl h-12 border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-semibold active:bg-red-100 dark:active:bg-red-900/20 transition-colors">
            <span className="material-symbols-outlined text-lg">logout</span>
            <span>Cerrar Sesión</span>
          </button>
        </div>

        <div className="mt-12 mb-8 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">Sociedad Rural Norte de Corrientes</p>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] mt-1">Versión 2.4.0</p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
