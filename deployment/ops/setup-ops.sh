#!/bin/bash
# Instala watchdog, alertas Telegram, políticas de restart e swap.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPS_SRC="${ROOT}/deployment/ops"
OPS_DST="/opt/blackhouse/ops"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute como root: sudo $0"
  exit 1
fi

echo "=== Black House — Setup Operações / HA ==="

mkdir -p "$OPS_DST" /etc/blackhouse /var/log/blackhouse /var/lib/blackhouse

install -m 755 "${OPS_SRC}/watchdog.sh" "${OPS_DST}/watchdog.sh"
install -m 755 "${OPS_SRC}/telegram-alert.sh" "${OPS_DST}/telegram-alert.sh"
install -m 644 "${OPS_SRC}/ecosystem.config.cjs" "${OPS_DST}/ecosystem.config.cjs"

if [[ ! -f /etc/blackhouse/monitoring.env ]]; then
  install -m 600 "${OPS_SRC}/monitoring.env.example" /etc/blackhouse/monitoring.env
  echo "⚠️  Configure Telegram em /etc/blackhouse/monitoring.env"
else
  echo "✓ /etc/blackhouse/monitoring.env já existe"
fi

# systemd — watchdog timer
install -m 644 "${OPS_SRC}/blackhouse-watchdog.service" /etc/systemd/system/blackhouse-watchdog.service
install -m 644 "${OPS_SRC}/blackhouse-watchdog.timer" /etc/systemd/system/blackhouse-watchdog.timer

# systemd — restart policies
mkdir -p /etc/systemd/system/nginx.service.d
mkdir -p /etc/systemd/system/pm2-root.service.d
install -m 644 "${OPS_SRC}/systemd-nginx-restart.conf" /etc/systemd/system/nginx.service.d/restart.conf
install -m 644 "${OPS_SRC}/systemd-pm2-restart.conf" /etc/systemd/system/pm2-root.service.d/restart.conf

# PostgreSQL 15 = único cluster de produção
systemctl enable postgresql@15-main 2>/dev/null || true

# Swap (opcional mas recomendado)
if [[ "${SKIP_SWAP:-}" != "1" ]]; then
  bash "${OPS_SRC}/setup-swap.sh"
fi

systemctl daemon-reload
systemctl enable blackhouse-watchdog.timer
systemctl restart blackhouse-watchdog.timer

# Limpar estado failed de PG15 masked (cosmético em systemctl --failed)
systemctl reset-failed postgresql@15-main 2>/dev/null || true

# PM2
if command -v pm2 >/dev/null; then
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
  pm2 save
fi

echo ""
echo "=== Instalação concluída ==="
echo "1. Edite /etc/blackhouse/monitoring.env (Telegram)"
echo "2. Teste: ${OPS_DST}/watchdog.sh"
echo "3. Timer: systemctl status blackhouse-watchdog.timer"
echo "4. Logs: tail -f /var/log/blackhouse/watchdog.log"
