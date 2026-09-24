import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Building2, FileText, RefreshCw, ChevronDown,
  ChevronUp, ExternalLink, Calendar, Filter, AlertCircle,
  Package,
} from 'lucide-react';
import api from '../../api';

const C = {
  oxford:  '#0C133A',
  pumpkin: '#ED7423',
  sky:     '#05C6DF',
} as const;

const PRODUCT_COLORS: Record<string, string> = {
  rcv:        '#3B82F6',
  funerario:  '#8B5CF6',
  auto:       '#10B981',
  moto:       '#F59E0B',
  desconocido:'#6B7280',
};

const FREQ_LABEL: Record<string, string> = {
  A: 'Anual', S: 'Semestral', T: 'Trimestral', M: 'Mensual',
};

interface Poliza {
  id: number;
  polizaNumero: string;
  estado: string;
  createdAt: string;
  jsonData: Record<string, unknown>;
}

interface EmpresaTrafico {
  empresaId: number;
  empresaNombre: string;
  empresaRif: string;
  /** Porcentaje sobre prima USD de cada póliza (0–100). */
  feeTransaccion: number;
  total: number;
  sumaPrimas: number;
  ingresoEstimado: number;
  porProducto: Record<string, number>;
  polizas: Poliza[];
}

interface TraficoData {
  totalEmisiones: number;
  totalIngresoEstimado?: number;
  empresas: EmpresaTrafico[];
}

export default function Trafico({ toast }: { toast?: (msg: string, type: 'success' | 'error') => void }) {
  const [data, setData] = useState<TraficoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [expandedEmpresa, setExpandedEmpresa] = useState<number | null>(null);
  const [editingFeeId, setEditingFeeId] = useState<number | null>(null);
  const [feeValue, setFeeValue] = useState<string>('');

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const res = await api.get(`/emisiones/trafico?${params.toString()}`);
      setData(res.data?.data ?? null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Error al cargar tráfico';
      setError(msg);
      toast?.(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const toggleEmpresa = (id: number) =>
    setExpandedEmpresa(prev => (prev === id ? null : id));

  const handleSaveFee = async (empresaId: number) => {
    try {
      const val = parseFloat(feeValue);
      if (isNaN(val) || val < 0 || val > 100) {
        toast?.('El fee debe estar entre 0% y 100%', 'error');
        return;
      }
      await api.put(`/companies/${empresaId}`, { feeTransaccion: val });
      toast?.('Fee % actualizado correctamente', 'success');
      setEditingFeeId(null);
      cargar();
    } catch (err) {
      toast?.('Error al guardar el fee', 'error');
    }
  };

  const totalIngresos =
    data?.totalIngresoEstimado ??
    data?.empresas.reduce((acc, emp) => {
      const fee = emp.feeTransaccion || 0;
      if (typeof emp.ingresoEstimado === 'number') return acc + emp.ingresoEstimado;
      const primas =
        emp.sumaPrimas ??
        emp.polizas.reduce((s, p) => {
          const jd = p.jsonData || {};
          const m = Number(jd.monto ?? jd.mprimaext ?? 0);
          return s + (Number.isFinite(m) && m > 0 ? m : 0);
        }, 0);
      return acc + primas * (fee / 100);
    }, 0) ??
    0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: C.oxford, fontFamily: 'var(--font-display)' }}
          >
            Tráfico de Pólizas
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Histórico de emisiones por empresa
          </p>
        </div>
        <button
          id="btn-refrescar-trafico"
          onClick={cargar}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div
        className="p-4 rounded-2xl flex flex-wrap items-center gap-4"
        style={{ background: '#fff', border: '1px solid #EAECEF' }}
      >
        <Filter size={15} style={{ color: C.pumpkin }} />
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-400" />
          <label className="text-xs font-semibold text-slate-500">Desde</label>
          <input
            id="input-desde"
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="input text-sm py-1 px-2"
            style={{ minWidth: 140 }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-400" />
          <label className="text-xs font-semibold text-slate-500">Hasta</label>
          <input
            id="input-hasta"
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="input text-sm py-1 px-2"
            style={{ minWidth: 140 }}
          />
        </div>
        <button
          id="btn-filtrar-trafico"
          onClick={cargar}
          className="btn-secondary text-sm px-4 py-1.5"
        >
          Filtrar
        </button>
        {(desde || hasta) && (
          <button
            onClick={() => { setDesde(''); setHasta(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-4 rounded-xl flex items-center gap-3"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
        >
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Skeleton / Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-24 rounded-2xl animate-pulse"
              style={{ background: '#F1F5F9' }}
            />
          ))}
        </div>
      )}

      {/* Sin datos */}
      {!loading && !error && data?.totalEmisiones === 0 && (
        <div
          className="py-16 text-center rounded-2xl"
          style={{ background: '#fff', border: '1px solid #EAECEF' }}
        >
          <TrendingUp size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400 font-medium">
            No hay pólizas emitidas en este período
          </p>
        </div>
      )}

      {/* Total resumen */}
      {!loading && data && data.totalEmisiones > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total global */}
            <div
              className="p-5 rounded-2xl flex items-center gap-4"
              style={{
                background: `linear-gradient(135deg, ${C.oxford} 0%, #1a2460 100%)`,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                <TrendingUp size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                  Total Pólizas
                </p>
                <p
                  className="text-3xl font-bold text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {data.totalEmisiones}
                </p>
              </div>
            </div>

            {/* Total empresas */}
            <div
              className="p-5 rounded-2xl flex items-center gap-4"
              style={{ background: '#fff', border: '1px solid #EAECEF' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#FFF7F0' }}
              >
                <Building2 size={22} style={{ color: C.pumpkin }} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Empresas Activas
                </p>
                <p
                  className="text-3xl font-bold"
                  style={{ color: C.oxford, fontFamily: 'var(--font-display)' }}
                >
                  {data.empresas.length}
                </p>
              </div>
            </div>

            {/* Promedio por empresa */}
            <div
              className="p-5 rounded-2xl flex items-center gap-4"
              style={{ background: '#fff', border: '1px solid #EAECEF' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#F0FFFE' }}
              >
                <FileText size={22} style={{ color: C.sky }} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Promedio / Empresa
                </p>
                <p
                  className="text-3xl font-bold"
                  style={{ color: C.oxford, fontFamily: 'var(--font-display)' }}
                >
                  {Math.round(data.totalEmisiones / data.empresas.length)}
                </p>
              </div>
            </div>

            {/* Total Ingresos Estimados */}
            <div
              className="p-5 rounded-2xl flex items-center gap-4"
              style={{ background: '#fff', border: '1px solid #EAECEF' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#F0FDF4' }}
              >
                <span className="text-emerald-500 font-bold text-xl">$</span>
              </div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Ingreso Estimado (% prima)
                </p>
                <p
                  className="text-3xl font-bold text-emerald-600"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  ${totalIngresos.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de empresas */}
          <div className="space-y-3">
            {data.empresas.map(empresa => {
              const isOpen = expandedEmpresa === empresa.empresaId;
              const topProducto = Object.entries(empresa.porProducto).sort(
                ([, a], [, b]) => b - a,
              )[0];

              return (
                <div
                  key={empresa.empresaId}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: '#fff', border: '1px solid #EAECEF' }}
                >
                  {/* Cabecera de empresa */}
                  <button
                    id={`empresa-${empresa.empresaId}-toggle`}
                    onClick={() => toggleEmpresa(empresa.empresaId)}
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${C.pumpkin}, ${C.oxford})`,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {empresa.empresaNombre.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-bold text-sm truncate"
                        style={{ color: C.oxford, fontFamily: 'var(--font-display)' }}
                      >
                        {empresa.empresaNombre}
                      </p>
                      <p className="text-xs text-slate-400">
                        RIF: {empresa.empresaRif || '—'}
                      </p>
                    </div>

                    {/* Chips de productos */}
                    <div className="hidden sm:flex flex-wrap gap-1.5 max-w-[180px]">
                      {Object.entries(empresa.porProducto).map(([prod, cnt]) => (
                        <span
                          key={prod}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{
                            background: PRODUCT_COLORS[prod] ?? PRODUCT_COLORS.desconocido,
                          }}
                        >
                          <Package size={9} />
                          {prod.toUpperCase()} {cnt}
                        </span>
                      ))}
                    </div>

                    {/* Fee % sobre prima */}
                    <div className="flex flex-col items-end shrink-0" onClick={e => e.stopPropagation()}>
                      {editingFeeId === empresa.empresaId ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="input py-1 px-2 w-16 text-sm text-center"
                            value={feeValue}
                            onChange={(e) => setFeeValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveFee(empresa.empresaId)}
                            autoFocus
                          />
                          <span className="text-slate-400 text-sm">%</span>
                          <button 
                            className="btn-primary py-1 px-2 text-xs"
                            onClick={() => handleSaveFee(empresa.empresaId)}
                          >
                            Guardar
                          </button>
                          <button 
                            className="text-slate-400 hover:text-slate-600 px-1"
                            onClick={() => setEditingFeeId(null)}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="flex flex-col items-end cursor-pointer group"
                          onClick={() => {
                            setEditingFeeId(empresa.empresaId);
                            setFeeValue(String(empresa.feeTransaccion || 0));
                          }}
                          title="Fee % sobre la prima USD de cada póliza"
                        >
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide group-hover:text-sky-500 flex items-center gap-1">
                            Fee % <span className="hidden group-hover:inline">✏️</span>
                          </p>
                          <p className="font-bold text-sm" style={{ color: C.oxford }}>
                            {Number(empresa.feeTransaccion || 0).toFixed(2)}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Total Polizas */}
                    <div className="text-right shrink-0 ml-2">
                      <p
                        className="text-2xl font-bold"
                        style={{ color: C.pumpkin, fontFamily: 'var(--font-display)' }}
                      >
                        {empresa.total}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">pólizas</p>
                    </div>

                    {/* Ingreso Total Empresa = sumaPrimas × fee% */}
                    <div className="text-right shrink-0 ml-4 hidden sm:block">
                      <p
                        className="text-xl font-bold text-emerald-600"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        ${(
                          typeof empresa.ingresoEstimado === 'number'
                            ? empresa.ingresoEstimado
                            : (empresa.sumaPrimas || 0) * ((empresa.feeTransaccion || 0) / 100)
                        ).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-emerald-600/70 uppercase tracking-wide">
                        a facturar
                      </p>
                      {(empresa.sumaPrimas ?? 0) > 0 && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          sobre ${(empresa.sumaPrimas || 0).toFixed(2)} prima
                        </p>
                      )}
                    </div>

                    {/* Toggle icon */}
                    <div className="ml-2 text-slate-400">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {/* Tabla de pólizas expandida */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #EAECEF' }}>
                      {empresa.polizas.length === 0 ? (
                        <p className="p-6 text-center text-slate-400 text-sm">
                          No hay pólizas registradas.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ background: '#F7F8FA' }}>
                                <th className="text-left py-2 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                  Póliza
                                </th>
                                <th className="text-left py-2 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                  Tomador
                                </th>
                                <th className="text-left py-2 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                  Producto
                                </th>
                                <th className="text-left py-2 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                  Plan
                                </th>
                                <th className="text-left py-2 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                  Frecuencia
                                </th>
                                <th className="text-right py-2 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                  Prima USD
                                </th>
                                <th className="text-right py-2 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                  Fee
                                </th>
                                <th className="text-left py-2 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                  Fecha
                                </th>
                                <th className="py-2 px-4" />
                              </tr>
                            </thead>
                            <tbody>
                              {empresa.polizas.map((pol, idx) => {
                                const jd = pol.jsonData || {};
                                const prod = (jd.producto as string) || 'rcv';
                                const freq = (jd.frecuencia as string) || '';
                                const prima = Number(jd.monto ?? jd.mprimaext ?? 0);
                                const primaOk = Number.isFinite(prima) && prima > 0 ? prima : 0;
                                const feePol =
                                  Math.round(primaOk * ((empresa.feeTransaccion || 0) / 100) * 100) / 100;
                                return (
                                  <tr
                                    key={pol.id}
                                    style={{
                                      background: idx % 2 === 0 ? '#fff' : '#FAFBFC',
                                      borderBottom: '1px solid #EAECEF',
                                    }}
                                  >
                                    <td className="py-3 px-4 font-mono text-xs font-bold" style={{ color: C.oxford }}>
                                      {pol.polizaNumero}
                                    </td>
                                    <td className="py-3 px-4 text-slate-600 text-xs">
                                      <p>{(jd.tomadorNombre as string) || '—'}</p>
                                      <p className="text-slate-400">{(jd.tomadorIdentificacion as string) || ''}</p>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span
                                        className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                        style={{
                                          background: PRODUCT_COLORS[prod] ?? PRODUCT_COLORS.desconocido,
                                        }}
                                      >
                                        {prod.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-xs text-slate-600">
                                      {(jd.planNombre as string) || '—'}
                                    </td>
                                    <td className="py-3 px-4 text-xs text-slate-500">
                                      {FREQ_LABEL[freq] || freq || '—'}
                                    </td>
                                    <td className="py-3 px-4 text-xs text-right text-slate-600 font-mono">
                                      {primaOk > 0 ? `$${primaOk.toFixed(2)}` : '—'}
                                    </td>
                                    <td className="py-3 px-4 text-xs text-right font-mono text-emerald-600">
                                      {primaOk > 0 ? `$${feePol.toFixed(2)}` : '—'}
                                    </td>
                                    <td className="py-3 px-4 text-xs text-slate-400">
                                      {new Date(pol.createdAt).toLocaleDateString('es-VE', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                      })}
                                    </td>
                                    <td className="py-3 px-4">
                                      {(jd.urlpoliza as string) && (
                                        <a
                                          href={jd.urlpoliza as string}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sky-500 hover:text-sky-600 flex items-center gap-1 text-xs"
                                        >
                                          PDF <ExternalLink size={11} />
                                        </a>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
