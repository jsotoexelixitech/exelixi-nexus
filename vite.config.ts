import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  prefixDevProxy,
  PROD_ADMIN_PUBLIC_PREFIX,
  resolveAppBase,
} from './vite-paths';

/** Con Apache strip: assets relativos + base href = /admin/assets en rutas profundas. */
function adminPublicBaseHref(
  mode: string,
  base: string,
  directAccess: boolean,
): Plugin {
  return {
    name: 'admin-public-base-href',
    transformIndexHtml(html) {
      if (mode !== 'production' || base !== './' || directAccess) return html;
      if (/<base\s/i.test(html)) return html;
      return html.replace(
        '<head>',
        `<head>\n    <base href="${PROD_ADMIN_PUBLIC_PREFIX}" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = resolveAppBase(env, mode);
  const directAccess =
    env.VITE_DIRECT_ACCESS === '1' || env.VITE_DIRECT_ACCESS === 'true';
  const apiTarget = env.VITE_API_URL || 'http://127.0.0.1:3092';
  /** QA/cierrelmds Apache: `/admin`. GCIA o `npm run dev`: vacío. */
  const adminPublicBase =
    mode === 'production' && !directAccess ? '/admin' : '';

  const proxy = prefixDevProxy(base, {
    '/api': { target: apiTarget, changeOrigin: true },
  });

  return {
    base,
    define: {
      __NEXUS_ADMIN_BASE__: JSON.stringify(adminPublicBase),
    },
    plugins: [react(), adminPublicBaseHref(mode, base, directAccess)],
    server: {
      port: 5200,
      host: true,
      allowedHosts: true,
      proxy,
    },
    preview: {
      port: 5200,
      host: true,
      allowedHosts: true,
      proxy,
    },
  };
});
