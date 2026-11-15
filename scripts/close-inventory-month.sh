#!/usr/bin/env bash

set -euo pipefail

source /etc/warehouse-inventory-cron.env

: "${INVENTORY_APP_URL:?INVENTORY_APP_URL belum diisi}"
: "${INVENTORY_CRON_SECRET:?INVENTORY_CRON_SECRET belum diisi}"

printf 'header = "Authorization: Bearer %s"\n' \
  "$INVENTORY_CRON_SECRET" |
  curl \
    --config - \
    --fail-with-body \
    --silent \
    --show-error \
    --connect-timeout 15 \
    --max-time 900 \
    --request POST \
    "${INVENTORY_APP_URL%/}/api/cron/inventory-monthly"

printf '\n'