import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ImagePlus, Palette, RotateCcw, Trash2, Eye, Info } from 'lucide-react';
import { marcaApi, type MarcaEmpresaData } from '../../api';
import { moduleApiBase } from '../../lib/app-base';
import { ConfirmDialog, Spinner } from '../../components/ui';

/**
 * Marca de la empresa (logo y 3 colores) que toman los portales de los módulos (Condominio, Hogar…).
 * Los portales la reciben en /api/access/verify; si la empresa no la configura, cada portal usa la suya.
 */

const LOGO_MAXIMO = 1024 * 1024;
const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp'];
const CONTRASTE_MINIMO = 3;
const CONTRASTE_RECOMENDADO = 4.5;

/** Colores de referencia cuando la empresa no define uno (los de La Mundial en Nexus). */
const POR_DEFECTO = { colorPrincipal: '#0F1A5A', colorSecundario: '#2E6DBF', colorTerciario: '#E84F51' } as const;

type ClaveColor = keyof typeof POR_DEFECTO;
type Colores = Record<ClaveColor, string | null>;

const CAMPOS: { clave: ClaveColor; titulo: string; uso: string }[] = [
  { clave: 'colorPrincipal', titulo: 'Color principal', uso: 'Cabecera, títulos, pasos y botón principal.' },
  { clave: 'colorSecundario', titulo: 'Color secundario', uso: 'Enlaces, iconos y elementos de apoyo.' },
  { clave: 'colorTerciario', titulo: 'Color de acento', uso: 'Avisos destacados, etiquetas y llamados a la acción.' },
];

const OX = '#0C133A';
const PUMPKIN = '#ED7423';

function normalizarHex(valor: string): string | null {
  const crudo = valor.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(crudo)) return `#${crudo.split('').map((c) => c + c).join('').toUpperCase()}`;
  return /^[0-9a-f]{6}$/i.test(crudo) ? `#${crudo.toUpperCase()}` : null;
}

function contrasteConBlanco(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (l + 0.05);
}

function urlAbsoluta(ruta: string | null): string | null {
  if (!ruta) return null;
  return `${moduleApiBase().replace(/\/api$/, '')}${ruta}`;
}

function leerComoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

function mensajeDe(err: unknown, porDefecto: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || porDefecto;
}

function coloresDe(d: MarcaEmpresaData | null): Colores {
  return {
    colorPrincipal: d?.colorPrincipal ?? null,
    colorSecundario: d?.colorSecundario ?? null,
    colorTerciario: d?.colorTerciario ?? null,
  };
}

/* ───────────────────────── Piezas de UI ───────────────────────── */

function Tarjeta({ titulo, icono, children, extra }: { titulo: string; icono: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #EAECEF', boxShadow: '0 1px 3px rgba(12,19,58,0.04)' }}>
      <header
        className="flex items-center justify-between gap-3 px-5 py-3.5 relative"
        style={{ background: 'linear-gradient(90deg, rgba(237,116,35,0.06) 0%, rgba(255,255,255,0) 100%)', borderBottom: '1px solid #EAECEF' }}
      >
        <div className="absolute top-0 bottom-0 left-0 w-1" style={{ background: PUMPKIN }} />
        <div className="flex items-center gap-2 pl-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FFF1E5', color: PUMPKIN }}>
            {icono}
          </div>
          <h3 className="text-sm font-bold truncate" style={{ color: OX, fontFamily: 'var(--font-display)' }}>{titulo}</h3>
        </div>
        {extra}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Legibilidad({ hex }: { hex: string }) {
  const c = contrasteConBlanco(hex);
  const [texto, estilo] =
    c < CONTRASTE_MINIMO
      ? ['Muy claro: el texto blanco no se lee', { background: '#FEF2F2', color: '#B91C1C' }]
      : c < CONTRASTE_RECOMENDADO
        ? ['Contraste justo', { background: '#FFFBEB', color: '#B45309' }]
        : ['Se lee bien', { background: '#ECFDF5', color: '#047857' }];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap" style={estilo}>
      {c < CONTRASTE_MINIMO ? <AlertTriangle size={11} /> : <Check size={11} />}
      {texto} · {c.toFixed(1)}:1
    </span>
  );
}

function CampoColor({
  titulo,
  uso,
  valor,
  porDefecto,
  borrador,
  onBorrador,
  onCambio,
  deshabilitado,
}: {
  titulo: string;
  uso: string;
  valor: string | null;
  porDefecto: string;
  borrador: string;
  onBorrador: (texto: string) => void;
  onCambio: (hex: string | null) => void;
  deshabilitado: boolean;
}) {
  const efectivo = valor ?? porDefecto;
  const textoInvalido = borrador.trim() !== '' && !normalizarHex(borrador);
  return (
    <div className="flex items-start sm:items-center gap-3 sm:gap-4 py-4 first:pt-0 last:pb-0 border-b border-slate-100 last:border-b-0">
      <label
        className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 ${deshabilitado ? 'opacity-60' : 'cursor-pointer'}`}
        style={{ border: valor ? '1px solid #E2E8F0' : '2px dashed #CBD5E1', background: efectivo }}
        title={`Elegir ${titulo.toLowerCase()}`}
      >
        <input
          type="color"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          value={efectivo.toLowerCase()}
          disabled={deshabilitado}
          onChange={(e) => onCambio(e.target.value.toUpperCase())}
          aria-label={titulo}
        />
      </label>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: OX }}>{titulo}</p>
        <p className="text-xs text-slate-500 mt-0.5">{uso}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input
            className="input-sm w-28 font-mono uppercase"
            value={borrador}
            placeholder={porDefecto}
            maxLength={7}
            disabled={deshabilitado}
            onChange={(e) => {
              onBorrador(e.target.value);
              const hex = normalizarHex(e.target.value);
              if (hex) onCambio(hex);
              else if (e.target.value.trim() === '') onCambio(null);
            }}
            aria-invalid={textoInvalido}
            aria-label={`${titulo} en hexadecimal`}
          />
          {textoInvalido ? (
            <span className="text-[11px] font-bold text-red-600">Usa el formato #RRGGBB</span>
          ) : valor ? (
            <Legibilidad hex={valor} />
          ) : (
            <span className="text-[11px] font-semibold text-slate-400">Usa el de cada aplicación</span>
          )}
          {valor && !deshabilitado && (
            <button type="button" className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline underline-offset-2" onClick={() => onCambio(null)}>
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function VistaPrevia({ colores, logo, nombre }: { colores: Colores; logo: string | null; nombre: string }) {
  const p = colores.colorPrincipal ?? POR_DEFECTO.colorPrincipal;
  const s = colores.colorSecundario ?? POR_DEFECTO.colorSecundario;
  const t = colores.colorTerciario ?? POR_DEFECTO.colorTerciario;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', background: '#F4F6FB' }} aria-label="Vista previa del portal">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white" style={{ borderBottom: '1px solid #E2E8F0' }}>
        {logo ? (
          <img src={logo} alt={nombre} className="h-7 w-auto max-w-[140px] object-contain" />
        ) : (
          <span className="text-[11px] font-bold text-slate-400">Logo de la aplicación</span>
        )}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${p}14`, color: p }}>Portal</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-black"
              style={n === 1 ? { background: p, color: '#fff' } : n === 2 ? { border: `2px solid ${p}`, color: p, background: '#fff' } : { background: '#E2E8F0', color: '#64748B' }}
            >
              {n === 1 ? <Check size={11} /> : n}
            </span>
          ))}
        </div>
        <div className="rounded-lg bg-white p-3" style={{ border: '1px solid #E2E8F0' }}>
          <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: s }}>Emisión · Condominio</p>
          <p className="text-sm font-extrabold mt-0.5" style={{ color: p, fontFamily: 'var(--font-display)' }}>Plan y coberturas</p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[11px] font-semibold underline underline-offset-2" style={{ color: s }}>Ver condiciones</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white" style={{ background: t }}>Recomendado</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white" style={{ border: '1px solid #E2E8F0', color: p }}>Atrás</span>
          <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white" style={{ background: p }}>Continuar</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Pantalla ───────────────────────── */

export default function MarcaEmpresa({
  empresaId,
  empresaNombre,
  toast,
}: {
  empresaId: number;
  empresaNombre: string;
  toast: (m: string, t: 'success' | 'error') => void;
}) {
  const [datos, setDatos] = useState<MarcaEmpresaData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [colores, setColores] = useState<Colores>(coloresDe(null));
  const [borradores, setBorradores] = useState<Record<ClaveColor, string>>({ colorPrincipal: '', colorSecundario: '', colorTerciario: '' });
  const [guardando, setGuardando] = useState<'colores' | 'logo' | 'quitar' | 'restablecer' | null>(null);
  const [confirmar, setConfirmar] = useState<null | 'quitar' | 'restablecer'>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const aplicar = (d: MarcaEmpresaData) => {
    setDatos(d);
    const c = coloresDe(d);
    setColores(c);
    setBorradores({ colorPrincipal: c.colorPrincipal ?? '', colorSecundario: c.colorSecundario ?? '', colorTerciario: c.colorTerciario ?? '' });
  };

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await marcaApi.obtener(empresaId);
      aplicar(r.data.data);
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo cargar la marca de la empresa.'));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const guardados = coloresDe(datos);
  const cambiado = (Object.keys(POR_DEFECTO) as ClaveColor[]).some((k) => colores[k] !== guardados[k]);
  const borradorInvalido = (Object.keys(POR_DEFECTO) as ClaveColor[]).some((k) => borradores[k].trim() !== '' && !normalizarHex(borradores[k]));
  const ilegible = (Object.keys(POR_DEFECTO) as ClaveColor[]).find((k) => colores[k] && contrasteConBlanco(colores[k]!) < CONTRASTE_MINIMO);
  const logoUrl = useMemo(() => urlAbsoluta(datos?.logoUrl ?? null), [datos?.logoUrl]);
  const personalizada = !!(datos?.logoUrl || datos?.colorPrincipal || datos?.colorSecundario || datos?.colorTerciario);
  const ocupado = guardando !== null;

  const cambiarColor = (clave: ClaveColor, hex: string | null) => {
    setColores((c) => ({ ...c, [clave]: hex }));
    if (hex === null) setBorradores((b) => ({ ...b, [clave]: '' }));
    else if (normalizarHex(borradores[clave]) !== hex) setBorradores((b) => ({ ...b, [clave]: hex }));
  };

  const guardarColores = async () => {
    setGuardando('colores');
    try {
      const r = await marcaApi.guardarColores(empresaId, colores);
      aplicar(r.data.data);
      toast('Colores guardados. Los portales los toman en la próxima carga.', 'success');
    } catch (err) {
      toast(mensajeDe(err, 'No se pudieron guardar los colores.'), 'error');
    } finally {
      setGuardando(null);
    }
  };

  const subirLogo = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (!TIPOS_LOGO.includes(archivo.type)) return toast('El logo debe ser PNG, JPG o WEBP.', 'error');
    if (archivo.size > LOGO_MAXIMO) return toast('El logo supera 1 MB.', 'error');
    setGuardando('logo');
    try {
      const r = await marcaApi.guardarLogo(empresaId, await leerComoDataUrl(archivo));
      aplicar(r.data.data);
      toast('Logo guardado.', 'success');
    } catch (err) {
      toast(mensajeDe(err, 'No se pudo guardar el logo.'), 'error');
    } finally {
      setGuardando(null);
    }
  };

  const quitarLogo = async () => {
    setGuardando('quitar');
    try {
      const r = await marcaApi.quitarLogo(empresaId);
      aplicar(r.data.data);
      toast('Logo quitado: los portales vuelven a mostrar el suyo.', 'success');
    } catch (err) {
      toast(mensajeDe(err, 'No se pudo quitar el logo.'), 'error');
    } finally {
      setGuardando(null);
    }
  };

  const restablecer = async () => {
    setGuardando('restablecer');
    try {
      const r = await marcaApi.restablecer(empresaId);
      aplicar(r.data.data);
      toast('Marca restablecida: los portales usan su marca por defecto.', 'success');
    } catch (err) {
      toast(mensajeDe(err, 'No se pudo restablecer la marca.'), 'error');
    } finally {
      setGuardando(null);
    }
  };

  if (cargando) {
    return (
      <div className="rounded-xl bg-white p-10 flex items-center justify-center gap-3 text-sm text-slate-500" style={{ border: '1px solid #EAECEF' }}>
        <Spinner size={18} /> Cargando la marca…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-white p-6 flex flex-col sm:flex-row sm:items-center gap-4" style={{ border: '1px solid #FECACA' }}>
        <AlertTriangle className="text-red-500 shrink-0" size={20} />
        <p className="flex-1 text-sm text-slate-700">{error}</p>
        <button type="button" className="btn-secondary text-xs" onClick={cargar}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 space-y-5 min-w-0">
        <Tarjeta titulo="Logo" icono={<ImagePlus size={13} />}>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-center">
            <div
              className="h-36 rounded-xl grid place-items-center p-4"
              style={{ background: 'repeating-conic-gradient(#F1F3F8 0% 25%, #FFFFFF 0% 50%) 0 0 / 16px 16px', border: '1px dashed #CBD5E1' }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={`Logo de ${empresaNombre}`} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs font-semibold text-slate-400 text-center">Sin logo propio</span>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {logoUrl ? 'Este logo aparece en la cabecera de los portales de la empresa.' : 'Los portales muestran su logo por defecto.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-xs" disabled={ocupado} onClick={() => archivoRef.current?.click()}>
                  {guardando === 'logo' ? <><Spinner size={13} /> Subiendo…</> : <><ImagePlus size={14} /> {logoUrl ? 'Cambiar logo' : 'Cargar logo'}</>}
                </button>
                {logoUrl && (
                  <button type="button" className="btn-secondary text-xs" disabled={ocupado} onClick={() => setConfirmar('quitar')}>
                    {guardando === 'quitar' ? <Spinner size={13} /> : <Trash2 size={14} />} Quitar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">PNG, JPG o WEBP de hasta 1 MB. Mejor horizontal (unos 4:1) y con fondo transparente.</p>
              <input
                ref={archivoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  subirLogo(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Colores" icono={<Palette size={13} />}>
          <p className="text-xs text-slate-500 mb-4">
            Cada portal calcula sus tonos claros, oscuros y degradados a partir de estos tres. Un color vacío usa el de cada aplicación.
          </p>
          <div>
            {CAMPOS.map((c) => (
              <CampoColor
                key={c.clave}
                titulo={c.titulo}
                uso={c.uso}
                valor={colores[c.clave]}
                porDefecto={POR_DEFECTO[c.clave]}
                borrador={borradores[c.clave]}
                onBorrador={(texto) => setBorradores((b) => ({ ...b, [c.clave]: texto }))}
                onCambio={(hex) => cambiarColor(c.clave, hex)}
                deshabilitado={ocupado}
              />
            ))}
          </div>
          {ilegible && (
            <p className="mt-4 flex items-start gap-2 text-xs font-semibold text-red-700 bg-red-50 rounded-lg px-3 py-2.5">
              <AlertTriangle size={14} className="shrink-0 mt-px" />
              Un color es tan claro que el texto blanco de los botones no se leería. Elige un tono más oscuro para poder guardar.
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!cambiado || ocupado}
              onClick={() => aplicar(datos ?? ({ empresaId } as MarcaEmpresaData))}
            >
              Descartar cambios
            </button>
            <button type="button" className="btn-primary text-xs" disabled={!cambiado || ocupado || borradorInvalido || !!ilegible} onClick={guardarColores}>
              {guardando === 'colores' ? <><Spinner size={13} /> Guardando…</> : <><Check size={14} /> Guardar colores</>}
            </button>
          </div>
        </Tarjeta>
      </div>

      <div className="space-y-5 lg:sticky lg:top-4 min-w-0">
        <Tarjeta titulo="Vista previa" icono={<Eye size={13} />}>
          <VistaPrevia colores={colores} logo={logoUrl} nombre={empresaNombre} />
          <p className="text-[11px] text-slate-400 mt-3">Referencia aproximada: cada portal aplica los colores a su propio diseño.</p>
        </Tarjeta>

        <div className="rounded-xl p-4 text-xs text-slate-600 space-y-2" style={{ background: '#F8F9FC', border: '1px solid #EAECEF' }}>
          <p className="flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-px" style={{ color: PUMPKIN }} />
            Los clientes ven esta marca cuando entran con un enlace de {empresaNombre}. Sin enlace de la empresa, cada portal muestra su marca por defecto.
          </p>
          {datos?.actualizadoAt && (
            <p className="text-slate-400 pl-6">
              Última actualización: {new Date(datos.actualizadoAt).toLocaleString('es-VE')}
              {datos.actualizadoPor ? ` · ${datos.actualizadoPor}` : ''}
            </p>
          )}
        </div>

        {personalizada && (
          <button type="button" className="btn-danger w-full text-xs" disabled={ocupado} onClick={() => setConfirmar('restablecer')}>
            {guardando === 'restablecer' ? <Spinner size={13} /> : <RotateCcw size={14} />} Restablecer marca por defecto
          </button>
        )}
      </div>

      {confirmar === 'quitar' && (
        <ConfirmDialog
          title="Quitar logo"
          msg={`Los portales de ${empresaNombre} volverán a mostrar su logo por defecto.`}
          type="danger"
          onConfirm={quitarLogo}
          onCancel={() => setConfirmar(null)}
        />
      )}
      {confirmar === 'restablecer' && (
        <ConfirmDialog
          title="Restablecer marca"
          msg={`Se borran el logo y los colores de ${empresaNombre}. Los portales usarán su marca por defecto.`}
          type="danger"
          onConfirm={restablecer}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </div>
  );
}
