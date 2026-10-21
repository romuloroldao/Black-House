#!/bin/bash
# Script para importar dados exportados do Supabase

set -e

BACKUP_DIR="${BACKUP_DIR:-./backup}"
DB_NAME="${DB_NAME:-blackhouse_db}"
DB_USER="${DB_USER:-app_user}"
DB_HOST="${DB_HOST:-localhost}"

# Carregar senha do .env se existir
if [ -f "/var/www/blackhouse/server/.env" ]; then
    export $(grep -v '^#' /var/www/blackhouse/server/.env | grep DB_PASSWORD | xargs)
fi

# Se não estiver definido, usar senha temporária
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="${DB_PASSWORD:-temp_password_change_me_123!}"
fi

export PGPASSWORD="$DB_PASSWORD"

echo "=== Importando Dados ==="
echo ""

# Verificar se arquivos existem
if [ ! -f "$BACKUP_DIR/schema_public_adapted.sql" ]; then
    echo "⚠️  Arquivo schema_public_adapted.sql não encontrado!"
    echo "Execute primeiro: ./scripts/adapt-schema.sh"
    exit 1
fi

if [ ! -f "$BACKUP_DIR/data.sql" ]; then
    echo "⚠️  Arquivo data.sql não encontrado!"
    echo "Execute primeiro: ./scripts/export-supabase.sh"
    exit 1
fi

# 1. Importar schema adaptado
echo "1. Importando schema adaptado..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$BACKUP_DIR/schema_public_adapted.sql" > /tmp/import_schema.log 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Schema importado com sucesso"
else
    echo "❌ Erro ao importar schema. Verifique /tmp/import_schema.log"
    exit 1
fi

# 2. Importar dados
echo ""
echo "2. Importando dados..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$BACKUP_DIR/data.sql" > /tmp/import_data.log 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Dados importados com sucesso"
else
    echo "⚠️  Avisos durante importação de dados (pode ser normal). Verifique /tmp/import_data.log"
fi

# 3. Verificar importação
echo ""
echo "3. Verificando importação..."
TABLE_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | xargs)
echo "✅ Tabelas públicas encontradas: $TABLE_COUNT"

# 4. Estatísticas
echo ""
echo "4. Estatísticas do banco:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    schemaname,
    COUNT(*) as tabelas
FROM pg_tables 
WHERE schemaname IN ('public', 'app_auth')
GROUP BY schemaname;
"

unset PGPASSWORD

echo ""
echo "=== Importação Concluída! ==="
