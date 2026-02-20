import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, XCircle, MoreHorizontal, QrCode, Loader2, Plus, X, Save, RefreshCw, CreditCard } from 'lucide-react';
import { ApiService } from '../services/api';
import { Profile, UserRole, UserStatus } from '../types';

export const Members = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    password: '', // Necesario para crear usuario
    rol: 'comun'
  });

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await ApiService.socios.getAll();
      setMembers(data);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      // Optimistic update
      setMembers(members.map(m => m.id === id ? { ...m, estado: 'activo' } : m));
      await ApiService.socios.approve(id);
    } catch (error) {
      console.error("Error approving member:", error);
      fetchMembers(); // Revert on error
    }
  };

  const handleSaveSocio = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationLoading(true);
    try {
      await ApiService.socios.create(formData);
      await fetchMembers();
      setIsModalOpen(false);
      setFormData({ nombre: '', apellido: '', dni: '', email: '', password: '', rol: 'comun' });
      alert("Socio creado exitosamente");
    } catch (error: any) {
      console.error("Error creating socio:", error);
      alert(error.message || "Error al crear socio. Verifique que el Backend esté activo.");
    } finally {
      setOperationLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
    const term = searchTerm.toLowerCase();
    const fullName = `${member.nombre} ${member.apellido}`.toLowerCase();

    const matchesSearch =
      fullName.includes(term) ||
      (member.email?.toLowerCase() || '').includes(term) ||
      (member.dni || '').includes(term);

    const matchesRole = filterRole === 'all' || member.rol === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
    try {
      setMembers(members.map(m => m.id === id ? { ...m, estado: newStatus } : m));
      await ApiService.socios.update(id, { estado: newStatus });
    } catch (error) {
      console.error("Error toggling status:", error);
      fetchMembers();
    }
  };

  const handleToggleMoroso = async (id: string, currentMoroso: boolean) => {
    try {
      setMembers(members.map(m => m.id === id ? { ...m, is_moroso: !currentMoroso } : m));
      await ApiService.socios.update(id, { is_moroso: !currentMoroso });
    } catch (error) {
      console.error("Error toggling moroso:", error);
      fetchMembers();
    }
  };

  const StatusBadge = ({ status, isMoroso }: { status: string, isMoroso?: boolean }) => {
    const safeStatus = (status || 'pendiente').toLowerCase();

    const styles: Record<string, string> = {
      activo: 'bg-green-100 text-green-800 border-green-200',
      pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      inactivo: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <div className="flex flex-col gap-1">
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border w-fit ${styles[safeStatus] || styles.pendiente}`}>
          {safeStatus.toUpperCase()}
        </span>
        {isMoroso && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-200 bg-amber-100 text-amber-800 w-fit">
            DEUDA
          </span>
        )}
      </div>
    );
  };

  const RoleBadge = ({ role }: { role: string }) => {
    const safeRole = (role || 'comun').toLowerCase();
    const styles: Record<string, string> = {
      comun: 'text-gray-600 bg-gray-100',
      profesional: 'text-rural-green bg-rural-green/10 font-semibold',
      comercial: 'text-rural-brown bg-rural-brown/10',
      admin: 'text-purple-700 bg-purple-100',
      superadmin: 'text-purple-900 bg-purple-200 font-bold',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${styles[safeRole] || styles.comun}`}>
        {safeRole === 'comun' ? 'Socio Común' : safeRole.charAt(0).toUpperCase() + safeRole.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-rural-green">Gestión de Socios</h2>
          <p className="text-gray-500">Administra el padrón, aprobaciones y estados de cuenta.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMembers}
            className="bg-white text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            title="Recargar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-rural-green text-white px-4 py-2 rounded-lg hover:bg-green-900 transition-colors shadow-lg shadow-rural-green/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nuevo Socio
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o DNI..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-rural-green outline-none bg-white w-full md:w-auto"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
            >
              <option value="all">Todos los roles</option>
              <option value="comun">Común</option>
              <option value="profesional">Profesional</option>
              <option value="comercial">Comercial</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-rural-green" />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Socio</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Ubicación</th>
                  <th className="px-6 py-4">Estado / Pago</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rural-green/10 flex items-center justify-center text-rural-green font-bold">
                          {(member.nombre || '?').charAt(0)}{(member.apellido || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{member.apellido}, {member.nombre}</p>
                          <p className="text-gray-500 text-xs">DNI: {member.dni}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={member.rol} />
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {member.ciudad || 'Corrientes'}, {member.provincia || 'Corrientes'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={member.estado} isMoroso={member.is_moroso} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {member.estado === 'pendiente' ? (
                          <button
                            onClick={() => handleApprove(member.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Aprobar para Ingreso"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleMoroso(member.id, !!member.is_moroso)}
                              className={`p-1.5 rounded-lg transition-colors ${member.is_moroso ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50'}`}
                              title={member.is_moroso ? "Marcar como Al Día" : "Marcar Deuda"}
                            >
                              <CreditCard className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(member.id, member.estado)}
                              className={`p-1.5 rounded-lg transition-colors ${member.estado === 'activo' ? 'text-red-400 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                              title={member.estado === 'activo' ? "Desactivar Socio" : "Activar Socio"}
                            >
                              {member.estado === 'activo' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                            </button>
                          </>
                        )}
                        <button className="p-1.5 text-gray-400 hover:text-rural-green hover:bg-gray-100 rounded-lg">
                          <QrCode className="w-5 h-5" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && filteredMembers.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p>No se encontraron socios con los filtros aplicados.</p>
              <button onClick={fetchMembers} className="mt-2 text-rural-green hover:underline">Intentar actualizar</button>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL NUEVO SOCIO --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-serif font-bold text-lg text-rural-green">Alta de Nuevo Socio</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSocio} className="p-6 space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                <p className="text-xs text-yellow-800">
                  <strong>Nota:</strong> Esta acción creará un usuario de acceso (Auth) y un perfil.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI (Usuario)</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Temporal</label>
                <input
                  type="password"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green focus:ring-1 focus:ring-rural-green outline-none"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-rural-green outline-none bg-white"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                >
                  <option value="comun">Socio Común</option>
                  <option value="profesional">Profesional</option>
                  <option value="comercial">Comercial</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={operationLoading}
                  className="px-4 py-2 bg-rural-green text-white rounded-lg text-sm font-medium hover:bg-green-900 flex items-center gap-2"
                >
                  {operationLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {operationLoading ? 'Guardando...' : <><Save className="w-4 h-4" /> Crear Socio</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};