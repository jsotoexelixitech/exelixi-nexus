/**
 * Prefijo inyectado por vite.config (`define`).
 * Producción QA/cierrelmds: "/admin". Dev y GCIA (VITE_DIRECT_ACCESS=1): "".
 */
function adminBase(): string {
  return typeof __NEXUS_ADMIN_BASE__ === 'string' ? __NEXUS_ADMIN_BASE__ : '/admin';
}

const GCIA_NEXUS_API = 'https://nexus-api.exelixitech.com';

function isDirectDeploy(): boolean {
  const flag = import.meta.env.VITE_DIRECT_ACCESS;
  if (flag === '1' || flag === 'true') return true;
  return !adminBase();
}

/**
 * Base URL de nexus-api para axios.
 * - GCIA (nexus.exelixitech.com): API absoluta.
 * - IP:puerto / directo: `VITE_API_URL` del build (ej. http://192.168.8.120:3092).
 * - Apache /admin/: `/admin/api` (proxy vite preview → nexus-api).
 */
export function moduleApiBase(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'nexus.exelixitech.com') {
      return configured || GCIA_NEXUS_API;
    }
  }

  if (isDirectDeploy() && configured) {
    return configured;
  }

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
