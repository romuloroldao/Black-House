#!/bin/bash
# Script para preparar importação após receber arquivos SQL

set -e

BACKUP_DIR="${BACKUP_DIR:-./backup}"

echo "=== Preparando Importação ==="
echo ""

# Verificar arquivos
echo "1. Verificando arquivos em $BACKUP_DIR..."
if [ ! -f "$BACKUP_DIR/schema_public.sql" ]; then
    echo "   ⚠️  schema_public.sql não encontrado"
    echo "   Transfira o arquivo para: $BACKUP_DIR/schema_public.sql"
    exit 1
fi

if [ ! -f "$BACKUP_DIR/data.sql" ]; then
    echo "   ⚠️  data.sql não encontrado"
    echo "   Transfira o arquivo para: $BACKUP_DIR/data.sql"
    exit 1
fi

echo "   ✅ Arquivos encontrados:"
ls -lh $BACKUP_DIR/*.sql | grep -E "(schema_public|data)" | awk '{print "      " $9 " (" $5 ")"}'

# Verificar conteúdo
echo ""
echo "2. Verificando conteúdo dos arquivos..."
SCHEMA_LINES=$(wc -l < $BACKUP_DIR/schema_public.sql)
DATA_LINES=$(wc -l < $BACKUP_DIR/data.sql)

echo "   Schema: $SCHEMA_LINES linhas"
echo "   Dados: $DATA_LINES linhas"

if [ $SCHEMA_LINES -lt 10 ]; then
    echo "   ⚠️  Schema parece muito pequeno. Verifique se a exportação foi completa."
fi

if [ $DATA_LINES -lt 10 ]; then
    echo "   ⚠️  Dados parecem muito pequenos. Pode ser que não haja dados ou a exportação falhou."
fi

# Adaptar schema
echo ""
echo "3. Adaptando schema (substituindo auth.users por app_auth.users)..."
./scripts/adapt-schema.sh $BACKUP_DIR/schema_public.sql $BACKUP_DIR/schema_public_adapted.sql

if [ ! -f "$BACKUP_DIR/schema_public_adapted.sql" ]; then
    echo "   ❌ Erro ao adaptar schema"
    exit 1
fi

ADAPTED_LINES=$(wc -l < $BACKUP_DIR/schema_public_adapted.sql)
echo "   ✅ Schema adaptado: $ADAPTED_LINES linhas"

# Resumo
echo ""
echo "=== Preparação Concluída! ==="
echo ""
echo "Próximo passo:"
echo "  ./scripts/importar-dados.sh"
echo ""
echo "Ou importe manualmente:"
echo "  PGPASSWORD='senha' psql -h localhost -U app_user -d blackhouse_db -f backup/schema_public_adapted.sql"
echo "  PGPASSWORD='senha' psql -h localhost -U app_user -d blackhouse_db -f backup/data.sql"
