/** Prefijo público HTTPS del admin (Apache `/admin/` → vite en :5200/). */
const PROD_PUBLIC_PREFIX = '/admin';

/**
 * Solo GCIA / IP:puerto (`VITE_DIRECT_ACCESS=1` o `VITE_APP_BASE=/`).
 * No usar `import.meta.env.BASE_URL === '/'`: Vite con `base: './'` inyecta `/`
 * y el admin de QA acaba pidiendo `/api` y `/logo-dark-bg.png` (404 Apache).
 */
function isDirectDeploy(): boolean {
  const flag = import.meta.env.VITE_DIRECT_ACCESS;
  if (flag === '1' || flag === 'true') return true;
  return String(import.meta.env.VITE_APP_BASE ?? '').trim() === '/';
}

function normalizedBase(): string {
  if (isDirectDeploy()) return '/';
  if (import.meta.env.PROD) return `${PROD_PUBLIC_PREFIX}/`;
  return '/';
}

/** Base URL del admin (Vite `base`). Ej. `/admin/` → API en `/admin/api`. */
export function moduleApiBase(): string {
  return `${normalizedBase()}api`;
}

/** basename para react-router (sin barra final). Nunca `./` ni `/.`. */
export function routerBasename(): string {
  if (isDirectDeploy()) return '';
  if (import.meta.env.PROD) return PROD_PUBLIC_PREFIX;
  return '';
}

/** Archivo en `public/` respetando prefijo (ej. `/admin/logo-dark-bg.png`). */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${normalizedBase()}${clean}`;
}
