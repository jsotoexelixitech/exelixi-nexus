import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { companiesApi, modulesApi } from '../../api';
import { X, Pencil, Copy, Check, Link2, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, Building2, Shield, Layers, Globe, ToggleLeft, ToggleRight, Hash, Briefcase, Activity, MoreHorizontal, Lock, Plug } from 'lucide-react';
import { Spinner, BADGE, ConfirmDialog } from '../../components/ui';
import { GenerateApiKeyButton } from './GenerateApiKeyButton';

const formatRif = (value: string) => {
  let val = value.toUpperCase().replace(/[^VEJG0-9]/g, '');
  if (val.length === 0) return '';
  if (!/^[VEJG]/.test(val)) {
    val = val.replace(/^[^VEJG]+/, '');
    if (val.length === 0) return '';
  }
  
  const firstChar = val.charAt(0);
  const rest = val.substring(1).replace(/[^0-9]/g, '');
  
  let formatted = firstChar;
  if (rest.length > 0) formatted += '-' + rest.substring(0, 8);
  if (rest.length > 8) formatted += '-' + rest.substring(8, 9);
  
  return formatted;
};

const formatNombre = (value: string) => {
  return value.replace(/[^a-zA-Z0-9\s\-\.,'&()áéíóúÁÉÍÓÚñÑüÜ]/g, '').substring(0, 50);
};

// Acorta la URL de acceso para mostrarla: deja la parte legible (host + ruta +
// query salvo el token) y separa el `nexus_token` para mostrarlo como chip.
const prettyAccessUrl = (raw: string): { base: string; hasToken: boolean } => {
  try {
    const u = new URL(raw);
    const hasToken = u.searchParams.has('nexus_token');
    u.searchParams.delete('nexus_token');
    const qs = u.searchParams.toString();
    const path = u.pathname === '/' ? '' : u.pathname;
    const base = `${u.host}${path}${qs ? '?' + decodeURIComponent(qs) : ''}`;
    return { base, hasToken };
  } catch {
    return { base: raw, hasToken: false };
  }
};

export default function EmpresaDashboard({ toast }: { toast: (m: string, t: 'success' | 'error') => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [allModules, setAllModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ nombre: '', rif: '', tipo: '' });
  const [confirmData, setConfirmData] = useState<{ title?: string; msg: string; type?: 'primary' | 'danger'; action: () => void } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<number | null>(null);
  const [showUrlPanel, setShowUrlPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'urls'>('overview');
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
  const [expandedUrlGroup, setExpandedUrlGroup] = useState<string | null>(null);

  const copyUrl = (url: string, subId: number) => {
    const doSet = () => { setCopiedUrl(subId); setTimeout(() => setCopiedUrl(null), 2000); };
    // Clipboard API requiere HTTPS — fallback para HTTP (LAN)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(doSet).catch(() => fallbackCopy(url, doSet));
    } else {
      fallbackCopy(url, doSet);
    }
  };

  const fallbackCopy = (url: string, onSuccess: () => void) => {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); onSuccess(); } catch { /* silencioso */ }
    document.body.removeChild(ta);
  };

  const load = (showSpinner = true) => {
    if (!id) return;
    if (showSpinner) setLoading(true);
    Promise.all([
      companiesApi.detalle(id).catch(() => null),
      modulesApi.listarTodos().catch(() => ({ data: [] }))
    ]).then(([c, m]) => {
      if (c && (c.data?.data || c.data)) {
        const comp = c.data?.data || c.data;
        setCompany(comp);
        setForm({ nombre: comp.nombre, rif: comp.rif || '', tipo: comp.tipo || '' });
      } else {
        toast('Empresa no encontrada', 'error');
        navigate('/empresas');
      }

      const mods = m.data?.data || m.data || [];
      // Mostrar solo módulos activos globalmente
      setAllModules(mods.filter((x: any) => x.activo));
    }).finally(() => {
      if (showSpinner) setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  const guardarDetalles = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    setConfirmData({
      title: 'Guardar cambios',
      msg: '¿Estás seguro que deseas actualizar los datos de esta empresa?',
      action: async () => {
        setSaving(true);
        try {
          await companiesApi.actualizar(id, form);
          toast('Empresa actualizada exitosamente', 'success');
          setEditMode(false);
          load();
        } catch (err: any) {
          toast(err.response?.data?.message || 'Error al guardar empresa', 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const toggleModule = async (moduleId: string | number, isActive: boolean, moduleObj: any) => {
    if (!company) return;

    // Validación: no se puede activar un módulo si no tiene submódulos (globalmente activos)
    const submodulosActivos = (moduleObj.submodulos || []).filter((s: any) => s.activo);
    if (!isActive && submodulosActivos.length === 0) {
        toast(`El módulo "${moduleObj.nombre}" no tiene submódulos disponibles y no puede activarse.`, 'error');
        return;
    }

    setConfirmData({
      title: isActive ? 'Desactivar módulo' : 'Activar módulo',
      msg: `¿Estás seguro que deseas ${isActive ? 'desactivar' : 'activar'} el módulo "${moduleObj.nombre}" para esta empresa?`,
      type: isActive ? 'danger' : 'primary',
      action: async () => {
        try {
          await companiesApi.toggleModule({
            empresaId: Number(company.id),
            moduloId: Number(moduleId),
            active: !isActive
          });
          load(); // Recarga los detalles para ver el nuevo estatus
          toast(isActive ? 'Módulo desactivado' : 'Módulo activado', 'success');
        } catch (err: any) {
          toast(err.response?.data?.message || 'Error al cambiar módulo', 'error');
        }
      }
    });
  };

  const toggleSubmodule = async (submoduleId: string | number, isActive: boolean, submoduleName: string, moduleId: number) => {
    if (!company) return;

    // Validar que el módulo principal siga teniendo submódulos globalmente activos si vamos a desactivar este
    if (isActive) {
        // Obtenemos los submódulos de la empresa para este módulo
        const empresaMod = company.modulos.find((m: any) => m.moduloId === moduleId);
        // Contamos cuántos de esos submódulos están activos actualmente en la empresa y además están globalmente activos
        const activeSubsCount = empresaMod?.modulo?.submodulos?.filter((s: any) => 
            s.activoEmpresa && s.activo !== false
        ).length || 0;

        if (activeSubsCount <= 1) {
            toast(`El módulo debe tener al menos un submódulo activo. Si desea desactivarlo por completo, desactive el módulo principal.`, 'error');
            return;
        }
    }

    setConfirmData({
      title: isActive ? 'Desactivar submódulo' : 'Activar submódulo',
      msg: `¿Estás seguro que deseas ${isActive ? 'desactivar' : 'activar'} el submódulo "${submoduleName}" para esta empresa?`,
      type: isActive ? 'danger' : 'primary',
      action: async () => {
        try {
          await companiesApi.toggleSubmodule({
            empresaId: Number(company.id),
            submoduloId: Number(submoduleId),
            active: !isActive
          });
          load(); // Recarga los detalles
          toast(isActive ? 'Submódulo desactivado' : 'Submódulo activado', 'success');
        } catch (err: any) {
          toast(err.response?.data?.message || 'Error al cambiar submódulo', 'error');
        }
      }
    });
  };


  const toggleStatus = () => {
    if (!company) return;
    setConfirmData({
      title: company.activo ? 'Desactivar empresa' : 'Activar empresa',
      msg: `¿Estás seguro que deseas ${company.activo ? 'desactivar' : 'activar'} la empresa "${company.nombre}"?`,
      type: company.activo ? 'danger' : 'primary',
      action: async () => {
        try {
          if (company.activo) {
            await companiesApi.actualizar(company.id.toString(), { activo: false });
            toast('Empresa desactivada', 'success');
          } else {
            await companiesApi.actualizar(company.id.toString(), { activo: true });
            toast('Empresa activada', 'success');
          }
          load();
        } catch (err: any) {
          toast(err.response?.data?.message || 'Error al cambiar estado', 'error');
        }
      }
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={32} /></div>;
  }

  if (!company) return null;

  // ── Métricas para el dashboard ────────────────────────────────────────────
  const modulosActivos   = (company.modulos || []).filter((m: any) => m.activo).length;
  const totalModulos     = allModules.length;
  const totalSubmodulos  = allModules.reduce((a: number, m: any) => a + (m.submodulos?.length || 0), 0);
  const subsActivosEmpresa = (company.modulos || []).reduce((a: number, m: any) =>
    a + (m.modulo?.submodulos?.filter((s: any) => s.activoEmpresa).length || 0), 0);

  return (
    <div className="page-enter space-y-0">

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO · Banda Oxford con identidad
      ═══════════════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-2xl overflow-hidden mb-5 relative"
        style={{
          background: 'linear-gradient(135deg, #0C133A 0%, #161e4a 50%, #0C133A 100%)',
          boxShadow: '0 10px 30px -10px rgba(12,19,58,0.4)',
        }}
      >
        {/* Patrón decorativo sutil */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle at 90% 20%, #ED7423 0%, transparent 35%), radial-gradient(circle at 10% 90%, #05C6DF 0%, transparent 35%)',
          }}
        />

        {/* Breadcrumb */}
        <div className="relative flex items-center gap-2 px-6 pt-4 pb-2 text-xs">
          <button
            onClick={() => navigate('/empresas')}
            className="flex items-center gap-1.5 font-semibold text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft size={12} /> Empresas
          </button>
          <ChevronRight size={10} className="text-white/30" />
          <span className="font-semibold truncate text-white/80">{company.nombre}</span>
        </div>

        {/* Header principal */}
        <div className="relative flex flex-col md:flex-row md:items-center gap-4 px-6 pb-5">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0 select-none"
              style={{
                background: 'linear-gradient(135deg, #ED7423, #C75D14)',
                boxShadow: '0 8px 24px -4px rgba(237,116,35,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              {company.nombre?.charAt(0)?.toUpperCase() || '?'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <h1
                  className="text-2xl font-black tracking-tight truncate text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {company.nombre}
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                  style={company.activo
                    ? { background: 'rgba(16,185,129,0.18)', color: '#34D399', border: '1px solid rgba(52,211,153,0.35)' }
                    : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: company.activo ? '#34D399' : 'rgba(255,255,255,0.4)',
                      boxShadow: company.activo ? '0 0 0 3px rgba(52,211,153,0.2)' : 'none',
                    }}
                  />
                  {company.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono text-white/55">{company.rif || '—'}</span>
                <span className="w-1 h-1 rounded-full bg-white/25" />
                <span className="text-white/55">{company.tipo || '—'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleStatus}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              style={company.activo
                ? { background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }
                : { background: '#10B981', color: '#FFFFFF', boxShadow: '0 4px 12px -2px rgba(16,185,129,0.4)' }
              }
            >
              {company.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {company.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          KPIs · Tarjetas con color de marca
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: <Layers size={16} />,    label: 'Módulos',    value: `${modulosActivos}/${totalModulos}`,         sub: 'asignados activos', color: '#ED7423', bgTint: '#FFF1E5', borderTint: '#FFD9BA' },
          { icon: <Shield size={16} />,    label: 'Submódulos', value: `${subsActivosEmpresa}/${totalSubmodulos}`,  sub: 'servicios activos', color: '#0891B2', bgTint: '#E0F7FA', borderTint: '#A5E6F0' },
          { icon: <Briefcase size={16} />, label: 'Cuenta',     value: company.tipo || '—',                         sub: 'tipo de empresa',   color: '#7C3AED', bgTint: '#F3EEFF', borderTint: '#D9C8FB' },
          { icon: <Activity size={16} />,  label: 'Estado',     value: company.activo ? 'Operativo' : 'Pausado',    sub: 'estado global',     color: company.activo ? '#059669' : '#64748B', bgTint: company.activo ? '#ECFDF5' : '#F1F5F9', borderTint: company.activo ? '#A7F3D0' : '#E2E8F0' },
        ].map(({ icon, label, value, sub, color, bgTint, borderTint }, i) => (
          <div
            key={i}
            className="rounded-xl px-5 py-4 transition-all hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${bgTint} 0%, #FFFFFF 100%)`,
              border: `1px solid ${borderTint}`,
              boxShadow: `0 1px 3px ${color}10`,
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{label}</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: '#FFFFFF', color, boxShadow: `0 2px 4px ${color}20`, border: `1px solid ${borderTint}` }}
              >
                {icon}
              </div>
            </div>
            <p
              className="text-2xl font-black leading-none mb-1"
              style={{ color: '#0C133A', fontFamily: 'var(--font-display)' }}
            >
              {value}
            </p>
            <p className="text-[11px] font-semibold" style={{ color: `${color}99` }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TABS · Pills con relleno Pumpkin al activarse
      ═══════════════════════════════════════════════════════════════════════ */}
      <div
        className="flex items-center gap-1 mb-5 p-1 rounded-xl"
        style={{ background: '#F1F3F8', border: '1px solid #EAECEF' }}
      >
        {[
          { id: 'overview', label: 'General',         icon: <Building2 size={13} /> },
          { id: 'modules',  label: 'Módulos',         icon: <Layers size={13} />, count: modulosActivos },
          { id: 'urls',     label: 'URLs de Acceso',  icon: <Globe size={13} />, count: subsActivosEmpresa },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              style={isActive
                ? {
                    background: '#FFFFFF',
                    color: '#0C133A',
                    boxShadow: '0 2px 8px rgba(12,19,58,0.08), 0 0 0 1px rgba(237,116,35,0.2)',
                  }
                : { color: '#64748B', background: 'transparent' }
              }
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#0C133A'; e.currentTarget.style.background = 'rgba(255,255,255,0.6)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'transparent'; } }}
            >
              <span style={{ color: isActive ? '#ED7423' : 'inherit' }}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-md text-[10px] font-black"
                  style={isActive
                    ? { background: '#ED7423', color: '#FFFFFF' }
                    : { background: '#E2E8F0', color: '#64748B' }
                  }
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENIDO POR TAB
      ═══════════════════════════════════════════════════════════════════════ */}

      {/* ━━━ TAB: GENERAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Ficha — ocupa 2 col en desktop */}
          <div className="lg:col-span-2">
            <div
              className="rounded-xl bg-white overflow-hidden"
              style={{
                border: '1px solid #EAECEF',
                boxShadow: '0 1px 3px rgba(12,19,58,0.04)',
              }}
            >
              <div
                className="flex items-center justify-between px-5 py-3.5 relative"
                style={{
                  background: 'linear-gradient(90deg, rgba(237,116,35,0.06) 0%, rgba(255,255,255,0) 100%)',
                  borderBottom: '1px solid #EAECEF',
                }}
              >
                {/* Acento lateral */}
                <div className="absolute top-0 bottom-0 left-0 w-1" style={{ background: '#ED7423' }} />
                <div className="flex items-center gap-2 pl-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: '#FFF1E5', color: '#ED7423' }}
                  >
                    <Building2 size={13} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: '#0C133A', fontFamily: 'var(--font-display)' }}>Información general</h3>
                </div>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: '#FFFFFF', border: '1px solid #FFD9BA', color: '#ED7423' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FFF1E5'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
                  >
                    <Pencil size={11} /> Editar
                  </button>
                )}
              </div>

              <div className="p-5">
                {editMode ? (
                  <form onSubmit={guardarDetalles} className="space-y-4">
                    <div><label className="label">Nombre *</label><input className="input w-full" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: formatNombre(e.target.value) }))} maxLength={50} required /></div>
                    <div><label className="label">RIF *</label><input className="input w-full" value={form.rif} onChange={e => setForm(p => ({ ...p, rif: formatRif(e.target.value) }))} placeholder="J-12345678-9" required /></div>
                    <div>
                      <label className="label">Tipo *</label>
                      <select className="input w-full" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} required>
                        <option value="SaaS Provider">SaaS Provider</option>
                        <option value="Enterprise">Enterprise</option>
                        <option value="SaaS">SaaS</option>
                        <option value="Retail">Retail</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                      <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => { setEditMode(false); setForm({ nombre: company.nombre, rif: company.rif || '', tipo: company.tipo || '' }); }}>Cancelar</button>
                      <button type="submit" className="btn-primary flex-1 text-xs" disabled={saving}>{saving ? <><Spinner /> Guardando…</> : 'Guardar'}</button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    {[
                      { label: 'Razón social', value: company.nombre,    icon: <Building2 size={12} /> },
                      { label: 'RIF',          value: company.rif || '—', icon: <Hash size={12} />,      mono: true },
                      { label: 'Tipo cuenta',  value: company.tipo || '—',icon: <Briefcase size={12} /> },
                      { label: 'Estado',       value: company.activo ? 'Operativa' : 'Inactiva', icon: <Activity size={12} /> },
                    ].map(({ label, value, icon, mono }) => (
                      <div key={label} className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: '#F8FAFC', color: '#64748B' }}
                        >
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                          <p className={`text-sm font-semibold break-words ${mono ? 'font-mono' : ''}`} style={{ color: '#0C133A' }}>
                            {value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3 items-center">
              <GenerateApiKeyButton 
                empresaId={Number(company.id)} 
                currentApiKey={company.apiKey} 
                toast={toast} 
                onRefresh={() => load(false)} 
              />
              <button
                onClick={() => navigate(`/empresas/${company.id}/conexiones`)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Plug size={15} />
                Conexiones de aplicaciones
              </button>
            </div>
          </div>

          {/* Resumen rápido lateral */}
          <div className="lg:col-span-1 space-y-3">
            {/* Resumen de módulos */}
            <div
              className="rounded-xl bg-white p-5 overflow-hidden relative"
              style={{ border: '1px solid #EAECEF', boxShadow: '0 1px 3px rgba(12,19,58,0.04)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: 'linear-gradient(90deg, #ED7423 0%, #05C6DF 100%)' }}
              />
              <div className="flex items-center justify-between mb-4 mt-1">
                <div className="flex items-center gap-2">
                  <Activity size={14} style={{ color: '#ED7423' }} />
                  <h3 className="text-sm font-bold" style={{ color: '#0C133A', fontFamily: 'var(--font-display)' }}>Resumen</h3>
                </div>
                <button
                  onClick={() => setActiveTab('modules')}
                  className="text-xs font-bold hover:underline"
                  style={{ color: '#ED7423' }}
                >
                  Ver todo →
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ED7423' }} />
                      <span className="text-xs font-semibold text-slate-600">Módulos activos</span>
                    </div>
                    <span className="text-xs font-black" style={{ color: '#ED7423' }}>{modulosActivos}/{totalModulos}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#FFF1E5' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${totalModulos ? (modulosActivos / totalModulos) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #ED7423, #F69558)',
                        boxShadow: '0 1px 3px rgba(237,116,35,0.3)',
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0891B2' }} />
                      <span className="text-xs font-semibold text-slate-600">Submódulos activos</span>
                    </div>
                    <span className="text-xs font-black" style={{ color: '#0891B2' }}>{subsActivosEmpresa}/{totalSubmodulos}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E0F7FA' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${totalSubmodulos ? (subsActivosEmpresa / totalSubmodulos) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #0891B2, #05C6DF)',
                        boxShadow: '0 1px 3px rgba(8,145,178,0.3)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Acción rápida URLs */}
            <button
              onClick={() => setActiveTab('urls')}
              className="w-full rounded-xl p-4 transition-all text-left flex items-center gap-3 group hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #0C133A 0%, #1a2255 100%)',
                boxShadow: '0 4px 12px -4px rgba(12,19,58,0.3)',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(5,198,223,0.15)',
                  color: '#05C6DF',
                  border: '1px solid rgba(5,198,223,0.3)',
                }}
              >
                <Globe size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">URLs de Acceso</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(5,198,223,0.8)' }}>{subsActivosEmpresa} servicios disponibles</p>
              </div>
              <ChevronRight
                size={16}
                className="group-hover:translate-x-0.5 transition-all"
                style={{ color: '#05C6DF' }}
              />
            </button>
          </div>
        </div>
      )}

      {/* ━━━ TAB: MÓDULOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'modules' && (
        <div
          className="rounded-xl bg-white overflow-hidden"
          style={{ border: '1px solid #EAECEF', boxShadow: '0 1px 3px rgba(12,19,58,0.04)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-3.5 relative"
            style={{
              background: 'linear-gradient(90deg, rgba(237,116,35,0.06) 0%, rgba(255,255,255,0) 100%)',
              borderBottom: '1px solid #EAECEF',
            }}
          >
            <div className="absolute top-0 bottom-0 left-0 w-1" style={{ background: '#ED7423' }} />
            <div className="flex items-center gap-2 pl-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: '#FFF1E5', color: '#ED7423' }}
              >
                <Layers size={13} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: '#0C133A', fontFamily: 'var(--font-display)' }}>Módulos y servicios</h3>
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider"
              style={{ background: '#ED7423', color: '#FFFFFF', boxShadow: '0 2px 4px rgba(237,116,35,0.3)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {modulosActivos} de {totalModulos} activos
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: '#EAECEF' }}>
            {allModules.map(mod => {
              const rel = (company.modulos || []).find((m: any) => m.moduloId === mod.id);
              const isActive = rel?.activo || false;
              const isExpanded = expandedModule === mod.id;
              const mapSubs = new Map();
              (mod.submodulos || []).forEach((s: any) => mapSubs.set(s.id, s));
              (rel?.modulo?.submodulos || []).forEach((s: any) => { if (!mapSubs.has(s.id)) mapSubs.set(s.id, s); });
              const submodulosTotales = Array.from(mapSubs.values());
              const submodulosActivosGlobalmente = submodulosTotales.filter((s: any) => s.activo !== false);
              const hasSubmodulos = submodulosActivosGlobalmente.length > 0;
              const activeSubCount = submodulosTotales.filter((s: any) => {
                const cs = rel?.modulo?.submodulos?.find((x: any) => x.id === s.id);
                return isActive && cs?.activoEmpresa;
              }).length;

              return (
                <div key={mod.id} style={{ borderColor: '#EAECEF' }}>
                  {/* Fila clickeable */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                  >
                    {/* Chevron de expansión */}
                    <ChevronRight
                      size={14}
                      className="text-slate-400 transition-transform shrink-0"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    />

                    {/* Ícono */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                      style={isActive
                        ? { background: '#FFF1E5', border: '1px solid #FFD9BA' }
                        : { background: '#F8FAFC', border: '1px solid #EAECEF', filter: 'grayscale(0.6)', opacity: 0.7 }
                      }
                    >
                      {mod.icon || '🧩'}
                    </div>

                    {/* Nombre + contador */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-bold truncate"
                        style={{ color: isActive ? '#0C133A' : '#94A3B8', fontFamily: 'var(--font-display)' }}
                      >
                        {mod.nombre}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>
                          <span className="font-bold" style={{ color: isActive ? '#ED7423' : '#94A3B8' }}>{activeSubCount}</span>
                          <span> de {submodulosActivosGlobalmente.length} submódulos</span>
                        </span>
                        {isActive && activeSubCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: '#ECFDF5', color: '#047857' }}>
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            En uso
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Toggle */}
                    <button
                      type="button" role="switch" aria-checked={isActive}
                      disabled={!hasSubmodulos}
                      onClick={(e) => { e.stopPropagation(); hasSubmodulos && toggleModule(mod.id, isActive, mod); }}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${!hasSubmodulos ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{ background: !hasSubmodulos ? '#E2E8F0' : isActive ? '#ED7423' : '#CBD5E1' }}
                      title={!hasSubmodulos ? 'Sin submódulos' : isActive ? 'Desactivar' : 'Activar'}
                    >
                      <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${isActive ? 'translate-x-[22px]' : 'translate-x-0.5'} mt-0.5`} />
                    </button>
                  </div>

                  {/* Panel expandido con submódulos */}
                  {isExpanded && submodulosTotales.length > 0 && (
                    <div className="px-5 pb-4 pt-1 bg-slate-50/40" style={{ paddingLeft: '70px' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Submódulos disponibles</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {submodulosTotales.map((sub: any) => {
                          const compSub = rel?.modulo?.submodulos?.find((s: any) => s.id === sub.id);
                          const isSubActive = isActive && (compSub?.activoEmpresa || false);
                          const isSubGlobalActive = sub.activo !== false;
                          return (
                            <div
                              key={sub.id}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white"
                              style={{ border: '1px solid #EAECEF', opacity: !isSubGlobalActive ? 0.5 : 1 }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{
                                  background: isSubActive ? '#ED7423' : '#CBD5E1',
                                  boxShadow: isSubActive ? '0 0 0 3px rgba(237,116,35,0.15)' : 'none',
                                }}
                              />
                              <span className="text-xs font-semibold truncate flex-1" style={{ color: isSubActive ? '#0C133A' : '#64748B' }}>
                                {sub.nombre}
                                {!isSubGlobalActive && <span className="text-[9px] text-red-400 ml-1 font-normal">(global off)</span>}
                              </span>
                              <button
                                type="button"
                                disabled={!isActive || !isSubGlobalActive}
                                onClick={() => isActive && isSubGlobalActive && toggleSubmodule(sub.id, isSubActive, sub.nombre, mod.id)}
                                className="relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors duration-200 focus:outline-none"
                                style={{
                                  background: (!isActive || !isSubGlobalActive) ? '#E2E8F0' : isSubActive ? '#ED7423' : '#CBD5E1',
                                  cursor: (!isActive || !isSubGlobalActive) ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <span aria-hidden="true" className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ${isSubActive ? 'translate-x-[14px]' : 'translate-x-0.5'} mt-0.5`} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {allModules.length === 0 && (
              <div className="py-16 text-center">
                <Layers size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="font-semibold text-sm text-slate-500">No hay módulos activos en el catálogo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━━ TAB: URLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'urls' && (() => {
        const groups: { moduloNombre: string; moduloIcon: string; subs: { id: number; nombre: string; accessUrl: string; activoEmpresa: boolean }[] }[] = [];
        (company.modulos || []).forEach((mod: any) => {
          if (!mod.modulo?.activo) return;
          const subs: any[] = [];
          (mod.modulo?.submodulos || []).forEach((sub: any) => {
            if (sub.url && sub.accessUrl) subs.push({ id: sub.id, nombre: sub.nombre, accessUrl: sub.accessUrl, activoEmpresa: sub.activoEmpresa || false });
          });
          if (subs.length > 0) groups.push({ moduloNombre: mod.modulo.nombre, moduloIcon: mod.modulo.icon || '🧩', subs });
        });
        const totalSubs    = groups.reduce((a, g) => a + g.subs.length, 0);
        const totalActivos = groups.reduce((a, g) => a + g.subs.filter(s => s.activoEmpresa).length, 0);

        return (
          <div
            className="rounded-xl bg-white overflow-hidden"
            style={{ border: '1px solid #EAECEF', boxShadow: '0 1px 3px rgba(12,19,58,0.04)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 relative"
              style={{
                background: 'linear-gradient(90deg, rgba(5,198,223,0.08) 0%, rgba(255,255,255,0) 100%)',
                borderBottom: '1px solid #EAECEF',
              }}
            >
              <div className="absolute top-0 bottom-0 left-0 w-1" style={{ background: '#05C6DF' }} />
              <div className="flex items-center gap-2 pl-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: '#E0F7FA', color: '#0891B2' }}
                >
                  <Globe size={13} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: '#0C133A', fontFamily: 'var(--font-display)' }}>URLs de Acceso</h3>
              </div>
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider"
                style={{ background: '#05C6DF', color: '#FFFFFF', boxShadow: '0 2px 4px rgba(5,198,223,0.3)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {totalActivos} de {totalSubs} activas
              </span>
            </div>

            {totalSubs === 0 ? (
              <div className="py-16 text-center">
                <div
                  className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: '#F1F5F9' }}
                >
                  <Globe size={20} className="text-slate-400" />
                </div>
                <p className="font-bold text-sm text-slate-600">Sin URLs configuradas</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  El submódulo debe tener <strong>URL pública</strong> en Módulos. Luego active el módulo
                  y el submódulo en la pestaña Módulos de esta empresa; la URL con{' '}
                  <code className="text-[10px]">nexus_token</code> aparecerá aquí.
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#EAECEF' }}>
                {groups.map((group, gi) => {
                  const isExpanded = expandedUrlGroup === group.moduloNombre;
                  const activeSubCount = group.subs.filter(s => s.activoEmpresa).length;
                  return (
                    <div key={gi} style={{ borderColor: '#EAECEF' }}>
                      <div
                        className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
                        onClick={() => setExpandedUrlGroup(isExpanded ? null : group.moduloNombre)}
                      >
                        <ChevronRight
                          size={14}
                          className="text-slate-400 transition-transform shrink-0"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        />
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                          style={{ background: '#E0F7FA', border: '1px solid #A5E6F0' }}
                        >
                          {group.moduloIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: '#0C133A', fontFamily: 'var(--font-display)' }}>
                            {group.moduloNombre}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span><span className="font-bold" style={{ color: '#0891B2' }}>{activeSubCount}</span> de {group.subs.length} URLs en uso</span>
                          </p>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="divide-y bg-slate-50/40 border-t" style={{ borderColor: '#EAECEF' }}>
                          {group.subs.map(sub => (
                            <div
                              key={sub.id}
                              className={`flex items-center gap-4 px-5 py-3 transition-colors ${!sub.activoEmpresa ? 'opacity-55' : ''}`}
                              style={{ paddingLeft: '70px' }}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  background: sub.activoEmpresa ? '#10B981' : '#CBD5E1',
                                  boxShadow: sub.activoEmpresa ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none',
                                }}
                              />

                              <div className="w-48 shrink-0">
                                <p className="text-sm font-bold truncate" style={{ color: '#0C133A' }}>{sub.nombre}</p>
                                <p className="text-[10px] uppercase tracking-wider font-bold mt-0.5" style={{ color: sub.activoEmpresa ? '#047857' : '#94A3B8' }}>
                                  {sub.activoEmpresa ? 'Activo' : 'Inactivo'}
                                </p>
                              </div>

                              <div className="flex-1 min-w-0">
                                {(() => {
                                  const { base, hasToken } = prettyAccessUrl(sub.accessUrl);
                                  return (
                                    <div
                                      className="flex items-center gap-2 px-3 py-2 rounded-md"
                                      style={{ background: '#FFFFFF', border: '1px solid #EAECEF' }}
                                      title={sub.accessUrl}
                                    >
                                      <span className="font-mono text-[11px] truncate" style={{ color: '#475569' }}>
                                        {base}
                                      </span>
                                      {hasToken && (
                                        <span
                                          className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                                          style={{ background: '#E2E8F0', color: '#64748B' }}
                                          title="La URL incluye un token de acceso cifrado (oculto). Usa Copiar para el enlace completo."
                                        >
                                          <Lock size={9} /> token
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => copyUrl(sub.accessUrl, sub.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-slate-100"
                                  style={{ color: '#64748B', border: '1px solid #EAECEF', background: '#FFFFFF' }}
                                >
                                  {copiedUrl === sub.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                  {copiedUrl === sub.id ? 'Copiado' : 'Copiar'}
                                </button>
                                <a
                                  href={sub.accessUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-slate-100"
                                  style={{ color: '#64748B', border: '1px solid #EAECEF', background: '#FFFFFF' }}
                                >
                                  <ExternalLink size={12} /> Abrir
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
