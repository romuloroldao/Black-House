#!/bin/bash
# Script para adaptar schema exportado do Supabase

set -e

SCHEMA_FILE="${1:-backup/schema_public.sql}"
OUTPUT_FILE="${2:-backup/schema_public_adapted.sql}"

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "Erro: Arquivo $SCHEMA_FILE não encontrado"
    exit 1
fi

echo "Adaptando schema: $SCHEMA_FILE -> $OUTPUT_FILE"

# Substituir referências
sed -e 's/auth\.users/app_auth.users/g' \
    -e 's/REFERENCES auth\.users/REFERENCES app_auth.users/g' \
    -e 's/ON auth\.users/ON app_auth.users/g' \
    "$SCHEMA_FILE" > "$OUTPUT_FILE"

echo "Schema adaptado salvo em: $OUTPUT_FILE"
echo ""
echo "Revise o arquivo antes de importar no banco de dados!"
