#!/bin/bash
# Script para verificar se o schema exportado está correto

SCHEMA_FILE="${1:-backup/schema_public.sql}"

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ Arquivo não encontrado: $SCHEMA_FILE"
    exit 1
fi

echo "=== Verificando Schema Exportado ==="
echo "Arquivo: $SCHEMA_FILE"
echo ""

# Verificar se há referências a storage
echo "1. Verificando referências a 'storage'..."
STORAGE_COUNT=$(grep -i "storage\." "$SCHEMA_FILE" | grep -v "^--" | wc -l)
if [ "$STORAGE_COUNT" -gt 0 ]; then
    echo "   ⚠️  Encontradas $STORAGE_COUNT referências a 'storage'"
    echo "   Isso não deveria estar no schema public!"
    grep -i "storage\." "$SCHEMA_FILE" | grep -v "^--" | head -5
else
    echo "   ✅ Nenhuma referência a 'storage' encontrada"
fi

# Verificar se há referências a auth
echo ""
echo "2. Verificando referências a 'auth'..."
AUTH_COUNT=$(grep -i "auth\." "$SCHEMA_FILE" | grep -v "^--" | wc -l)
if [ "$AUTH_COUNT" -gt 0 ]; then
    echo "   ⚠️  Encontradas $AUTH_COUNT referências a 'auth'"
    grep -i "auth\." "$SCHEMA_FILE" | grep -v "^--" | head -5
else
    echo "   ✅ Nenhuma referência a 'auth' encontrada"
fi

# Verificar se há CREATE TABLE do schema public
echo ""
echo "3. Verificando CREATE TABLE do schema public..."
PUBLIC_TABLES=$(grep -i "CREATE TABLE.*public\." "$SCHEMA_FILE" | wc -l)
if [ "$PUBLIC_TABLES" -gt 0 ]; then
    echo "   ⚠️  Encontradas tabelas com 'public.' explícito"
    echo "   (Isso pode ser normal, mas verifique)"
else
    echo "   ✅ Tabelas sem schema explícito (normal para schema public)"
fi

# Contar CREATE TABLE
echo ""
echo "4. Contando CREATE TABLE..."
TABLE_COUNT=$(grep -i "^CREATE TABLE" "$SCHEMA_FILE" | wc -l)
echo "   Total de CREATE TABLE: $TABLE_COUNT"

# Listar tabelas
echo ""
echo "5. Tabelas encontradas:"
grep -i "^CREATE TABLE" "$SCHEMA_FILE" | sed 's/CREATE TABLE IF NOT EXISTS //' | sed 's/ (.*//' | sort

echo ""
echo "=== Verificação Concluída ==="
echo ""
if [ "$STORAGE_COUNT" -gt 0 ] || [ "$AUTH_COUNT" -gt 0 ]; then
    echo "⚠️  ATENÇÃO: O schema contém referências a schemas do Supabase!"
    echo "   Remova essas referências antes de importar."
    echo "   Use apenas tabelas do schema 'public'"
    exit 1
else
    echo "✅ Schema parece correto (apenas schema public)"
fi
