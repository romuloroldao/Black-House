#!/bin/bash
# Script para configurar Personal Access Token do GitHub de forma segura
# DESIGN: Configuração segura de autenticação Git para push

set -e

echo "🔐 Configuração de Token GitHub para Push"
echo "=========================================="
echo ""

# Verificar se o token foi fornecido como argumento
if [ -z "$1" ]; then
    echo "❌ Erro: Token não fornecido"
    echo ""
    echo "Uso: $0 SEU_TOKEN_AQUI"
    echo ""
    echo "Exemplo:"
    echo "  $0 ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo ""
    echo "Para criar um token:"
    echo "  1. Acesse: https://github.com/settings/tokens"
    echo "  2. Generate new token (classic)"
    echo "  3. Marque apenas 'repo'"
    echo "  4. Copie o token e use neste script"
    exit 1
fi

TOKEN="$1"
REMOTE_URL="https://${TOKEN}@github.com/romuloroldao/Black-House.git"

echo "📝 Configurando remote 'BlackHouse' com token..."
git remote set-url BlackHouse "$REMOTE_URL"

echo "✅ Remote configurado!"
echo ""
echo "🧪 Testando conexão..."
if git ls-remote BlackHouse > /dev/null 2>&1; then
    echo "✅ Conexão com GitHub OK!"
    echo ""
    echo "📤 Fazendo push da branch atual..."
    CURRENT_BRANCH=$(git branch --show-current)
    echo "   Branch: $CURRENT_BRANCH"
    
    if git push BlackHouse "$CURRENT_BRANCH" 2>&1; then
        echo ""
        echo "✅ Push realizado com sucesso!"
        echo ""
        echo "🔒 Segurança: O token está no remote URL."
        echo "   Para remover: git remote set-url BlackHouse https://github.com/romuloroldao/Black-House.git"
    else
        echo ""
        echo "❌ Erro ao fazer push. Verifique o token e as permissões."
        exit 1
    fi
else
    echo "❌ Erro: Não foi possível conectar ao GitHub."
    echo "   Verifique se o token está correto e tem permissão 'repo'."
    exit 1
fi
