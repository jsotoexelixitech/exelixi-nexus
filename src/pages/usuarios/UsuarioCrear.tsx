import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, companiesApi, rolesApi } from '../../api';
import { X } from 'lucide-react';
import { Spinner, ConfirmDialog } from '../../components/ui';
import {
  PortalPerfilFields,
  emptyPortalPerfil,
  portalPerfilToPayload,
  type PortalPerfilForm,
} from '../../components/PortalPerfilFields';

const formatNombre = (value: string) => {
  return value.replace(/[^a-zA-Z\sáéíóúÁÉÍÓÚñÑüÜ]/g, '').substring(0, 50);
};

const formatEmail = (value: string) => {
  return value.replace(/[^a-zA-Z0-9@.\-_+]/g, '');
};

export default function UsuarioCrear({ toast }: { toast: (m: string, t: 'success' | 'error') => void }) {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', roleId: '', empresaId: '' });
  const [portalPerfil, setPortalPerfil] = useState<PortalPerfilForm>(emptyPortalPerfil());
  const [confirmData, setConfirmData] = useState<{ title?: string; msg: string; type?: 'primary' | 'danger'; action: () => void } | null>(null);

  useEffect(() => {
    Promise.all([
      companiesApi.listar().catch(() => ({ data: [] })),
      rolesApi.listar().catch(() => ({ data: [] }))
    ]).then(([c, r]) => {
      const extractArr = (res: any) => Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : (res?.data?.data?.items || res?.data?.items || []);
      setCompanies(extractArr(c));
      setRoles(extractArr(r));
    }).finally(() => setLoading(false));
  }, []);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setConfirmData({
      title: 'Crear usuario',
      msg: '¿Estás seguro que deseas registrar este nuevo usuario?',
      action: async () => {
        setSaving(true);
        try {
          const dataToSend: any = { ...form };
          if (dataToSend.roleId) dataToSend.roleId = parseInt(dataToSend.roleId, 10);
          if (dataToSend.empresaId) dataToSend.empresaId = parseInt(dataToSend.empresaId, 10);
          else dataToSend.empresaId = null;
          const pp = portalPerfilToPayload(portalPerfil);
          if (pp) dataToSend.portalPerfil = pp;

          await usersApi.crear(dataToSend);
          toast('Usuario creado exitosamente', 'success');
          navigate('/usuarios');
        } catch (err: any) {
          toast(err.response?.data?.message || err.message || 'Error al crear usuario', 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={32} /></div>;
  }

  return (
    <div className="page-enter">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/usuarios')} className="btn-ghost btn-icon text-slate-500 hover:text-slate-900"><X size={20} /></button>
        <div>
          <h3 className="text-xl font-extrabold text-slate-900">Nuevo Usuario</h3>
          <p className="text-slate-500 mt-1 italic">Ingrese los detalles para registrar un nuevo usuario.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: formatNombre(e.target.value) }))} placeholder="Juan Pérez" maxLength={50} required />
            </div>
            <div>
              <label className="label">Correo electrónico *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: formatEmail(e.target.value) }))} placeholder="usuario@empresa.com" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Rol *</label>
                <select className="input" value={form.roleId} onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))} required>
                  <option value="" selected disabled>Seleccione un rol...</option>
                  {roles.map(r => <option key={r.id} value={r.id || r.nombre || r.name}>{r.nombre || r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Empresa</label>
                <select className="input" value={form.empresaId} onChange={e => setForm(p => ({ ...p, empresaId: e.target.value }))}>
                  <option value="">Sin empresa (Global)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>

            <PortalPerfilFields value={portalPerfil} onChange={setPortalPerfil} />
            
            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => navigate('/usuarios')}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? <><Spinner /> Guardando…</> : 'Guardar'}</button>
            </div>
          </form>
        </div>
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
