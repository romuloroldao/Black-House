#!/bin/bash
# ============================================================================
# Script para importar dados CSV para tabelas do Supabase
# ============================================================================

set -e

echo "============================================================================"
echo "IMPORTAÇÃO DE DADOS CSV PARA SUPABASE"
echo "============================================================================"
echo ""

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não encontrado. Por favor, instale Python3 primeiro."
    exit 1
fi

# Verificar se os arquivos CSV existem
CSV_FILES=(
    "migrations_rows.csv"
    "objects_rows.csv"
    "buckets_rows.csv"
    "prefixes_rows.csv"
)

MISSING_FILES=()

for file in "${CSV_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -eq ${#CSV_FILES[@]} ]; then
    echo "❌ Nenhum arquivo CSV encontrado!"
    echo ""
    echo "Por favor, coloque os arquivos CSV no mesmo diretório:"
    for file in "${CSV_FILES[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "⚠️  Alguns arquivos CSV não foram encontrados:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Continuando com os arquivos disponíveis..."
    echo ""
fi

# Executar script Python
echo "Executando script Python para gerar INSERTs..."
echo ""

python3 import_csv_data.py

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================================"
    echo "✅ Scripts SQL gerados com sucesso!"
    echo "============================================================================"
    echo ""
    echo "Arquivos gerados:"
    echo "  - migrations_inserts.sql"
    echo "  - objects_inserts.sql"
    echo "  - buckets_inserts.sql"
    echo "  - prefixes_inserts.sql"
    echo ""
    echo "Próximos passos:"
    echo "1. Revise os arquivos SQL gerados"
    echo "2. Execute-os no Supabase SQL Editor"
    echo "3. Verifique se os dados foram importados corretamente"
    echo ""
else
    echo ""
    echo "❌ Erro ao executar o script Python"
    exit 1
fi
