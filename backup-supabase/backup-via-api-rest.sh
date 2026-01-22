#!/bin/bash
# Script para fazer backup parcial via API REST do Supabase
# ⚠️ LIMITAÇÕES: Só exporta DADOS, não estrutura (schema)

set -e

BACKUP_DIR="/root/backup-supabase"
NODE_SCRIPT="$BACKUP_DIR/backup-via-api-rest.js"

echo "=========================================="
echo "  BACKUP PARCIAL VIA API REST"
echo "=========================================="
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ ERRO: Node.js não encontrado!"
    echo "Instale Node.js: sudo apt install nodejs npm"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"
echo ""

# Verificar se SUPABASE_KEY está configurada
if [ -z "$SUPABASE_KEY" ]; then
    echo "⚠️  AVISO: SUPABASE_KEY não configurada!"
    echo ""
    echo "Para usar este script, configure a variável:"
    echo "  export SUPABASE_KEY='sua-chave-aqui'"
    echo ""
    echo "Ou adicione no script backup-via-api-rest.js diretamente"
    echo ""
    echo "💡 Para obter a chave:"
    echo "   1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq"
    echo "   2. Vá em Settings → API"
    echo "   3. Copie 'anon key' ou 'service_role key' (use service_role para acesso completo)"
    echo ""
    exit 1
fi

# Executar script Node.js
echo "🚀 Executando backup via API REST..."
echo ""

node "$NODE_SCRIPT"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Script executado com sucesso!"
    echo ""
    echo "📄 Arquivos de backup:"
    ls -lh "$BACKUP_DIR"/backup_dados_api_*.json 2>/dev/null | tail -5 || echo "Nenhum arquivo encontrado"
else
    echo ""
    echo "❌ Erro ao executar script!"
    exit 1
fi
