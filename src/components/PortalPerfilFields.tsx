import React from 'react';

export type PortalPerfilForm = {
  resolverGestorPorEmail: boolean;
  centidad: string;
  citem: string;
  cproductor: string;
  cusuario: string;
  cgestor: string;
  ccanalaltIn: string;
  cscanalaltIn: string;
};

export const emptyPortalPerfil = (): PortalPerfilForm => ({
  resolverGestorPorEmail: true,
  centidad: '',
  citem: '',
  cproductor: '',
  cusuario: '',
  cgestor: '',
  ccanalaltIn: '',
  cscanalaltIn: '',
});

export function portalPerfilFromApi(raw: Record<string, unknown> | null | undefined): PortalPerfilForm {
  if (!raw) return emptyPortalPerfil();
  return {
    resolverGestorPorEmail: raw.resolverGestorPorEmail !== false,
    centidad: String(raw.centidad ?? ''),
    citem: String(raw.citem ?? ''),
    cproductor: String(raw.cproductor ?? ''),
    cusuario: String(raw.cusuario ?? ''),
    cgestor: String(raw.cgestor ?? ''),
    ccanalaltIn: String(raw.ccanalaltIn ?? ''),
    cscanalaltIn: String(raw.cscanalaltIn ?? ''),
  };
}

export function portalPerfilToPayload(form: PortalPerfilForm) {
  const hasAny =
    form.centidad ||
    form.citem ||
    form.cproductor ||
    form.cusuario ||
    form.cgestor ||
    form.ccanalaltIn ||
    form.cscanalaltIn ||
    form.resolverGestorPorEmail === false;
  if (!hasAny) return undefined;
  return {
    resolverGestorPorEmail: form.resolverGestorPorEmail,
    centidad: form.centidad || null,
    citem: form.citem || null,
    cproductor: form.cproductor || null,
    cusuario: form.cusuario || null,
    cgestor: form.cgestor || null,
    ccanalaltIn: form.ccanalaltIn || null,
    cscanalaltIn: form.cscanalaltIn || null,
  };
}

type Props = {
  value: PortalPerfilForm;
  onChange: (next: PortalPerfilForm) => void;
};

export function PortalPerfilFields({ value, onChange }: Props) {
  const set = (patch: Partial<PortalPerfilForm>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-slate-800">Portal La Mundial (canal Sis2000)</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Se guarda en base de datos. Si está vacío, usa la config de la empresa o resuelve gestor por correo.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={value.resolverGestorPorEmail}
          onChange={(e) => set({ resolverGestorPorEmail: e.target.checked })}
        />
        Resolver canal por correo del operador (magestor)
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Centidad</label>
          <select
            className="input"
            value={value.centidad}
            onChange={(e) => set({ centidad: e.target.value })}
          >
            <option value="">(Automático)</option>
            <option value="P">P — Productor</option>
            <option value="C">C — Comercializador</option>
            <option value="G">G — Gestor</option>
          </select>
        </div>
        <div>
          <label className="label">Citem</label>
          <input
            className="input"
            value={value.citem}
            onChange={(e) => set({ citem: e.target.value })}
            placeholder="80080"
          />
        </div>
        <div>
          <label className="label">Productor (cproductor)</label>
          <input
            className="input"
            value={value.cproductor}
            onChange={(e) => set({ cproductor: e.target.value })}
            placeholder="80080"
          />
        </div>
        <div>
          <label className="label">Usuario Sis2000 (cusuario)</label>
          <input
            className="input"
            value={value.cusuario}
            onChange={(e) => set({ cusuario: e.target.value })}
            placeholder="4"
          />
        </div>
        <div>
          <label className="label">Gestor (cgestor)</label>
          <input
            className="input"
            value={value.cgestor}
            onChange={(e) => set({ cgestor: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Canal alt. (ccanalalt_in)</label>
          <input
            className="input"
            value={value.ccanalaltIn}
            onChange={(e) => set({ ccanalaltIn: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
