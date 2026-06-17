#!/bin/bash
# Watchdog Black House — verifica saúde do stack e tenta recuperação automática.
# Instalar via deployment/ops/setup-ops.sh

set -euo pipefail

ENV_FILE="${BLACKHOUSE_MONITORING_ENV:-/etc/blackhouse/monitoring.env}"
LOG_FILE="/var/log/blackhouse/watchdog.log"
HOSTNAME=$(hostname -f 2>/dev/null || hostname)

CPU_THRESHOLD="${CPU_THRESHOLD:-90}"
RAM_THRESHOLD="${RAM_THRESHOLD:-90}"
DISK_THRESHOLD="${DISK_THRESHOLD:-85}"
API_PORT="${API_PORT:-3001}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:${API_PORT}/health}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-https://127.0.0.1/}"
API_HEALTH_HOST="${API_HEALTH_HOST:-api.blackhouse.app.br}"
FRONTEND_HEALTH_HOST="${FRONTEND_HEALTH_HOST:-blackhouse.app.br}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALERT_SCRIPT="${SCRIPT_DIR}/telegram-alert.sh"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

alert() {
  local key="$1"
  local msg="$2"
  log "ALERT [$key] $msg"
  if [[ -f "$ENV_FILE" ]] && [[ -x "$ALERT_SCRIPT" ]]; then
    "$ALERT_SCRIPT" "$key" "$msg" || true
  fi
}

restart_service() {
  local svc="$1"
  log "Reiniciando serviço: $svc"
  systemctl restart "$svc" 2>&1 | tee -a "$LOG_FILE" || true
}

check_port() {
  local port="$1"
  local name="$2"
  if ss -tln | grep -q ":${port} "; then
    return 0
  fi
  alert "port_${port}" "Porta ${port} (${name}) não está em LISTEN."
  return 1
}

get_cpu_usage() {
  # Amostra de 1s via /proc/stat
  local idle1 total1 idle2 total2
  read -r _ user nice system idle iowait irq softirq steal guest guest_nice < /proc/stat
  idle1=$((idle + iowait))
  total1=$((user + nice + system + idle + iowait + irq + softirq + steal))

  sleep 1

  read -r _ user nice system idle iowait irq softirq steal guest guest_nice < /proc/stat
  idle2=$((idle + iowait))
  total2=$((user + nice + system + idle + iowait + irq + softirq + steal))

  local diff_total=$((total2 - total1))
  local diff_idle=$((idle2 - idle1))
  if (( diff_total <= 0 )); then
    echo 0
    return
  fi
  echo $(( (diff_total - diff_idle) * 100 / diff_total ))
}

get_ram_usage_pct() {
  awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END {if(t>0) printf "%d", (t-a)*100/t; else print 0}' /proc/meminfo
}

get_disk_usage_pct() {
  df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}'
}

check_http() {
  local url="$1"
  local host_header="${2:-}"
  local label="$3"
  local extra_args=()
  if [[ -n "$host_header" ]]; then
    extra_args+=(-H "Host: ${host_header}")
  fi
  local code
  code=$(curl -sk --max-time 10 "${extra_args[@]}" -o /tmp/bh-watchdog-body.txt -w "%{http_code}" "$url" || echo "000")
  if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" ]]; then
    return 0
  fi
  alert "http_${label}" "HTTP ${label} falhou: ${url} → HTTP ${code}"
  return 1
}

check_api_health() {
  local body code
  code=$(curl -s --max-time 10 -o /tmp/bh-api-health.json -w "%{http_code}" "$API_HEALTH_URL" || echo "000")
  if [[ "$code" != "200" ]]; then
    alert "api_health" "API /health retornou HTTP ${code}"
    return 1
  fi
  body=$(cat /tmp/bh-api-health.json)
  if ! echo "$body" | grep -q '"status":"ok"'; then
    alert "api_degraded" "API degradada: ${body:0:200}"
    return 1
  fi
  return 0
}

check_postgres() {
  if ! check_port 5432 "PostgreSQL"; then
    restart_service "postgresql@15-main"
    return 1
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
    alert "postgres" "PostgreSQL não responde a SELECT 1"
    restart_service "postgresql@15-main"
    return 1
  fi
  if ! PGPASSWORD="$(grep '^DB_PASSWORD=' /root/server/.env 2>/dev/null | cut -d= -f2- | sed 's/^"//;s/"$//')" \
    psql -h localhost -U app_user -d blackhouse_db -tAc "SELECT 1" >/dev/null 2>&1; then
    alert "postgres_auth" "Falha de autenticação app_user no PostgreSQL"
    return 1
  fi
  return 0
}

recover_pm2() {
  if ! command -v pm2 >/dev/null; then
    alert "pm2_missing" "PM2 não instalado"
    return 1
  fi
  local status
  status=$(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
  apps=json.load(sys.stdin)
  for a in apps:
    if a.get('name')=='blackhouse-api':
      print(a.get('pm2_env',{}).get('status','unknown'))
      sys.exit(0)
  print('missing')
except Exception:
  print('error')
" 2>/dev/null || echo "error")

  if [[ "$status" != "online" ]]; then
    alert "pm2_api" "blackhouse-api status=${status} — executando pm2 resurrect"
    pm2 resurrect 2>&1 | tee -a "$LOG_FILE" || true
    pm2 restart blackhouse-api 2>&1 | tee -a "$LOG_FILE" || true
    sleep 5
  fi
  check_port "$API_PORT" "blackhouse-api" || return 1
  return 0
}

main() {
  mkdir -p "$(dirname "$LOG_FILE")" /var/lib/blackhouse
  touch "$LOG_FILE"

  local failures=0

  # Recursos
  local cpu ram disk
  cpu=$(get_cpu_usage)
  ram=$(get_ram_usage_pct)
  disk=$(get_disk_usage_pct)

  log "Check iniciado — CPU=${cpu}% RAM=${ram}% DISK=${disk}%"

  if (( cpu >= CPU_THRESHOLD )); then
    alert "cpu_high" "CPU em ${cpu}% (limite ${CPU_THRESHOLD}%)"
    ((failures++)) || true
  fi
  if (( ram >= RAM_THRESHOLD )); then
    alert "ram_high" "RAM em ${ram}% (limite ${RAM_THRESHOLD}%)"
    ((failures++)) || true
  fi
  if (( disk >= DISK_THRESHOLD )); then
    alert "disk_high" "Disco raiz em ${disk}% (limite ${DISK_THRESHOLD}%)"
    ((failures++)) || true
  fi

  # Nginx
  if ! systemctl is-active --quiet nginx; then
    alert "nginx_down" "Nginx não está active"
    restart_service nginx
    ((failures++)) || true
  fi
  check_port 80 "nginx-http" || restart_service nginx
  check_port 443 "nginx-https" || restart_service nginx

  # PostgreSQL
  if ! check_postgres; then
    ((failures++)) || true
  fi

  # PM2 / API
  if ! recover_pm2; then
    ((failures++)) || true
  fi

  # HTTP checks (com Host header para vhosts)
  if ! check_http "https://127.0.0.1/health" "$API_HEALTH_HOST" "api_health_proxy"; then
    restart_service nginx
    recover_pm2
    ((failures++)) || true
  fi

  if ! check_api_health; then
    recover_pm2
    ((failures++)) || true
  fi

  if ! check_http "https://127.0.0.1/" "$FRONTEND_HEALTH_HOST" "frontend"; then
    restart_service nginx
    ((failures++)) || true
  fi

  if (( failures == 0 )); then
    log "Check OK — todos os verificações passaram"
  else
    log "Check com ${failures} falha(s) — ações de recuperação executadas"
  fi
}

main "$@"
