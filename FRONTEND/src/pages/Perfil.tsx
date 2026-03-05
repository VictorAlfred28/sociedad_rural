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
  const [editData, setEditData] = useState({
    nombre_apellido: user?.nombre_apellido || '',
    telefono: user?.telefono || ''
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePencilClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMsg('Subiendo foto...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/perfil/foto`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Error al subir foto');

      updateUser(data.user || { ...user, foto_url: data.foto_url });
      setStatusMsg('Foto actualizada con éxito');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('Actualizando perfil...');

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
      if (!resp.ok) throw new Error(data.detail || 'Error al actualizar perfil');

      updateUser(data.user);
      setIsEditing(false);
      setStatusMsg('Perfil actualizado');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
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
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
              />
              <div className="bg-primary/20 bg-center bg-no-repeat aspect-square bg-cover rounded-full border-4 border-white dark:border-slate-800 shadow-lg min-h-32 w-32 overflow-hidden flex items-center justify-center text-primary text-5xl font-bold uppercase">
                {user?.foto_url ? (
                  <img src={user.foto_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.nombre_apellido ? user.nombre_apellido.charAt(0) : 'S'
                )}
              </div>
              <button
                onClick={handlePencilClick}
                disabled={loading}
                className="absolute bottom-0 right-0 bg-primary text-slate-900 p-2 rounded-full shadow-md border-2 border-white dark:border-slate-800 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
            </div>

            <div className="flex flex-col items-center justify-center w-full">
              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="w-full space-y-4 px-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre y Apellido</label>
                    <input
                      type="text"
                      value={editData.nombre_apellido}
                      onChange={e => setEditData({ ...editData, nombre_apellido: e.target.value })}
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
                  <p className="text-primary font-medium text-base leading-normal text-center">{user?.email || 'N/A'}</p>
                  {user?.telefono && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{user.telefono}</p>
                  )}
                  <p className="text-slate-500 font-medium text-sm leading-normal text-center uppercase tracking-widest mt-1">{user?.rol}</p>
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
          {statusMsg && (
            <div className={`text-center text-sm px-4 py-2 rounded-lg ${statusMsg.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
              {statusMsg}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 pb-24">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest pb-3 pt-4 px-2">Configuración</h3>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-primary/5 overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-50 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 transition-colors cursor-pointer">
            <div className="flex items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 size-10">
              <span className="material-symbols-outlined">lock</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-base font-medium flex-1">Seguridad</p>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
          </div>
          <div className="flex items-center gap-4 px-4 py-4 active:bg-slate-50 dark:active:bg-slate-800 transition-colors cursor-pointer">
            <div className="flex items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 size-10">
              <span className="material-symbols-outlined">settings</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-base font-medium flex-1">Preferencias</p>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
          </div>
        </div>

        <GestionDependientes />

        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest pb-3 pt-8 px-2">Visualización</h3>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-primary/5 overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-4">
            <div className="flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 size-10">
              <span className="material-symbols-outlined">{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
            </div>
            <div className="flex flex-col flex-1">
              <p className="text-slate-700 dark:text-slate-300 text-base font-medium">Modo Oscuro</p>
              <p className="text-slate-400 text-xs">Ajustar apariencia del sistema</p>
            </div>
            <div
              onClick={toggleTheme}
              className="relative inline-flex items-center cursor-pointer"
            >
              <div className={`w-11 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </div>
          </div>
        </div>

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
