import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Mail, Edit2, Trash2, Loader2, Plus, X, Save, AlertTriangle, PieChart } from 'lucide-react';
import { ApiService } from '../services/api';
import { Comercio, CommercePlan } from '../types';

export const Commerce = () => {
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [quota, setQuota] = useState<{ used: number, limit: number, percent: number, is_full: boolean } | null>(null);

  // Estados para Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado del Formulario
  const initialFormState = {
    nombre: '',
    cuit: '',
    categoria: '',
    barrio: '',
    provincia: 'Corrientes',
    ubicacion: '',
    descripcion: '',
    logo_url: '',
    direccion: '',
    telefono: '',
    email: '',
    temp_password: Math.random().toString(36).slice(-8).toUpperCase(),
    municipio_id: '10b7a9bf-9de0-4f79-b060-2c23a30b26e0',
    camara_id: '',
    tipo_plan: 'gratuito' as CommercePlan
  };
  const [formData, setFormData] = useState(initialFormState);

  const fetchData = async () => {
    try {
      const [dataComercios, dataQuota] = await Promise.all([
        ApiService.comercios.getAll(),
        ApiService.stats.getQuota()
      ]);
      setComercios(dataComercios);
      setQuota(dataQuota);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // UX Fix: Auto-switch to premium if quota is full on open
  useEffect(() => {
    if (isModalOpen && !editingId && quota?.is_full) {
      setFormData(prev => ({ ...prev, tipo_plan: 'premium' }));
    }
  }, [isModalOpen, editingId, quota]);

  // --- MANEJADORES ---

  const handleOpenAdd = () => {
    setEditingId(null);
    setErrorMessage(null);
    // Inicializar con premium si corresponde, sino gratuito
    const initialPlan: CommercePlan = quota?.is_full ? 'premium' : 'gratuito';
    setFormData({ ...initialFormState, tipo_plan: initialPlan });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (comercio: Comercio) => {
    setEditingId(comercio.id);
    setErrorMessage(null);
    setFormData({
      nombre: comercio.nombre,
      cuit: comercio.cuit || '',
      categoria: comercio.categoria || '',
      barrio: comercio.barrio || '',
      provincia: comercio.provincia || 'Corrientes',
      ubicacion: comercio.ubicacion || '',
      descripcion: comercio.descripcion || '',
      logo_url: comercio.logo_url || '',
      direccion: comercio.direccion || '',
      telefono: comercio.telefono || '',
      email: comercio.email || '',
      temp_password: '', // No se edita aquí por seguridad inicial
      municipio_id: comercio.municipio_id,
      camara_id: comercio.camara_id || '',
      tipo_plan: comercio.tipo_plan || 'gratuito'
    });
    setIsModalOpen(true);
  };

  const handleOpenDelete = (id: string) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationLoading(true);
    setErrorMessage(null);
    try {
      if (editingId) {
        await ApiService.comercios.update(editingId, formData);
      } else {
        await ApiService.comercios.adminCreate(formData);
      }
      await fetchData(); // Refresh list and quota
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving comercio:", error);
      // UX: Mensaje de error amigable si es límite de cupo
      if (error.message.includes("Límite") || error.message.includes("excedido")) {
        setErrorMessage("🚫 Se alcanzó el límite de comercios gratuitos (10). Para agregar más, utilice el Plan Premium.");
      } else {
        // Mostrar mensaje real del error (Backend/DB)
        setErrorMessage(error.message || "Error al guardar. Intente nuevamente.");
      }
    } finally {
      setOperationLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setOperationLoading(true);
    try {
      await ApiService.comercios.delete(deletingId);
      await fetchData();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting comercio:", error);
      alert("Error al eliminar. Intente nuevamente.");
    } finally {
      setOperationLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
    try {
      setComercios(comercios.map(c => c.id === id ? { ...c, estado: newStatus } : c));
      await ApiService.comercios.update(id, { estado: newStatus });
    } catch (error) {
      console.error("Error toggling commerce status:", error);
      fetchData();
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-rural-green" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-rural-green">Comercios Adheridos</h2>
          <p className="text-gray-500">Gestión de beneficios y puntos de venta.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-rural-brown text-white px-4 py-2 rounded-lg hover:bg-[#6d360f] transition-colors shadow-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Agregar Comercio
        </button>
      </div>

      {/* --- QUOTA INDICATOR (UX PRO) --- */}
      {quota && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-6">
          <div className="bg-blue-50 p-3 rounded-full text-blue-600">
            <PieChart className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-bold text-gray-700">Cupo Plan Gratuito</span>
              <span className={`text-sm font-bold ${quota.is_full ? 'text-red-600' : 'text-blue-600'}`}>
                {quota.used} / {quota.limit} utilizados
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${quota.is_full ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(quota.percent, 100)}%` }}
              ></div>
            </div>
            {quota.is_full && (
              <p className="text-xs text-red-500 mt-1 font-medium">
                Has alcanzado el límite de 10 comercios gratuitos. Nuevos registros deberán ser Premium.
              </p>
            )}
          </div>
        </div>
      )}

      {comercios.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-800 mb-1">Sin comercios aún</h3>
          <p className="text-gray-500 max-w-xs mx-auto mb-6">Comienza agregando los comercios adheridos para mostrar los beneficios a los socios.</p>
          <button
            onClick={handleOpenAdd}
            className="bg-rural-green text-white px-6 py-2 rounded-lg font-medium hover:bg-green-900 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Crear Comercio
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Comercio / CUIT</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Rubro / Ubicación</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {comercios.map((comercio) => (
                  <tr key={comercio.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-rural-green font-bold">
                          {comercio.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900">{comercio.nombre}</span>
                          <span className="text-xs text-gray-500">CUIT: {comercio.cuit || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-rural-brown">{comercio.categoria || comercio.rubro || 'General'}</span>
                        <span className="text-xs text-gray-500">{comercio.ubicacion || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(comercio.id, comercio.estado || 'activo')}
                          className={`flex items-center gap-1 text-[10px] font-bold uppercase transition-colors px-2 py-0.5 rounded-md ${comercio.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : comercio.estado === 'inactivo' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${comercio.estado === 'pendiente' ? 'bg-yellow-500' : comercio.estado === 'inactivo' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                          {comercio.estado || 'activo'}
                        </button>
                        {comercio.estado === 'pendiente' && (
                          <button
                            onClick={async () => {
                              await ApiService.comercios.approve(comercio.id);
                              fetchData();
                            }}
                            className="bg-rural-green text-white text-[10px] px-2 py-0.5 rounded hover:bg-green-900 transition-colors"
                          >
                            APROBAR
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(comercio)}
                          className="p-2 text-gray-400 hover:text-rural-green hover:bg-green-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(comercio.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* --- MODAL AGREGAR / EDITAR --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-serif font-bold text-lg text-rural-green">
                {editingId ? 'Editar Comercio' : 'Nuevo Comercio'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col max-h-[85vh]">
              {/* Contenido con Scroll */}
              <div className="p-6 overflow-y-auto space-y-4">
                {errorMessage && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{errorMessage}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.cuit}
                      onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                      placeholder="20123456789"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Temporal</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none font-mono"
                      value={formData.temp_password}
                      onChange={(e) => setFormData({ ...formData, temp_password: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría / Rubro</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      placeholder="Ej: Veterinaria, Supermercado"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none bg-white"
                      value={formData.tipo_plan}
                      onChange={(e) => setFormData({ ...formData, tipo_plan: e.target.value as CommercePlan })}
                    >
                      <option value="gratuito">Plan Gratuito (Hasta 10)</option>
                      <option value="premium">Plan Premium (Ilimitado)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barrio</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.barrio}
                      onChange={(e) => setFormData({ ...formData, barrio: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.provincia}
                      onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación (Google Maps / Referencia)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Exacta</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL Logo/Imagen</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Negocio</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      rows={2}
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Footer con botones fijos */}
              <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={operationLoading || (!editingId && quota?.is_full && formData.tipo_plan === 'gratuito')}
                  className="px-4 py-2 bg-rural-green text-white rounded-lg text-sm font-medium hover:bg-green-900 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {operationLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {operationLoading ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL CONFIRMACIÓN ELIMINAR --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar comercio?</h3>
            <p className="text-gray-500 text-sm mb-6">Esta acción no se puede deshacer. Se eliminarán los datos del comercio permanentemente.</p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={operationLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2"
              >
                {operationLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {operationLoading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};