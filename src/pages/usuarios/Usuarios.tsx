import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, rolesApi } from '../../api';
import { Plus, Power, Pencil, X as XIcon, Save, RefreshCw } from 'lucide-react';
import { Spinner, BADGE, ConfirmDialog } from '../../components/ui';
import {
  PortalPerfilFields,
  emptyPortalPerfil,
  portalPerfilFromApi,
  portalPerfilToPayload,
  type PortalPerfilForm,
} from '../../components/PortalPerfilFields';

const formatNombre = (value: string) => {
  return value.replace(/[^a-zA-Z\sáéíóúÁÉÍÓÚñÑüÜ]/g, '').substring(0, 50);
};

const formatEmail = (value: string) => {
  return value.replace(/[^a-zA-Z0-9@.\-_+]/g, '');
};

export default function Usuarios({ toast, user }: { toast: (m: string, t: 'success' | 'error') => void, user: any }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [editId, setEditId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', email: '', roleId: '' });
  const [editPortalPerfil, setEditPortalPerfil] = useState<PortalPerfilForm>(emptyPortalPerfil());
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmData, setConfirmData] = useState<{ title?: string; msg: string; type?: 'primary' | 'danger'; action: () => void } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      usersApi.listar().catch(() => ({ data: { users: [] } })),
      rolesApi.listar().catch(() => ({ data: [] }))
    ]).then(([u, r]) => {
      const extractArr = (res: any) => {
        if (Array.isArray(res?.data?.data)) return res.data.data;
        if (Array.isArray(res?.data)) return res.data;
        return res?.data?.users || res?.data?.data?.items || res?.data?.items || [];
      };
      setUsers(extractArr(u));
      setRoles(extractArr(r));
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleStatus = async (id: string) => {
    try {
      await usersApi.cambiarEstado(id);
      load();
      toast('Estado del usuario actualizado', 'success');
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || 'Error al actualizar estado', 'error');
    }
  };

  const startEdit = (u: any) => {
    setEditId(u.id);
    const roleIdMatch = roles.find(r => r.nombre === u.role || r.name === u.role)?.id || u.roleId || '';
    setEditForm({
      nombre: u.nombre || u.firstName || '',
      email: u.email || '',
      roleId: roleIdMatch
    });
    setEditPortalPerfil(portalPerfilFromApi(u.portalPerfil));
  };

  const saveEdit = async (id: string | number) => {
    if (!editForm.nombre || !editForm.email || !editForm.roleId) {
      toast('Por favor complete los campos obligatorios', 'error');
      return;
    }
    setConfirmData({
      title: 'Guardar cambios',
      msg: '¿Estás seguro que deseas actualizar los datos de este usuario?',
      action: async () => {
        setSavingEdit(true);
        try {
          const dataToSend: any = { ...editForm };
          dataToSend.roleId = parseInt(dataToSend.roleId, 10);
          const pp = portalPerfilToPayload(editPortalPerfil);
          if (pp) dataToSend.portalPerfil = pp;
          
          await usersApi.actualizar(id.toString(), dataToSend);
          toast('Usuario actualizado exitosamente', 'success');
          setEditId(null);
          load();
        } catch (err: any) {
          toast(err.response?.data?.message || err.message || 'Error al actualizar usuario', 'error');
        } finally {
          setSavingEdit(false);
        }
      }
    });
  };

  const filteredUsers = users.filter(u => {
    if (u.id === user?.id) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const estadoStr = u.status === 'ACTIVE' || u.activo ? 'activo' : 'inactivo';
    return (
      (u.nombre || '').toLowerCase().includes(term) ||
      (u.firstName || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term) ||
      estadoStr.includes(term)
    );
  });

  return (
    <div className="page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900">Usuarios</h3>
          <p className="text-slate-500 mt-1 italic">Administradores y usuarios de la plataforma</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => navigate('/usuarios/nuevo')}><Plus size={16} /></button>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative max-w-xs w-full">
            <input 
              className="input w-full pr-8" 
              placeholder="Buscar…" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setSearch('')}
                title="Limpiar búsqueda"
              >
                <XIcon size={16} />
              </button>
            )}
          </div>
          <button className="btn-ghost ml-auto" onClick={load} title="Actualizar"><RefreshCw size={16} /></button>
        </div>
        {loading ? <div className="flex justify-center py-16"><Spinner size={24} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Usuario', 'Rol', 'Estado', 'Acciones'].map(h => <th key={h} className="th">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <React.Fragment key={u.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-sky-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {u.email?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{u.nombre || u.firstName || '—'}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td"><span className={BADGE[u.role] ?? 'badge badge-gray'}>{u.role || 'Sin rol'}</span></td>
                      <td className="td">
                        <span className={u.status === 'ACTIVE' || u.activo ? 'badge badge-green' : 'badge badge-red'}>
                          {u.status === 'ACTIVE' || u.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <button 
                            className={`p-2 rounded-lg transition-colors ${editId === u.id ? 'bg-orange-100 text-orange-500' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'}`} 
                            title="Editar" 
                            onClick={() => editId === u.id ? setEditId(null) : startEdit(u)}
                          >
                            <Pencil size={16} />
                          </button>
                          {u.status === 'ACTIVE' || u.activo ? (
                            <button 
                              className={`p-2 rounded-lg transition-colors ${u.role === 'SuperAdmin' ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600'}`} 
                              title={u.role === 'SuperAdmin' ? 'No se puede desactivar un SuperAdmin' : 'Desactivar usuario'}
                              disabled={u.role === 'SuperAdmin'}
                              onClick={() => { 
                                setConfirmData({
                                  title: 'Desactivar usuario',
                                  msg: `¿Estás seguro que deseas desactivar el usuario "${u.email}"?`,
                                  type: 'danger',
                                  action: () => toggleStatus(u.id)
                                }); 
                              }}
                            ><Power size={16} /></button>
                          ) : (
                            <button className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors" title="Activar usuario" onClick={() => { 
                              setConfirmData({
                                title: 'Activar usuario',
                                msg: `¿Estás seguro que deseas activar el usuario "${u.email}" nuevamente?`,
                                action: () => toggleStatus(u.id)
                              }); 
                            }}><Power size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editId === u.id && (
                      <tr>
                        <td colSpan={4} className="bg-slate-50/50 border-b border-slate-100 p-0">
                          <div className="p-4 bg-white border border-slate-200 rounded-xl m-4 shadow-sm">
                            <h4 className="font-bold text-slate-900 mb-4 text-sm">Editar</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                              <div>
                                <label className="label text-xs">Nombre *</label>
                                <input className="input" value={editForm.nombre} onChange={e => setEditForm(p => ({ ...p, nombre: formatNombre(e.target.value) }))} maxLength={50} required />
                              </div>
                              <div>
                                <label className="label text-xs">Correo electrónico *</label>
                                <input className="input" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: formatEmail(e.target.value) }))} required />
                              </div>
                              <div>
                                <label className="label text-xs">Rol *</label>
                                <select className="input" value={editForm.roleId} onChange={e => setEditForm(p => ({ ...p, roleId: e.target.value }))} required>
                                  <option value="" selected disabled>Seleccione...</option>
                                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre || r.name}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="mb-4">
                              <PortalPerfilFields value={editPortalPerfil} onChange={setEditPortalPerfil} />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button type="button" className="btn-secondary text-xs px-4 py-2" onClick={() => setEditId(null)}>Cancelar</button>
                              <button type="button" className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5" disabled={savingEdit} onClick={() => saveEdit(u.id)}>
                                {savingEdit ? <><Spinner size={14} /> Guardando…</> : 'Guardar'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {filteredUsers.length === 0 && <tr><td colSpan={4} className="td text-center py-16 text-slate-400"><div className="text-3xl mb-2">👤</div><p className="font-medium">Sin usuarios encontrados</p></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmData && (
        <ConfirmDialog
          title={confirmData.title}
          msg={confirmData.msg}
          type={confirmData.type}
          onConfirm={confirmData.action}
          onCancel={() => setConfirmData(null)}
        />
      )}
    </div>
  );
}