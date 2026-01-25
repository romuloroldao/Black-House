#!/bin/bash
# Script simplificado para exportar dados do Supabase
# Uso: SUPABASE_PASSWORD='sua_senha' ./scripts/exportar-com-senha.sh

set -e

PROJECT_REF="${PROJECT_REF:-cghzttbggklhuyqxzabq}"
BACKUP_DIR="${BACKUP_DIR:-./backup}"

if [ -z "$SUPABASE_PASSWORD" ]; then
    echo "❌ ERRO: Senha do PostgreSQL do Supabase não fornecida!"
    echo ""
    echo "Como obter a senha:"
    echo "  1. Acesse: https://supabase.com/dashboard"
    echo "  2. Selecione projeto: $PROJECT_REF"
    echo "  3. Vá em Settings → Database"
    echo "  4. Procure 'Connection string' ou 'Connection pooling'"
    echo "  5. A senha está na string de conexão"
    echo ""
    echo "Uso:"
    echo "  export SUPABASE_PASSWORD='sua_senha'"
    echo "  ./scripts/exportar-com-senha.sh"
    exit 1
fi

mkdir -p $BACKUP_DIR

echo "=== Exportando dados do Supabase ==="
echo "Project Ref: $PROJECT_REF"
echo "Backup Dir: $BACKUP_DIR"
echo ""

# Exportar schema (estrutura)
echo "1. Exportando schema (estrutura)..."
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
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

# Exportar dados
echo ""
echo "2. Exportando dados..."
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
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

# Exportar schema completo (referência)
echo ""
echo "3. Exportando schema completo (referência)..."
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
  --schema-only \
  > ${BACKUP_DIR}/schema_completo.sql 2>&1

if [ $? -eq 0 ]; then
    echo "   ✅ Schema completo exportado: ${BACKUP_DIR}/schema_completo.sql"
fi

# Estatísticas
echo ""
echo "=== Estatísticas dos Arquivos ==="
ls -lh ${BACKUP_DIR}/*.sql 2>/dev/null | awk '{print "   " $9 " - " $5}'

echo ""
echo "=== Exportação Concluída! ==="
echo ""
echo "Próximos passos:"
echo "  1. Adaptar schema: ./scripts/adapt-schema.sh"
echo "  2. Importar dados: ./scripts/importar-dados.sh"
