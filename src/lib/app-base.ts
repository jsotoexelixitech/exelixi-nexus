/** Prefijo público HTTPS del admin (Apache `/admin/` → vite en :5200/). */
const PROD_ADMIN = '/admin';

/**
 * Solo GCIA / IP:puerto (`VITE_DIRECT_ACCESS=1`).
 * QA y cierrelmds: Apache en `/admin/`. No usar BASE_URL ni VITE_APP_BASE:
 * Vite con `base: './'` los deja en `/` y el login va a `/api` (404).
 */
function isDirectDeploy(): boolean {
  const flag = import.meta.env.VITE_DIRECT_ACCESS;
  return flag === '1' || flag === 'true';
}

/** Base URL del admin. QA/cierrelmds: `/admin/api`. Directo: `/api`. */
export function moduleApiBase(): string {
  if (isDirectDeploy() || !import.meta.env.PROD) return '/api';
  return `${PROD_ADMIN}/api`;
}

/** basename para react-router (sin barra final). */
export function routerBasename(): string {
  if (isDirectDeploy() || !import.meta.env.PROD) return '';
  return PROD_ADMIN;
}

/** Archivo en `public/` (ej. `/admin/logo-dark-bg.png`). */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  if (isDirectDeploy() || !import.meta.env.PROD) return `/${clean}`;
  return `${PROD_ADMIN}/${clean}`;
}
