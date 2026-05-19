#!/usr/bin/env bash
# Gera .env na raiz e server/.env com valores alinhados ao docker-compose.yml
# Uso: na raiz do projeto → bash scripts/setup-local-env.sh
#      Para sobrescrever ficheiros existentes: FORCE=1 bash scripts/setup-local-env.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FORCE="${FORCE:-0}"

gen_jwt() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
  fi
}

write_root_env() {
  cat > "$ROOT/.env" << 'EOF'
# Frontend — URL da API (mesmo host/porta do servidor Node)
VITE_API_URL=http://localhost:3001
EOF
  echo "✅ .env (raiz) — VITE_API_URL"
}

write_server_env() {
  JWT_SECRET="$(gen_jwt)"
  cat > "$ROOT/server/.env" << EOF
# Gerado por scripts/setup-local-env.sh — alinhado a docker-compose.yml (Postgres local)
JWT_SECRET=${JWT_SECRET}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blackhouse_db
DB_USER=app_user
DB_PASSWORD=blackhouse_local_2026

PORT=3001
API_URL=http://localhost:3001
NODE_ENV=development
EOF
  echo "✅ server/.env — JWT aleatório + Postgres (app_user / blackhouse_local_2026)"
}

if [[ "$FORCE" == "1" ]] || [[ ! -f "$ROOT/.env" ]]; then
  write_root_env
else
  echo "ℹ️  Mantive .env na raiz (já existia). FORCE=1 para recriar."
fi

if [[ "$FORCE" == "1" ]] || [[ ! -f "$ROOT/server/.env" ]]; then
  write_server_env
else
  echo "ℹ️  Mantive server/.env (já existia). FORCE=1 para recriar."
fi

echo ""
echo "Próximo: docker compose up -d  &&  npm run db:migrate"
