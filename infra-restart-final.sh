#!/bin/bash
# Restart Final Controlado
# INFRA-09: Restart do servidor de forma controlada

set -e

echo "🔥 INFRA-09: Restart final controlado..."
cd /root

echo ""
echo "1. Parando processos existentes..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true
sleep 2

echo ""
echo "2. Verificando que não há processos Node da aplicação..."
NODE_PROCS=$(ps aux | grep -E "node.*index.js" | grep -v grep | grep -v cursor-server || true)
if [ ! -z "$NODE_PROCS" ]; then
    echo "⚠️ Ainda há processos rodando, forçando kill..."
    pkill -9 -f "node.*index.js" 2>/dev/null || true
    sleep 1
fi

echo ""
echo "3. Verificando arquivo de entrada..."
if [ ! -f "server/index.js" ]; then
    echo "❌ ERRO: server/index.js não encontrado!"
    exit 1
fi
echo "✅ server/index.js encontrado: $(realpath server/index.js)"

echo ""
echo "4. Iniciando com PM2..."
pm2 start server/index.js --name blackhouse-api --log-date-format "YYYY-MM-DD HH:mm:ss Z"
pm2 save

echo ""
echo "5. Verificando status..."
sleep 2
pm2 status

echo ""
echo "6. Verificando logs iniciais..."
pm2 logs blackhouse-api --lines 20 --nostream

echo ""
echo "7. Verificando processo..."
ps aux | grep -E "node.*index.js" | grep -v grep | grep -v cursor-server || echo "⚠️ Nenhum processo encontrado (pode estar iniciando)"

echo ""
echo "✅ Restart concluído!"
echo ""
echo "Para monitorar logs:"
echo "  pm2 logs blackhouse-api -f"
echo ""
echo "Para verificar status:"
echo "  pm2 status"
echo ""
echo "Para verificar BOOT_ID nos logs:"
echo "  pm2 logs blackhouse-api --lines 50 | grep BOOT_ID"
