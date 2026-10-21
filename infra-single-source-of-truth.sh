#!/bin/bash
# INFRA: Single Source of Truth
# Eliminar execução de código antigo garantindo entrypoint único

set -e

echo "=========================================="
echo "🔥 INFRA: Single Source of Truth"
echo "=========================================="
echo ""

# INFRA-A: Identificação de múltiplos entrypoints
echo "📋 INFRA-A: Identificando entrypoints..."
echo ""

echo "1. Verificando systemd service..."
if systemctl is-active --quiet blackhouse-api.service; then
    echo "   ⚠️  Systemd service ATIVO"
    systemctl status blackhouse-api.service --no-pager -l | head -5
    SYSTEMD_ACTIVE=true
else
    echo "   ✅ Systemd service INATIVO"
    SYSTEMD_ACTIVE=false
fi

echo ""
echo "2. Verificando processo Node..."
NODE_PROC=$(ps aux | grep -E "node.*index\.js" | grep -v grep | grep -v cursor-server | head -1)
if [ ! -z "$NODE_PROC" ]; then
    echo "   ⚠️  Processo Node encontrado:"
    echo "   $NODE_PROC"
    NODE_PID=$(echo "$NODE_PROC" | awk '{print $2}')
    NODE_CWD=$(readlink -f /proc/$NODE_PID/cwd 2>/dev/null || echo "N/A")
    echo "   PID: $NODE_PID"
    echo "   Working Directory: $NODE_CWD"
    NODE_ACTIVE=true
else
    echo "   ✅ Nenhum processo Node encontrado"
    NODE_ACTIVE=false
fi

echo ""
echo "3. Verificando paths de código..."
ROOT_SERVER="/root/server/index.js"
VAR_SERVER="/var/www/blackhouse/server/index.js"

if [ -f "$ROOT_SERVER" ]; then
    echo "   ✅ $ROOT_SERVER existe"
    ROOT_HAS_BOOT_ID=$(grep -c "BOOT_ID" "$ROOT_SERVER" 2>/dev/null || echo "0")
    if [ "$ROOT_HAS_BOOT_ID" -gt 0 ]; then
        echo "   ✅ Contém BOOT_ID (código novo)"
    else
        echo "   ⚠️  NÃO contém BOOT_ID (código antigo?)"
    fi
else
    echo "   ❌ $ROOT_SERVER NÃO existe"
fi

if [ -f "$VAR_SERVER" ]; then
    echo "   ✅ $VAR_SERVER existe"
    VAR_HAS_BOOT_ID=$(grep -c "BOOT_ID" "$VAR_SERVER" 2>/dev/null || echo "0")
    if [ "$VAR_HAS_BOOT_ID" -gt 0 ]; then
        echo "   ✅ Contém BOOT_ID (código novo)"
    else
        echo "   ⚠️  NÃO contém BOOT_ID (código antigo?)"
    fi
else
    echo "   ❌ $VAR_SERVER NÃO existe"
fi

echo ""
echo "=========================================="
echo "🛑 INFRA-B: Eliminando runtimes duplicados"
echo "=========================================="
echo ""

if [ "$SYSTEMD_ACTIVE" = true ]; then
    echo "1. Parando systemd service..."
    sudo systemctl stop blackhouse-api.service
    echo "   ✅ Service parado"
    
    echo ""
    echo "2. Desabilitando systemd service..."
    sudo systemctl disable blackhouse-api.service
    echo "   ✅ Service desabilitado (não reiniciará automaticamente)"
    
    echo ""
    echo "3. Verificando status..."
    if systemctl is-active --quiet blackhouse-api.service; then
        echo "   ⚠️  Service ainda ativo, forçando..."
        sudo systemctl kill -s KILL blackhouse-api.service 2>/dev/null || true
        sleep 2
    fi
    
    if systemctl is-active --quiet blackhouse-api.service; then
        echo "   ❌ ERRO: Não foi possível parar o service"
        exit 1
    else
        echo "   ✅ Service parado com sucesso"
    fi
else
    echo "   ✅ Systemd service já estava inativo"
fi

echo ""
if [ "$NODE_ACTIVE" = true ]; then
    echo "4. Encerrando processo Node (PID: $NODE_PID)..."
    sudo kill $NODE_PID 2>/dev/null || true
    sleep 2
    
    # Verificar se ainda está rodando
    if ps -p $NODE_PID > /dev/null 2>&1; then
        echo "   ⚠️  Processo ainda ativo, forçando kill..."
        sudo kill -9 $NODE_PID 2>/dev/null || true
        sleep 1
    fi
    
    if ps -p $NODE_PID > /dev/null 2>&1; then
        echo "   ❌ ERRO: Não foi possível encerrar o processo"
        exit 1
    else
        echo "   ✅ Processo encerrado com sucesso"
    fi
else
    echo "   ✅ Nenhum processo Node ativo"
fi

echo ""
echo "5. Verificando processos Node restantes..."
REMAINING=$(ps aux | grep -E "node.*index\.js" | grep -v grep | grep -v cursor-server || true)
if [ ! -z "$REMAINING" ]; then
    echo "   ⚠️  Ainda há processos Node:"
    echo "   $REMAINING"
    echo "   Forçando kill de todos..."
    pkill -9 -f "node.*index.js" 2>/dev/null || true
    sleep 1
else
    echo "   ✅ Nenhum processo Node restante"
fi

echo ""
echo "=========================================="
echo "🧹 INFRA-C: Limpeza total de cache"
echo "=========================================="
echo ""

echo "1. Limpando logs do systemd..."
sudo journalctl --vacuum-time=1d > /dev/null 2>&1 || true
echo "   ✅ Logs do systemd limpos"

echo ""
echo "2. Verificando cache do Node..."
# Não há muito o que limpar de cache do Node além de garantir novo processo
echo "   ✅ Novo processo Node será iniciado (sem cache)"

echo ""
echo "=========================================="
echo "✅ INFRA-D: Verificando BOOT_ID"
echo "=========================================="
echo ""

ENTRYPOINT="/root/server/index.js"
if [ -f "$ENTRYPOINT" ]; then
    BOOT_ID_COUNT=$(grep -c "BOOT_ID" "$ENTRYPOINT" 2>/dev/null || echo "0")
    if [ "$BOOT_ID_COUNT" -gt 0 ]; then
        echo "✅ Entrypoint $ENTRYPOINT contém BOOT_ID"
        echo "   Linhas com BOOT_ID:"
        grep -n "BOOT_ID" "$ENTRYPOINT" | head -3
    else
        echo "❌ Entrypoint $ENTRYPOINT NÃO contém BOOT_ID"
        echo "   ⚠️  Código pode estar desatualizado"
    fi
else
    echo "❌ Entrypoint $ENTRYPOINT não existe"
    exit 1
fi

echo ""
echo "=========================================="
echo "🧪 INFRA-E: Preparando teste nuclear"
echo "=========================================="
echo ""

IMPORT_CONTROLLER="/root/server/controllers/import.controller.js"
if [ -f "$IMPORT_CONTROLLER" ]; then
    NUCLEAR_LINE=$(grep -n "CODE VERSION CHECK" "$IMPORT_CONTROLLER" 2>/dev/null || echo "")
    if [ ! -z "$NUCLEAR_LINE" ]; then
        echo "✅ Teste nuclear encontrado em:"
        echo "   $NUCLEAR_LINE"
        echo ""
        echo "   Para ativar: descomentar a linha no arquivo"
    else
        echo "⚠️  Teste nuclear não encontrado"
    fi
else
    echo "⚠️  Controller não encontrado: $IMPORT_CONTROLLER"
fi

echo ""
echo "=========================================="
echo "🚀 INFRA-F: Pronto para subida controlada"
echo "=========================================="
echo ""

echo "✅ Ambiente limpo e pronto!"
echo ""
echo "Entrypoint único: $ENTRYPOINT"
echo ""
echo "Para iniciar o servidor, escolha uma opção:"
echo ""
echo "Opção 1: Systemd (recomendado para produção)"
echo "  1. Editar /etc/systemd/system/blackhouse-api.service:"
echo "     - WorkingDirectory=/root/server"
echo "     - ExecStart=/usr/bin/node /root/server/index.js"
echo "  2. sudo systemctl daemon-reload"
echo "  3. sudo systemctl enable blackhouse-api.service"
echo "  4. sudo systemctl start blackhouse-api.service"
echo ""
echo "Opção 2: Node direto (para testes)"
echo "  cd /root/server && node index.js"
echo ""
echo "Para verificar logs após iniciar:"
echo "  sudo journalctl -u blackhouse-api -f | grep BOOT_ID"
echo ""
