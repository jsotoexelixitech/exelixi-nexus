/**
 * PM2 — Exélixi Nexus Admin (producción)
 *
 * Sirve `dist/` con `serve` (SPA). La API va directo a VITE_API_URL del build.
 *
 *   cd ~/nexus-admin && npm run build && pm2 start ecosystem.config.cjs
 *   pm2 logs nexus-admin
 */
const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: 'nexus-admin',
      cwd: ROOT,
      script: 'serve',
      args: '-s dist -l 5200',
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
