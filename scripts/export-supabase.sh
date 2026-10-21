#!/bin/bash
# Script para exportar dados do Supabase

set -e

echo "=== Exportando dados do Supabase ==="

# Configurações padrão
PROJECT_REF="${PROJECT_REF:-cghzttbggklhuyqxzabq}"
BACKUP_DIR="${BACKUP_DIR:-./backup}"

# Se a senha não estiver na variável de ambiente, solicitar
if [ -z "$SUPABASE_PASSWORD" ]; then
    read -sp "Senha do PostgreSQL do Supabase: " SUPABASE_PASSWORD
    echo
fi

if [ -z "$SUPABASE_PASSWORD" ]; then
    echo "ERRO: Senha do PostgreSQL é obrigatória!"
    echo "Exporte a variável: export SUPABASE_PASSWORD='sua_senha'"
    exit 1
fi

mkdir -p $BACKUP_DIR

# Exportar schema (estrutura)
echo "Exportando schema..."
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-schema=realtime \
  --exclude-schema=vault \
  > ${BACKUP_DIR}/schema_public.sql

# Exportar dados
echo "Exportando dados..."
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  > ${BACKUP_DIR}/data.sql

# Exportar schema completo (incluindo auth para referência)
echo "Exportando schema completo (referência)..."
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
  --schema-only \
  > ${BACKUP_DIR}/schema_completo.sql

echo "=== Exportação concluída! ==="
echo "Arquivos salvos em: $BACKUP_DIR"
echo ""
echo "Próximos passos:"
echo "1. Revise os arquivos exportados"
echo "2. Ajuste as referências de auth.users para app_auth.users"
echo "3. Execute a migração: psql -U app_user -d blackhouse_db -f migration/migration_postgres.sql"
echo "4. Importe os dados ajustados"
