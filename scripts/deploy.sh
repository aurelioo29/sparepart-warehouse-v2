#!/usr/bin/env bash

set -euo pipefail

# Konfigurasi VPS
DEPLOY_HOST="${DEPLOY_HOST:-103.93.162.117}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/sparepart-vps-key.pem}"

APP_DIR="/var/www/battery-warehouse-v2"

# Selalu jalankan dari folder utama proyek.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

MODE="${1:-all}"

case "$MODE" in
  all|upload|server) ;;
  *)
    echo "Gunakan: bash scripts/deploy.sh [all|upload|server]"
    exit 1
    ;;
esac

test -f package.json
test -f package-lock.json
test -f "$DEPLOY_KEY"

upload() {
  echo "→ Upload kode ke VPS..."

  rsync -az \
    --exclude='.git' \
    --exclude='.github' \
    --exclude='node_modules' \
    --exclude='.next' \
    --include='.env.example' \
    --exclude='.env*' \
    --exclude='public/uploads' \
    --exclude='/DEPLOYED_COMMIT' \
    -e "ssh -i '$DEPLOY_KEY' -o IdentitiesOnly=yes -p $DEPLOY_PORT" \
    ./ \
    "$DEPLOY_USER@$DEPLOY_HOST:$APP_DIR/"

  echo "✓ Upload selesai."
}

deploy_server() {
  echo "→ Menjalankan deployment..."

  ssh \
    -i "$DEPLOY_KEY" \
    -o IdentitiesOnly=yes \
    -p "$DEPLOY_PORT" \
    "$DEPLOY_USER@$DEPLOY_HOST" \
    'bash -se' <<'REMOTE'
set -euo pipefail

APP_DIR="/var/www/battery-warehouse-v2"
APP_NAME="battery-warehouse-v2"

cd "$APP_DIR"

echo "→ Install dependencies..."
npm ci --include=dev

echo "→ Generate Prisma..."
./node_modules/.bin/prisma generate

echo "→ Migrasi database..."
./node_modules/.bin/prisma migrate deploy

echo "→ Perbarui permissions..."
npm run db:seed

echo "→ Build aplikasi..."
npm run build

echo "→ Restart aplikasi..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  PORT=7002 pm2 restart "$APP_NAME" --update-env
else
  PORT=7002 pm2 start npm \
    --name "$APP_NAME" \
    --cwd "$APP_DIR" \
    -- start
fi

echo "→ Cek respons aplikasi..."
HEALTHY=false

for attempt in {1..15}; do
  if curl \
    --fail \
    --silent \
    --output /dev/null \
    --max-time 5 \
    http://127.0.0.1:7002/login; then
    HEALTHY=true
    break
  fi

  sleep 2
done

if [ "$HEALTHY" != "true" ]; then
  echo "✗ Aplikasi belum merespons."
  pm2 logs "$APP_NAME" --lines 60 --nostream
  exit 1
fi

pm2 save

echo "✓ Deploy berhasil."
REMOTE
}

case "$MODE" in
  upload)
    upload
    ;;
  server)
    deploy_server
    ;;
  all)
    upload
    deploy_server
    ;;
esac