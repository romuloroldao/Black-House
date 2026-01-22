#!/bin/bash
# Script alternativo para exportar dados via API do Supabase
# Usa Service Role Key (limitado - apenas dados, não schema completo)

set -e

PROJECT_REF="cghzttbggklhuyqxzabq"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
BACKUP_DIR="${BACKUP_DIR:-./backup}"

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY não fornecida"
    echo ""
    echo "Como obter:"
    echo "  1. Acesse: https://supabase.com/dashboard"
    echo "  2. Vá em: Settings → API"
    echo "  3. Copie a 'service_role' key (secret)"
    echo ""
    echo "Uso:"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='sua_service_role_key'"
    echo "  ./scripts/exportar-via-api.sh"
    exit 1
fi

mkdir -p $BACKUP_DIR

echo "=== Exportação via API do Supabase ==="
echo "⚠️  ATENÇÃO: Este método é limitado!"
echo "   - Exporta apenas dados das tabelas públicas"
echo "   - Não exporta schema completo"
echo "   - Não exporta funções, triggers, etc."
echo ""
echo "Para exportação completa, use pg_dump com senha do PostgreSQL."
echo ""

# Listar tabelas via API
echo "1. Listando tabelas públicas..."

TABLES=$(curl -s "${SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  2>/dev/null | jq -r 'keys[]' 2>/dev/null || echo "")

if [ -z "$TABLES" ]; then
    echo "   ⚠️  Não foi possível listar tabelas via API"
    echo "   Isso pode ser normal - a API REST não expõe metadados diretamente"
    echo ""
    echo "📝 Recomendação: Use pg_dump com senha do PostgreSQL"
    echo "   Ver: COMO_OBTER_SENHA_POSTGRESQL.md"
    exit 1
fi

echo "   Tabelas encontradas:"
echo "$TABLES" | while read table; do
    echo "     - $table"
done

echo ""
echo "⚠️  Exportação via API requer conhecimento das tabelas."
echo "   Este script é apenas uma base - você precisará adaptar."
echo ""
echo "📝 Para exportação completa, use:"
echo "   export SUPABASE_PASSWORD='senha_postgresql'"
echo "   ./scripts/exportar-supabase-completo.sh"
