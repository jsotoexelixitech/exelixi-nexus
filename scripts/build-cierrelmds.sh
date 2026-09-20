#!/usr/bin/env bash
# Build admin para https://cierrelmds.exelixitech.com/admin/ (Apache strip → :5200)
set -e
cd "$(dirname "$0")/.."
unset PORT VITE_DIRECT_ACCESS VITE_APP_BASE

export VITE_APP_BASE=./
export VITE_API_URL="${VITE_API_URL:-https://cierrelmds.exelixitech.com/nexus-api}"

echo "▶ Build cierrelmds (base ./ + <base href=/admin/>)"
echo "   VITE_APP_BASE=$VITE_APP_BASE"
echo "   VITE_API_URL=$VITE_API_URL (solo proxy dev/preview)"

npm run build

if grep -q 'base href="/admin/"' dist/index.html; then
  echo "✅ dist/index.html incluye base href /admin/"
else
  echo "⚠️  Falta <base href=\"/admin/\"> — no uses VITE_DIRECT_ACCESS en este build"
  exit 1
fi

pm2 delete nexus-admin 2>/dev/null || true
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
echo "✅ Admin → https://cierrelmds.exelixitech.com/admin/ y http://127.0.0.1:5200/"
