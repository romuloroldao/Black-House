#!/bin/bash
# Script para limpar sessões expiradas do banco de dados

set -e

DB_NAME="${DB_NAME:-blackhouse_db}"
DB_USER="${DB_USER:-app_user}"
DB_HOST="${DB_HOST:-localhost}"

export PGPASSWORD="${DB_PASSWORD}"

echo "Limpando sessões expiradas..."

psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
SELECT app_auth.cleanup_expired_sessions() as deleted_sessions;
\q
EOF

unset PGPASSWORD

echo "Limpeza concluída!"
