#!/bin/bash
# Script para adaptar frontend do Supabase para API própria

set -e

PROJECT_DIR="${1:-/root/Black-House}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "⚠️  Diretório do projeto não encontrado: $PROJECT_DIR"
    echo "Clone o repositório primeiro:"
    echo "  git clone https://github.com/romuloroldao/Black-House.git"
    exit 1
fi

echo "=== Adaptando Frontend ==="
echo "Diretório: $PROJECT_DIR"
echo ""

cd "$PROJECT_DIR"

# 1. Verificar se api-client.ts já existe
if [ -f "src/lib/api-client.ts" ]; then
    echo "✅ api-client.ts já existe"
else
    echo "📝 Copiando api-client.ts..."
    mkdir -p src/lib
    cp /root/src/lib/api-client.ts src/lib/api-client.ts
    echo "✅ api-client.ts copiado"
fi

# 2. Criar/atualizar .env
echo ""
echo "📝 Configurando variáveis de ambiente..."
if [ -f ".env" ]; then
    echo "⚠️  .env já existe, fazendo backup..."
    cp .env .env.backup
fi

cat > .env << 'EOF'
# API URL
VITE_API_URL=https://api.blackhouse.app.br

# Para desenvolvimento local, descomente:
# VITE_API_URL=http://localhost:3001
EOF

echo "✅ .env configurado"

# 3. Procurar e substituir importações do Supabase
echo ""
echo "🔍 Procurando arquivos que usam Supabase..."

# Encontrar arquivos que importam supabase
FILES=$(grep -r "from '@supabase" src/ 2>/dev/null | cut -d: -f1 | sort -u || true)

if [ -z "$FILES" ]; then
    echo "✅ Nenhum arquivo encontrado usando Supabase (pode já estar adaptado)"
else
    echo "📝 Arquivos encontrados que precisam adaptação:"
    echo "$FILES" | while read file; do
        echo "  - $file"
    done
    
    echo ""
    echo "⚠️  Adaptação manual necessária!"
    echo "Siga o guia em: /root/ADAPTACAO_FRONTEND.md"
    echo ""
    echo "Principais mudanças necessárias:"
    echo "  1. Substituir: import { createClient } from '@supabase/supabase-js'"
    echo "     Por: import { apiClient } from './lib/api-client'"
    echo ""
    echo "  2. Substituir: supabase.auth.signUp()"
    echo "     Por: apiClient.signUp()"
    echo ""
    echo "  3. Substituir: supabase.from('tabela')"
    echo "     Por: apiClient.from('tabela')"
    echo ""
    echo "  4. Substituir: supabase.storage"
    echo "     Por: apiClient.uploadFile() e apiClient.getPublicUrl()"
fi

# 4. Verificar se precisa remover dependência do Supabase
if grep -q "@supabase/supabase-js" package.json 2>/dev/null; then
    echo ""
    echo "📦 Dependência @supabase/supabase-js encontrada no package.json"
    echo "⚠️  Após adaptar o código, remova com:"
    echo "   npm uninstall @supabase/supabase-js"
fi

# 5. Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Instalando dependências..."
    npm install
fi

echo ""
echo "=== Adaptação Preparada ==="
echo ""
echo "Próximos passos:"
echo "  1. Revise os arquivos listados acima"
echo "  2. Siga o guia: /root/ADAPTACAO_FRONTEND.md"
echo "  3. Teste localmente: npm run dev"
echo "  4. Build: npm run build"
echo "  5. Deploy: sudo cp -r dist/* /var/www/blackhouse/dist/"
