#!/bin/bash
# Script para clonar e preparar o repositório

set -e

echo "=== Clonar e Preparar Repositório ==="
echo ""

# Verificar se já existe
if [ -d "/root/Black-House" ]; then
    echo "⚠️  Repositório já existe em /root/Black-House"
    read -p "Deseja continuar mesmo assim? (s/N): " CONTINUE
    if [ "$CONTINUE" != "s" ] && [ "$CONTINUE" != "S" ]; then
        exit 0
    fi
fi

echo "📋 Opções para clonar:"
echo "   1. SSH (git@github.com:romuloroldao/Black-House.git)"
echo "   2. HTTPS com token"
echo "   3. Já clonado manualmente"
echo ""
read -p "Escolha uma opção (1-3): " OPCAO

case $OPCAO in
    1)
        echo ""
        echo "Clonando via SSH..."
        cd /root
        git clone git@github.com:romuloroldao/Black-House.git
        ;;
    2)
        echo ""
        read -p "Digite seu token do GitHub: " TOKEN
        cd /root
        git clone https://${TOKEN}@github.com/romuloroldao/Black-House.git
        ;;
    3)
        echo ""
        echo "Pulando clone. Certifique-se de que o repositório está em /root/Black-House"
        ;;
    *)
        echo "Opção inválida"
        exit 1
        ;;
esac

if [ ! -d "/root/Black-House" ]; then
    echo "❌ Repositório não encontrado em /root/Black-House"
    exit 1
fi

echo ""
echo "✅ Repositório encontrado"
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
cd /root/Black-House
if [ ! -d "node_modules" ]; then
    npm install
    echo "✅ Dependências instaladas"
else
    echo "⚠️  Dependências já instaladas"
fi

# Copiar api-client
echo ""
echo "📝 Configurando api-client..."
mkdir -p src/lib
if [ ! -f "src/lib/api-client.ts" ]; then
    cp /root/src/lib/api-client.ts src/lib/api-client.ts
    echo "✅ api-client.ts copiado"
else
    echo "⚠️  api-client.ts já existe"
fi

# Configurar .env
echo ""
echo "⚙️  Configurando variáveis de ambiente..."
if [ ! -f ".env" ]; then
    echo "VITE_API_URL=https://api.blackhouse.app.br" > .env
    echo "✅ .env criado"
else
    echo "⚠️  .env já existe"
    if ! grep -q "VITE_API_URL" .env; then
        echo "VITE_API_URL=https://api.blackhouse.app.br" >> .env
        echo "✅ VITE_API_URL adicionado ao .env"
    fi
fi

echo ""
echo "=== Preparação Concluída! ==="
echo ""
echo "Próximos passos:"
echo "  1. Adaptar código: ./scripts/adaptar-frontend.sh /root/Black-House"
echo "  2. Ou seguir guia: CLONAR_E_ADAPTAR.md"
echo ""
echo "Arquivos que usam Supabase:"
grep -r "@supabase\|supabase\|createClient" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | cut -d: -f1 | sort -u | head -10 || echo "   Nenhum arquivo encontrado (pode já estar adaptado)"
