/**
 * Prefijo inyectado por vite.config (`define`).
 * Producción QA/cierrelmds: "/admin". Dev y acceso directo IP:5200: "".
 */
function adminBase(): string {
  return typeof __NEXUS_ADMIN_BASE__ === 'string' ? __NEXUS_ADMIN_BASE__ : '/admin';
}

/** Base URL axios. QA/cierrelmds: `/admin/api`. Directo/dev: `/api` (proxy → nexus-api). */
export function moduleApiBase(): string {
  const prefix = adminBase();
  return prefix ? `${prefix}/api` : '/api';
}

/** basename para react-router (sin barra final). */
export function routerBasename(): string {
  return adminBase();
}

/** Archivo en `public/` (ej. `/admin/logo-dark-bg.png`). */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  const prefix = adminBase();
  return prefix ? `${prefix}/${clean}` : `/${clean}`;
}
