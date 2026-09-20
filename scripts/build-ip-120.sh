#!/usr/bin/env bash
# Build SOLO acceso directo http://192.168.8.120:5200/ — NO usar si sirves cierrelmds /admin/
set -e
cd "$(dirname "$0")/.."
unset PORT VITE_APP_BASE

export VITE_APP_BASE=/
export VITE_DIRECT_ACCESS=1
export VITE_API_URL="${VITE_API_URL:-http://192.168.8.120:3092}"

echo "▶ Build IP directa (NO compatible con cierrelmds /admin/)"
npm run build

pm2 delete nexus-admin 2>/dev/null || true
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
echo "✅ Admin IP → http://192.168.8.120:5200/"
