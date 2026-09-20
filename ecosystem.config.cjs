/**
 * PM2 — Exélixi Nexus Admin (producción)
 *
 * Sirve dist/ con vite preview (proxy /api → nexus-api local).
 * Build cierrelmds: bash scripts/build-cierrelmds.sh
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs nexus-admin
 */
const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: 'nexus-admin',
      cwd: ROOT,
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host 0.0.0.0 --port 5200 --strictPort',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      out_file: path.join(ROOT, 'logs', 'nexus-admin.out.log'),
      error_file: path.join(ROOT, 'logs', 'nexus-admin.err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
