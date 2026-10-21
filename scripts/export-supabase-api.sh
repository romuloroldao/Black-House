#!/bin/bash
# Script alternativo para exportar dados do Supabase usando API
# Requer: SUPABASE_SERVICE_ROLE_KEY

set -e

echo "=== Exportando dados do Supabase via API ==="

PROJECT_REF="${PROJECT_REF:-cghzttbggklhuyqxzabq}"
SUPABASE_URL="${SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}"
BACKUP_DIR="${BACKUP_DIR:-./backup}"

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "ERRO: SUPABASE_SERVICE_ROLE_KEY não definida!"
    echo "Exporte a variável: export SUPABASE_SERVICE_ROLE_KEY='sua_service_role_key'"
    exit 1
fi

mkdir -p $BACKUP_DIR

echo "NOTA: Para exportar schema e dados completos, é necessário usar pg_dump com a senha do PostgreSQL."
echo "Este script é apenas uma alternativa usando a API."
echo ""
echo "Para exportação completa, use:"
echo "  export SUPABASE_PASSWORD='sua_senha_postgresql'"
echo "  ./scripts/export-supabase.sh"
echo ""
echo "Ou obtenha a senha do PostgreSQL em:"
echo "  Supabase Dashboard → Settings → Database → Connection string"
echo ""

# Exportar via API (limitado - apenas dados das tabelas públicas)
echo "Exportando dados via API (tabelas públicas)..."
echo "NOTA: A exportação completa requer acesso direto ao PostgreSQL."

# Listar tabelas (exemplo - requer implementação da API)
echo "Para exportação completa, use o script export-supabase.sh com a senha do PostgreSQL"
