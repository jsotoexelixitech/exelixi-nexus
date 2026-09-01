import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { modulesApi, configApi, companiesApi, type ConfigPanelMeta } from '../../api';
import { Plus, RefreshCw, Power, Pencil, X as XIcon, Settings2, ExternalLink, Shield, FileText, LayoutList, CreditCard, Plug, ClipboardList } from 'lucide-react';
import { Spinner, ConfirmDialog, Modal } from '../../components/ui';
import ModuloIntegracionPanel from '../../components/ModuloIntegracionPanel';
import { PASOS_RAPIDOS } from '../../lib/moduloIntegracion';

const formatNombre = (value: string) => {
  return value.replace(/[^a-zA-Z\sáéíóúÁÉÍÓÚñÑüÜ]/g, '').substring(0, 50);
};

export default function Modulos({ toast }: { toast: (m: string, t: 'success' | 'error') => void }) {
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [confirmData, setConfirmData] = useState<{ title?: string; msg: string; type?: 'primary' | 'danger'; action: () => void } | null>(null);

  // Edit module state
  const [editId, setEditId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Parametrizar state
  const [loadingToken, setLoadingToken] = useState<number | null>(null);
  const [parametrizarMod, setParametrizarMod] = useState<any>(null);
  const [integracionSub, setIntegracionSub] = useState<{ moduloNombre: string; sub: any } | null>(null);
  /** Metadata de canal que viaja en la URL/token del configurador (como SSO). */
  const [configCanal, setConfigCanal] = useState('default');
  const [configCproductor, setConfigCproductor] = useState('');
  const [configCusuario, setConfigCusuario] = useState('');
  const [configCtipocanal, setConfigCtipocanal] = useState('');
  const [lastConfigUrl, setLastConfigUrl] = useState('');
  const [showUrlAvanzado, setShowUrlAvanzado] = useState(false);
  /** Empresa Nexus (como RCV): la config/preguntas se guardan por empresaId. */
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [configEmpresaId, setConfigEmpresaId] = useState(1);

  // Inline submodule edit state
  const [editSubId, setEditSubId] = useState<number | 'new' | null>(null);
  const [subForm, setSubForm] = useState({ nombre: '', url: '', moduloId: null as number | null });
  const [savingSub, setSavingSub] = useState(false);

  const load = () => { 
    setLoading(true); 
    modulesApi.listarTodos()
      .then((r) => {
        const data = r.data.data || r.data || [];
        setMods(data.sort((a: any, b: any) => {
          if (a.activo !== b.activo) return (b.activo === true ? 1 : 0) - (a.activo === true ? 1 : 0);
          return (a.nombre || '').localeCompare(b.nombre || '');
        }));
      })
      .catch(() => setMods([]))
      .finally(() => setLoading(false)); 
  };

  const loadEmpresas = () => {
    companiesApi.listar()
      .then((r) => {
        const data = r.data?.data || r.data || [];
        const list = Array.isArray(data) ? data : [];
        setEmpresas(list);
        if (list.length > 0 && !list.some((e: any) => Number(e.id) === configEmpresaId)) {
          setConfigEmpresaId(Number(list[0].id) || 1);
        }
      })
      .catch(() => setEmpresas([]));
  };
  
  useEffect(load, []);
  useEffect(loadEmpresas, []);

  const buildConfigMeta = (): ConfigPanelMeta => {
    const meta: ConfigPanelMeta = {
      canal: (configCanal || 'default').trim() || 'default',
    };
    if (configCproductor.trim()) meta.cproductor = configCproductor.trim();
    if (configCusuario.trim()) meta.cusuario = configCusuario.trim();
    if (configCtipocanal.trim()) meta.ctipocanal = configCtipocanal.trim();
    return meta;
  };

  const isEmisionSub = (submodulo: any): boolean => {
    const n = String(submodulo?.nombre || '').toLowerCase();
    return n.includes('emision') || n.includes('emisión');
  };

  const findEmisionSub = (mod: any): any | null =>
    (mod?.submodulos || []).find((s: any) => s.url && s.activo && isEmisionSub(s)) ?? null;

  const buildPanelUrl = async (
    submodulo: any,
    productoName: string,
    panel: 'config' | 'revision' = 'config',
  ): Promise<string | null> => {
    const nombreSub = String(submodulo.nombre || '').toLowerCase();
    let moduloKey = 'ocr';
    if (nombreSub.includes('formulario')) moduloKey = 'formulario';
    else if (nombreSub.includes('emision') || nombreSub.includes('emisión')) moduloKey = 'emision';
    else if (nombreSub.includes('pago')) moduloKey = 'pagos';
    else if (nombreSub.includes('ocr')) moduloKey = 'ocr';

    const rawProduct = String(productoName || '').toLowerCase();
    const product = rawProduct.includes('funerar') ? 'funerario' : 'rcv';
    if (panel === 'revision' && (product !== 'funerario' || moduloKey !== 'emision')) {
      return null;
    }
    const meta = buildConfigMeta();

    const empresaId = Number(configEmpresaId) > 0 ? Number(configEmpresaId) : 1;
    const empRow = empresas.find((e: any) => Number(e.id) === empresaId);
    const empresaNombreLocal =
      String(empRow?.nombre || empRow?.name || '').trim() || `Empresa ${empresaId}`;
    const response = await configApi.generarToken(
      empresaId,
      product,
      moduloKey,
      {
        ...meta,
        empresaNombre: empresaNombreLocal,
      },
      panel,
    );
    const token = response.data?.data?.token ?? response.data?.token;
    const nombreFromApi =
      response.data?.data?.empresaNombre ?? response.data?.empresaNombre;
    const nombreFinal =
      String(nombreFromApi || empresaNombreLocal || '').trim() || `Empresa ${empresaId}`;
    if (!token) return null;

    const PREFIX: Record<string, string> = {
      ocr: '/ocr',
      formulario: '/formulario',
      emision: '/emision',
      pagos: '/pagos',
    };
    const prefix = PREFIX[moduloKey] ?? '/ocr';
    const url = new URL(submodulo.url, window.location.origin);
    url.pathname = panel === 'revision' ? `${prefix}/revision` : `${prefix}/config`;
    url.search = '';
    url.searchParams.set('product', product);
    url.searchParams.set('token', token);
    url.searchParams.set('empresaId', String(empresaId));
    url.searchParams.set('empresaNombre', nombreFinal);
    url.searchParams.set('canal', meta.canal || 'default');
    if (meta.cproductor) url.searchParams.set('cproductor', meta.cproductor);
    if (meta.cusuario) url.searchParams.set('cusuario', meta.cusuario);
    if (meta.ctipocanal) url.searchParams.set('ctipocanal', meta.ctipocanal);
    return url.toString();
  };

  const abrirPanel = async (
    submodulo: any,
    productoName: string,
    mode: 'open' | 'copy' = 'open',
    panel: 'config' | 'revision' = 'config',
  ) => {
    if (!submodulo?.url) { toast('Este submódulo no tiene URL configurada', 'error'); return; }
    try {
      setLoadingToken(submodulo.id);
      const href = await buildPanelUrl(submodulo, productoName, panel);
      if (!href) {
        toast(
          panel === 'revision'
            ? 'La revisión técnica solo aplica a Emisión del módulo funerario'
            : 'No se pudo generar el token de acceso',
          'error',
        );
        return;
      }
      setLastConfigUrl(href);
      if (mode === 'copy') {
        await navigator.clipboard.writeText(href);
        toast(
          panel === 'revision'
            ? 'URL de revisión técnica copiada (válida 12 h; se renueva sola con la pestaña abierta)'
            : 'URL del configurador copiada (válida 1 h)',
          'success',
        );
      } else {
        window.open(href, '_blank');
      }
    } catch (err: any) {
      toast(err.response?.data?.message || 'Error al generar el token de acceso', 'error');
    } finally {
      setLoadingToken(null);
    }
  };

  const abrirParametrizador = (
    submodulo: any,
    productoName: string,
    mode: 'open' | 'copy' = 'open',
  ) => abrirPanel(submodulo, productoName, mode, 'config');

  const abrirRevisionTecnica = (
    submodulo: any,
    productoName: string,
    mode: 'open' | 'copy' = 'open',
  ) => abrirPanel(submodulo, productoName, mode, 'revision');

  const toggleStatus = async (mod: any) => {
    try {
      if (mod.activo) {
        await modulesApi.eliminar(mod.id.toString());
        toast('Módulo desactivado con éxito', 'success');
      } else {
        await modulesApi.actualizar(mod.id.toString(), { activo: true });
        toast('Módulo activado con éxito', 'success');
      }
      load();
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || 'Error al cambiar estado', 'error');
    }
  };

  const startEdit = (m: any) => {
    setEditId(m.id);
    setEditForm({ nombre: m.nombre || '' });
    setEditSubId(null);
  };

  const saveEdit = async (id: string | number) => {
    if (!editForm.nombre) {
      toast('Por favor complete el nombre', 'error');
      return;
    }
    setConfirmData({
      title: 'Guardar cambios',
      msg: '¿Estás seguro que deseas actualizar este módulo?',
      action: async () => {
        setSavingEdit(true);
        try {
          await modulesApi.actualizar(id.toString(), editForm);
          toast('Módulo actualizado con éxito', 'success');
          load();
        } catch (err: any) {
          toast(err.response?.data?.message || err.message || 'Error al actualizar módulo', 'error');
        } finally {
          setSavingEdit(false);
        }
      }
    });
  };

  const toggleSubStatus = (sub: any) => {
    setConfirmData({
      title: sub.activo ? 'Desactivar submódulo' : 'Activar submódulo',
      msg: `¿Estás seguro que deseas ${sub.activo ? 'desactivar' : 'activar'} el submódulo "${sub.nombre}"?`,
      type: sub.activo ? 'danger' : 'primary',
      action: async () => {
        try {
          await modulesApi.actualizarSubmodulo(sub.id.toString(), { activo: !sub.activo });
          toast(sub.activo ? 'Submódulo desactivado con éxito' : 'Submódulo activado con éxito', 'success');
          load();
        } catch (err: any) {
          toast(err.response?.data?.message || err.message || 'Error al cambiar estado', 'error');
        }
      }
    });
  };

  const guardarSubmodulo = async (e: React.FormEvent, subId: number | null) => {
    e.preventDefault();
    if (!subForm.moduloId) return;
    if (!subForm.url.trim()) {
      toast('La URL pública del submódulo es obligatoria (base del front / reporte).', 'error');
      return;
    }
    setConfirmData({
      title: subId ? 'Guardar cambios' : 'Crear submódulo',
      msg: subId ? '¿Estás seguro que deseas actualizar este submódulo?' : '¿Estás seguro que deseas registrar este nuevo submódulo?',
      action: async () => {
        setSavingSub(true);
        try {
          if (subId) {
            await modulesApi.actualizarSubmodulo(subId.toString(), { nombre: subForm.nombre, url: subForm.url.trim() });
            toast('Submódulo actualizado con éxito', 'success');
          } else {
            await modulesApi.crearSubmodulo({ nombre: subForm.nombre, url: subForm.url.trim(), moduloId: subForm.moduloId });
            toast('Submódulo creado con éxito', 'success');
          }
          setEditSubId(null);
          load();
        } catch (err: any) {
          toast(err.response?.data?.message || err.message || 'Error al guardar submódulo', 'error');
        } finally {
          setSavingSub(false);
        }
      }
    });
  };

  const filtered = mods.filter(o => {
    // Ocultar módulos inactivos sin búsqueda activa
    if (!o.activo && !search) return false;
    const s = search.toLowerCase();
    const estadoStr = o.activo ? 'activo' : 'inactivo';
    return (
      o.nombre?.toLowerCase().includes(s) || 
      estadoStr.includes(s)
    );
  });

  return (
    <div className="page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900">Catálogo de Módulos</h3>
          <p className="text-slate-500 mt-1 italic">Servicios y funcionalidades de la plataforma.</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => navigate('/modulos/nuevo')}><Plus size={16} /></button>
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

        <div className="mb-4 p-4 rounded-xl border border-sky-100 bg-sky-50/80 text-xs text-slate-700 space-y-1">
          <p className="font-bold text-sky-900">Conectar un módulo nuevo (rápido y seguro)</p>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
            {PASOS_RAPIDOS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="th pl-5">Módulo</th>
                  <th className="th text-center">Submódulos</th>
                  <th className="th text-center">Estado</th>
                  <th className="th text-center">Acciones</th>
                  <th className="th text-center">Parametrizador</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const productoMod = m.nombre?.toLowerCase().includes('funerar') ? 'funerario' : 'rcv';
                  const emisionSub = productoMod === 'funerario' ? findEmisionSub(m) : null;
                  return (
                  <React.Fragment key={m.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="td pl-5 font-semibold text-slate-900">{m.nombre}</td>
                      <td className="td text-center">
                        {(() => {
                          const c = m.submodulos?.length || 0;
                          return (
                            <div className={`text-sm font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-2 ${c === 0 ? 'bg-amber-50 text-amber-700' : 'bg-orange-50 text-orange-500'}`}>
                              {c === 0 ? 'Sin submódulos' : `${c} submódulo${c !== 1 ? 's' : ''}`}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="td text-center">
                        <span className={m.activo ? 'badge badge-green' : 'badge badge-red'}>
                          {m.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td className="td text-center">
                        <div className="flex gap-2 justify-center">
                          <button 
                            className={`p-2 rounded-lg transition-colors ${editId === m.id ? 'bg-orange-100 text-orange-500' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'}`} 
                            title="Editar" 
                            onClick={() => editId === m.id ? setEditId(null) : startEdit(m)}
                          >
                            <Pencil size={16} />
                          </button>
                          {m.activo ? (
                            <button 
                              className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors" 
                              title="Desactivar" 
                              onClick={() => { 
                                setConfirmData({
                                  title: 'Desactivar Módulo',
                                  msg: `¿Estás seguro que deseas desactivar el módulo "${m.nombre}" globalmente?`,
                                  type: 'danger',
                                  action: () => toggleStatus(m)
                                }); 
                              }}
                            >
                              <Power size={16} />
                            </button>
                          ) : (
                            <button 
                              className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors" 
                              title="Activar" 
                              onClick={() => { 
                                setConfirmData({
                                  title: 'Activar Módulo',
                                  msg: `¿Estás seguro que deseas activar el módulo "${m.nombre}" globalmente?`,
                                  action: () => toggleStatus(m)
                                }); 
                              }}
                            >
                              <Power size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="td text-center">
                        {!(m.submodulos || []).some((s: any) => s.url && s.activo) ? (
                          <span className="text-[10px] text-slate-400 italic px-2 py-1">Sin submódulos configurables</span>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <button
                              onClick={() => setParametrizarMod(m)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-500/30 transition-all hover:shadow-lg hover:-translate-y-0.5"
                            >
                              <Settings2 size={14} />
                              Parametrizar
                            </button>
                            {emisionSub && (
                              <button
                                type="button"
                                disabled={loadingToken === emisionSub.id}
                                onClick={() => abrirRevisionTecnica(emisionSub, 'funerario', 'copy')}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-50 text-fuchsia-700 text-[11px] font-bold rounded-xl border border-fuchsia-200 hover:bg-fuchsia-100 disabled:opacity-50"
                                title="Copia el enlace de revisión técnica (válido 12 h; se renueva con la pestaña abierta)"
                              >
                                {loadingToken === emisionSub.id ? <Spinner size={12} /> : <ClipboardList size={14} />}
                                Copiar revisión técnica
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {editId === m.id && (
                      <tr>
                        <td colSpan={5} className="bg-slate-50/50 border-b border-slate-100 p-0">
                          <div className="p-5 bg-white border border-slate-200 rounded-xl m-4 shadow-sm">
                            
                            {/* Editar Nombre del Módulo */}
                            <h4 className="font-bold text-slate-900 mb-4 text-sm">Configuración del Módulo</h4>
                            <div className="flex flex-col sm:flex-row items-end gap-3 mb-6 max-w-lg">
                              <div className="w-full">
                                <label className="label text-xs">Nombre *</label>
                                <input className="input" value={editForm.nombre} onChange={e => setEditForm(p => ({ ...p, nombre: formatNombre(e.target.value) }))} maxLength={50} required />
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <button type="button" className="btn-secondary text-xs px-4 py-2" onClick={() => setEditId(null)}>Cancelar</button>
                                <button type="button" className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5" disabled={savingEdit} onClick={() => saveEdit(m.id)}>
                                  {savingEdit ? <><Spinner size={14} /> Guardando…</> : 'Guardar'}
                                </button>
                              </div>
                            </div>
                            
                            <hr className="my-6 border-slate-100" />
                            
                            {/* Gestión de Submódulos */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">Submódulos Asociados</h4>
                                <p className="text-xs text-slate-500 mt-0.5 italic">Funcionalidades específicas que componen este módulo.</p>
                              </div>
                              {editSubId !== 'new' && (
                                <button 
                                  className="btn-primary text-xs px-3 py-1.5"
                                  title="Agregar submódulo"
                                  onClick={() => { setEditSubId('new'); setSubForm({ nombre: '', url: '', moduloId: m.id }); }}
                                >
                                  <Plus size={14} />
                                </button>
                              )}
                            </div>
                            
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                  <tr>
                                    <th className="th py-2 px-3">Nombre</th>
                                    <th className="th py-2 px-3 text-center w-24">Estado</th>
                                    <th className="th py-2 px-3 text-center w-28">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(m.submodulos || []).map((sub: any) => (
                                    <React.Fragment key={sub.id}>
                                      {editSubId === sub.id ? (
                                        <tr>
                                          <td colSpan={3} className="py-3 px-3 bg-slate-50/80 border-b border-slate-100">
                                            <form onSubmit={(e) => guardarSubmodulo(e, sub.id)} className="flex flex-col gap-2">
                                              <div className="flex items-center gap-2">
                                                <input 
                                                  className="input text-xs py-1.5 px-2.5 flex-1" 
                                                  value={subForm.nombre} 
                                                  onChange={e => setSubForm(p => ({ ...p, nombre: formatNombre(e.target.value) }))} 
                                                  placeholder="Nombre del submódulo..." 
                                                  maxLength={50} 
                                                  required 
                                                  autoFocus
                                                />
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <input 
                                                  className="input text-xs py-1.5 px-2.5 flex-1 font-mono" 
                                                  value={subForm.url} 
                                                  onChange={e => setSubForm(p => ({ ...p, url: e.target.value.trim() }))} 
                                                  placeholder="URL pública * (https://…/RPT_…)" 
                                                  type="url"
                                                />
                                              </div>
                                              <div className="flex gap-1.5 justify-end">
                                                <button type="button" className="btn-secondary text-[11px] px-2.5 py-1.5" onClick={() => setEditSubId(null)}>Cancelar</button>
                                                <button type="submit" className="btn-primary text-[11px] px-2.5 py-1.5" disabled={savingSub}>
                                                  {savingSub ? <Spinner size={12} /> : 'Guardar'}
                                                </button>
                                              </div>
                                            </form>
                                          </td>
                                        </tr>
                                      ) : (
                                        <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                          <td className="td py-2 px-3">
                                            <p className="font-medium text-slate-900">{sub.nombre}</p>
                                            {sub.url
                                              ? <p className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]" title={sub.url}>{sub.url}</p>
                                              : <p className="text-[10px] text-amber-500 italic">Sin URL — no generará acceso</p>
                                            }
                                          </td>
                                          <td className="td py-2 px-3 text-center">
                                            <span className={sub.activo ? 'badge badge-green text-[10px] px-1.5 py-0.5' : 'badge badge-red text-[10px] px-1.5 py-0.5'}>
                                              {sub.activo ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                          </td>
                                          <td className="td py-2 px-3 text-center">
                                            <div className="flex gap-1.5 justify-center">
                                              <button
                                                type="button"
                                                className="p-1.5 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-600 transition-colors"
                                                title="Datos de integración (SDK, .env, id submódulo)"
                                                onClick={() => setIntegracionSub({ moduloNombre: m.nombre, sub })}
                                              >
                                                <Plug size={14} />
                                              </button>
                                              <button 
                                                className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" 
                                                title="Editar" 
                                                onClick={() => { setEditSubId(sub.id); setSubForm({ nombre: sub.nombre, url: sub.url || '', moduloId: m.id }); }}
                                              >
                                                <Pencil size={14} />
                                              </button>
                                              {sub.activo ? (
                                                <button 
                                                  className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 transition-colors" 
                                                  title="Desactivar submódulo"
                                                  onClick={() => toggleSubStatus(sub)}
                                                ><Power size={14} /></button>
                                              ) : (
                                                <button 
                                                  className="p-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors" 
                                                  title="Activar submódulo"
                                                  onClick={() => toggleSubStatus(sub)}
                                                ><Power size={14} /></button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ))}
                                  
                                  {editSubId === 'new' && subForm.moduloId === m.id && (
                                    <tr>
                                      <td colSpan={3} className="py-3 px-3 bg-orange-50/50 border-t border-slate-100">
                                        <form onSubmit={(e) => guardarSubmodulo(e, null)} className="flex flex-col gap-2">
                                          <input 
                                            className="input text-xs py-1.5 px-2.5 w-full border-orange-200 focus:border-orange-500" 
                                            value={subForm.nombre} 
                                            onChange={e => setSubForm(p => ({ ...p, nombre: formatNombre(e.target.value) }))} 
                                            placeholder="Nombre del submódulo..." 
                                            maxLength={50} 
                                            required 
                                            autoFocus
                                          />
                                          <input 
                                            className="input text-xs py-1.5 px-2.5 w-full font-mono border-orange-200 focus:border-orange-500" 
                                            value={subForm.url} 
                                            onChange={e => setSubForm(p => ({ ...p, url: e.target.value.trim() }))} 
                                            placeholder="URL pública * (https://…/RPT_…)" 
                                            type="url"
                                          />
                                          <div className="flex gap-1.5 justify-end">
                                            <button type="button" className="btn-secondary text-[11px] px-2.5 py-1.5" onClick={() => setEditSubId(null)}>Cancelar</button>
                                            <button type="submit" className="btn-primary text-[11px] px-2.5 py-1.5" disabled={savingSub}>
                                              {savingSub ? <Spinner size={12} /> : 'Guardar'}
                                            </button>
                                          </div>
                                        </form>
                                      </td>
                                    </tr>
                                  )}

                                  {!(m.submodulos?.length) && editSubId !== 'new' && (
                                    <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-xs">No se han registrado submódulos para este módulo.</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="td text-center py-16 text-slate-400">
                    <div className="text-3xl mb-2">🧩</div>
                    <p className="font-medium">Sin módulos{search ? ' con ese filtro' : ' en el catálogo'}</p>
                  </td></tr>
                )}
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

      {/* MODAL DE PARAMETRIZADORES (GLASSMORPHISM CARDS) */}
      {parametrizarMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md transition-opacity">
          <div className="bg-white/90 backdrop-blur-2xl border border-white/50 rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="px-8 py-6 border-b border-slate-200/50 flex justify-between items-center bg-white/50">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                    <Settings2 size={24} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Parametrizadores</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium ml-11">
                  Módulo: <span className="text-slate-800 font-bold">{parametrizarMod.nombre}</span>
                </p>
              </div>
              <button 
                onClick={() => setParametrizarMod(null)} 
                className="p-2.5 bg-white rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-50 shadow-sm border border-slate-200 transition-all"
              >
                <XIcon size={20} />
              </button>
            </div>
            
            {/* Cuerpo del Modal (Grid de Tarjetas) */}
            <div className="p-8 overflow-y-auto bg-slate-50/30 space-y-6">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5 space-y-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-indigo-600">
                    ¿Quién configura? → Empresa
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    En el <strong>flujo</strong> (como RCV) no hay que adivinar nada: el SSO manda
                    <code className="font-mono text-[11px] mx-0.5">empresaId</code> en el JWT y, si aplica,
                    <code className="font-mono text-[11px] mx-0.5">metadata.canal</code> — la API carga esa config sola.
                    Aquí solo eliges la <strong>empresa</strong> para abrir/editar su parametrizador
                    (preguntas en canal <code className="font-mono text-[11px]">default</code> si el SSO no manda canal).
                  </p>
                </div>
                <div className="max-w-md">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Empresa *</label>
                  <select
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white"
                    value={configEmpresaId}
                    onChange={(e) => setConfigEmpresaId(Number(e.target.value) || 1)}
                  >
                    {empresas.length === 0 && <option value={1}>Empresa 1</option>}
                    {empresas.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.id} · {e.nombre || e.name || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUrlAvanzado((v) => !v)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                >
                  {showUrlAvanzado ? 'Ocultar' : 'Mostrar'} enlace avanzado (canal fijo para un integrador)
                </button>
                {showUrlAvanzado && (
                  <div className="rounded-xl border border-dashed border-indigo-200 bg-white/70 p-3 space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Solo si vas a <strong>regalar una URL</strong> a un integrador con canal ya conocido.
                      Si no, déjalo en <code className="font-mono">default</code>: en runtime el SSO decide el canal.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Canal</label>
                        <input
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white"
                          value={configCanal}
                          onChange={(e) => setConfigCanal(e.target.value)}
                          placeholder="default"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">cproductor</label>
                        <input
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white"
                          value={configCproductor}
                          onChange={(e) => setConfigCproductor(e.target.value)}
                          placeholder="opcional"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">cusuario</label>
                        <input
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white"
                          value={configCusuario}
                          onChange={(e) => setConfigCusuario(e.target.value)}
                          placeholder="opcional"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ctipocanal</label>
                        <input
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white"
                          value={configCtipocanal}
                          onChange={(e) => setConfigCtipocanal(e.target.value)}
                          placeholder="opcional"
                        />
                      </div>
                    </div>
                  </div>
                )}
                {lastConfigUrl && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Último enlace generado (revisión 12 h / configurador 1 h)
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <input
                      readOnly
                      className="flex-1 text-[11px] font-mono border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-600"
                      value={lastConfigUrl}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(lastConfigUrl);
                        toast('URL copiada', 'success');
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Copiar de nuevo
                    </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(parametrizarMod.submodulos || []).filter((s: any) => s.url && s.activo).map((sub: any) => {
                  const n = sub.nombre.toLowerCase();
                  let Icono = Settings2;
                  let gradient = 'from-slate-500 to-slate-700';
                  let shadow = 'shadow-slate-500/20';
                  let iconBg = 'bg-slate-100 text-slate-600';
                  
                  if (n.includes('ocr')) {
                    Icono = FileText;
                    gradient = 'from-blue-500 to-cyan-500';
                    shadow = 'shadow-cyan-500/20';
                    iconBg = 'bg-cyan-50 text-cyan-600';
                  } else if (n.includes('formulario')) {
                    Icono = LayoutList;
                    gradient = 'from-emerald-500 to-teal-500';
                    shadow = 'shadow-teal-500/20';
                    iconBg = 'bg-emerald-50 text-emerald-600';
                  } else if (n.includes('emision')) {
                    Icono = Shield;
                    gradient = 'from-violet-500 to-purple-600';
                    shadow = 'shadow-purple-500/20';
                    iconBg = 'bg-purple-50 text-purple-600';
                  } else if (n.includes('pago')) {
                    Icono = CreditCard;
                    gradient = 'from-amber-500 to-orange-500';
                    shadow = 'shadow-orange-500/20';
                    iconBg = 'bg-orange-50 text-orange-600';
                  }

                  const productoMod = parametrizarMod.nombre?.toLowerCase().includes('funerar') ? 'funerario' : 'rcv';

                  return (
                    <div 
                      key={sub.id}
                      className="group relative bg-white rounded-3xl p-6 border border-slate-200 hover:border-transparent transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                    >
                      {/* Borde Gradiente animado en hover */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10`}></div>
                      <div className="absolute inset-[2px] bg-white rounded-[22px] -z-10"></div>
                      
                      <div className="flex justify-between items-start mb-6">
                        <div className={`p-3.5 rounded-2xl ${iconBg} transition-colors group-hover:scale-110 duration-300`}>
                          <Icono size={24} strokeWidth={2.5} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${productoMod === 'funerario' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-sky-100 text-sky-700'}`}>
                          {productoMod}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-slate-900">{sub.nombre}</h3>
                      <p className="text-xs text-slate-500 mb-6 line-clamp-2">
                        Configura las reglas de negocio, validaciones y apariencia de este submódulo.
                      </p>
                      
                      <div className="flex flex-col gap-2">
                        <button
                          disabled={loadingToken === sub.id}
                          onClick={() => abrirParametrizador(sub, productoMod, 'open')}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm bg-gradient-to-r ${gradient} ${shadow} hover:shadow-lg transition-all disabled:opacity-50`}
                        >
                          {loadingToken === sub.id ? <Spinner size={16} /> : 'Configurar Módulo'}
                          <ExternalLink size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={loadingToken === sub.id}
                          onClick={() => abrirParametrizador(sub, productoMod, 'copy')}
                          className="w-full py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white disabled:opacity-50"
                        >
                          Copiar URL para el canal
                        </button>
                        {productoMod === 'funerario' && isEmisionSub(sub) && (
                          <>
                            <button
                              type="button"
                              disabled={loadingToken === sub.id}
                              onClick={() => abrirRevisionTecnica(sub, productoMod, 'open')}
                              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-fuchsia-600 to-violet-600 shadow-fuchsia-500/20 hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              {loadingToken === sub.id ? <Spinner size={16} /> : <ClipboardList size={16} />}
                              Revisión técnica
                              <ExternalLink size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={loadingToken === sub.id}
                              onClick={() => abrirRevisionTecnica(sub, productoMod, 'copy')}
                              className="w-full py-2 rounded-xl text-xs font-bold border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-white disabled:opacity-50"
                            >
                              Copiar URL de revisión (QA)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {integracionSub && (
        <Modal
          title={`Integración — ${integracionSub.sub.nombre}`}
          onClose={() => setIntegracionSub(null)}
          size="lg"
        >
          <ModuloIntegracionPanel
            moduloNombre={integracionSub.moduloNombre}
            submodulo={{
              id: integracionSub.sub.id,
              nombre: integracionSub.sub.nombre,
              url: integracionSub.sub.url ?? null,
            }}
          />
        </Modal>
      )}
    </div>
  );
}
