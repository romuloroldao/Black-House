#!/bin/bash
# Script para exportar via túnel SSH
# Execute este script na VPS APÓS criar o túnel SSH do seu computador

set -e

echo "=== Exportação via Túnel SSH ==="
echo ""
echo "⚠️  PRÉ-REQUISITO:"
echo "   No seu computador local, execute:"
echo "   ssh -L 5433:db.cghzttbggklhuyqxzabq.supabase.co:5432 root@177.153.64.95 -N -f"
echo ""
read -p "Túnel SSH criado? (s/N): " TUNEL_CRIADO

if [ "$TUNEL_CRIADO" != "s" ] && [ "$TUNEL_CRIADO" != "S" ]; then
    echo "Crie o túnel SSH primeiro!"
    exit 1
fi

export SUPABASE_PASSWORD='RR0ld40.864050!'
BACKUP_DIR="${BACKUP_DIR:-./backup}"
mkdir -p $BACKUP_DIR

echo ""
echo "1. Testando conexão via túnel..."
if ! pg_isready -h localhost -p 5433 -U postgres > /dev/null 2>&1; then
    echo "   ⚠️  Não conseguiu conectar via localhost:5433"
    echo "   Verifique se o túnel SSH está ativo"
    exit 1
fi
echo "   ✅ Conexão OK"

echo ""
echo "2. Exportando schema..."
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@localhost:5433/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-schema=realtime \
  --exclude-schema=vault \
  > ${BACKUP_DIR}/schema_public.sql 2>&1

if [ $? -eq 0 ]; then
    echo "   ✅ Schema exportado: ${BACKUP_DIR}/schema_public.sql"
else
    echo "   ❌ Erro ao exportar schema"
    exit 1
fi

echo ""
echo "3. Exportando dados..."
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@localhost:5433/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  > ${BACKUP_DIR}/data.sql 2>&1

if [ $? -eq 0 ]; then
    echo "   ✅ Dados exportados: ${BACKUP_DIR}/data.sql"
else
    echo "   ❌ Erro ao exportar dados"
    exit 1
fi

echo ""
echo "=== Exportação Concluída! ==="
echo ""
echo "Próximos passos:"
echo "  ./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql"
echo "  ./scripts/importar-dados.sh"
