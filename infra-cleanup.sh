#!/bin/bash
# Script de Limpeza Total de Cache e Runtime
# Fase Infra - Garantir que código atualizado seja executado

set -e

echo "🔥 INFRA-01: Parando TODOS os processos Node..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true
pkill -f "npm" 2>/dev/null || true
sleep 2

echo "✅ Verificando processos Node restantes..."
NODE_PROCS=$(ps aux | grep -E "node.*index.js|pm2" | grep -v grep | grep -v cursor-server || true)
if [ -z "$NODE_PROCS" ]; then
    echo "✅ Nenhum processo Node da aplicação encontrado"
else
    echo "⚠️ Processos ainda rodando:"
    echo "$NODE_PROCS"
    echo "🔨 Forçando kill..."
    pkill -9 -f "node.*index.js" 2>/dev/null || true
    sleep 1
fi

echo ""
echo "🔥 INFRA-02: Limpando cache interno do PM2..."
pm2 flush 2>/dev/null || true
rm -rf ~/.pm2/logs/* 2>/dev/null || true
rm -rf ~/.pm2/pids/* 2>/dev/null || true
rm -rf ~/.pm2/modules/* 2>/dev/null || true
echo "✅ Cache do PM2 limpo"

echo ""
echo "🔥 INFRA-04: Verificando localização do código..."
cd /root
echo "Current directory: $(pwd)"
echo "Server index.js exists: $([ -f server/index.js ] && echo 'YES' || echo 'NO')"
echo "Server index.js path: $(realpath server/index.js 2>/dev/null || echo 'NOT FOUND')"

echo ""
echo "✅ Limpeza completa concluída!"
echo ""
echo "Próximos passos:"
echo "1. Verificar BOOT_ID no server/index.js"
echo "2. Executar: pm2 start server/index.js --name blackhouse-api"
echo "3. Executar: pm2 save"
