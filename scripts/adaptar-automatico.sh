#!/bin/bash
# Script para adaptar automaticamente o código do Supabase para API própria
# Faz substituições automáticas onde possível

set -e

PROJECT_DIR="${1:-/root/Black-House}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Diretório não encontrado: $PROJECT_DIR"
    echo "Clone o repositório primeiro!"
    exit 1
fi

echo "=== Adaptação Automática do Frontend ==="
echo "Diretório: $PROJECT_DIR"
echo ""

cd "$PROJECT_DIR"

# Backup
echo "💾 Criando backup..."
BACKUP_DIR=".backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    cp "$file" "$BACKUP_DIR/$file"
done
echo "✅ Backup criado em: $BACKUP_DIR"
echo ""

# 1. Copiar api-client
echo "📝 Configurando api-client..."
mkdir -p src/lib
cp /root/src/lib/api-client.ts src/lib/api-client.ts
echo "✅ api-client.ts copiado"
echo ""

# 2. Encontrar arquivos que usam Supabase
echo "🔍 Procurando arquivos que usam Supabase..."
FILES=$(grep -r -l "supabase\|@supabase\|createClient" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | sort -u || true)

if [ -z "$FILES" ]; then
    echo "✅ Nenhum arquivo encontrado usando Supabase"
    exit 0
fi

echo "📋 Arquivos encontrados:"
echo "$FILES" | while read file; do
    echo "  - $file"
done
echo ""

# 3. Fazer substituições automáticas
echo "🔄 Fazendo substituições automáticas..."
echo ""

for file in $FILES; do
    echo "Processando: $file"
    
    # Substituir import do Supabase
    sed -i "s|import { createClient } from '@supabase/supabase-js'|import { apiClient } from './lib/api-client'|g" "$file"
    sed -i "s|import.*supabase.*from.*@supabase|import { apiClient } from './lib/api-client'|g" "$file"
    
    # Substituir criação de cliente
    sed -i "s|const supabase = createClient.*||g" "$file"
    sed -i "s|const supabaseClient = createClient.*||g" "$file"
    
    # Substituir chamadas de autenticação
    sed -i "s|supabase\.auth\.signUp|apiClient.signUp|g" "$file"
    sed -i "s|supabase\.auth\.signInWithPassword|apiClient.signIn|g" "$file"
    sed -i "s|supabase\.auth\.signOut|apiClient.signOut|g" "$file"
    sed -i "s|supabase\.auth\.getUser|apiClient.getUser|g" "$file"
    sed -i "s|supabase\.auth\.onAuthStateChange|// TODO: Implementar listener de auth|g" "$file"
    
    # Substituir queries
    sed -i "s|supabase\.from(\([^)]*\))\.select|apiClient.from(\1).select|g" "$file"
    sed -i "s|supabase\.from(\([^)]*\))\.insert|apiClient.from(\1).insert|g" "$file"
    sed -i "s|supabase\.from(\([^)]*\))\.update|apiClient.from(\1).update|g" "$file"
    sed -i "s|supabase\.from(\([^)]*\))\.delete|apiClient.from(\1).delete|g" "$file"
    
    # Substituir storage
    sed -i "s|supabase\.storage\.from(\([^)]*\))\.upload(\([^,]*\),|apiClient.uploadFile(\1, \2,|g" "$file"
    sed -i "s|supabase\.storage\.from(\([^)]*\))\.getPublicUrl(\([^)]*\))|apiClient.getPublicUrl(\1, \2)|g" "$file"
    
    # Substituir RPC
    sed -i "s|supabase\.rpc(\([^,]*\),|apiClient.rpc(\1,|g" "$file"
    
    echo "  ✅ Processado"
done

echo ""
echo "⚠️  ATENÇÃO: Revise os arquivos modificados!"
echo "   Algumas substituições podem precisar de ajustes manuais."
echo ""
echo "📋 Arquivos modificados:"
echo "$FILES" | while read file; do
    echo "  - $file"
done

echo ""
echo "✅ Adaptação automática concluída!"
echo ""
echo "Próximos passos:"
echo "  1. Revise os arquivos modificados"
echo "  2. Teste: npm run dev"
echo "  3. Corrija erros se houver"
echo "  4. Build: npm run build"
