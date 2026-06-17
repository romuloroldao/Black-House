#!/bin/bash
# Envia alerta via Telegram Bot API.
# Requer /etc/blackhouse/monitoring.env com TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID.

set -euo pipefail

ENV_FILE="${BLACKHOUSE_MONITORING_ENV:-/etc/blackhouse/monitoring.env}"
STATE_DIR="/var/lib/blackhouse"
STATE_FILE="${STATE_DIR}/alert-state"
COOLDOWN_SEC="${ALERT_COOLDOWN_SEC:-300}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "monitoring.env não encontrado: $ENV_FILE" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados" >&2
  exit 1
fi

ALERT_KEY="${1:-general}"
MESSAGE="${2:-Alerta Black House}"

mkdir -p "$STATE_DIR"
NOW=$(date +%s)
LAST=0
if [[ -f "$STATE_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$STATE_FILE"
  LAST="${LAST_ALERT_${ALERT_KEY}:-0}"
fi

if (( NOW - LAST < COOLDOWN_SEC )); then
  echo "Alerta '$ALERT_KEY' suprimido (cooldown ${COOLDOWN_SEC}s)"
  exit 0
fi

HOSTNAME=$(hostname -f 2>/dev/null || hostname)
TEXT=$(cat <<EOF
🚨 Black House — ${HOSTNAME}
${MESSAGE}
${ALERT_KEY} · $(date '+%Y-%m-%d %H:%M:%S %Z')
EOF
)

HTTP_CODE=$(curl -sS -o /tmp/telegram-alert-response.txt -w "%{http_code}" \
  --max-time 15 \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${TEXT}" || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "LAST_ALERT_${ALERT_KEY}=${NOW}" > "$STATE_FILE"
  exit 0
fi

echo "Falha Telegram HTTP ${HTTP_CODE}: $(cat /tmp/telegram-alert-response.txt 2>/dev/null)" >&2
exit 1
