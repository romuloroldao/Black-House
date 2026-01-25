#!/bin/bash
# Script de Deploy - Correções de Segurança e Componentes Críticos
# Data: 12 de Janeiro de 2026

set -e

echo "🚀 Iniciando deploy de segurança e componentes críticos..."

PROD_DIR="/var/www/blackhouse/server"
DEV_DIR="/root/server"
BACKUP_DIR="/var/backups/blackhouse/deploy"

# Criar backup antes do deploy
echo "📦 Criando backup..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" -C "$PROD_DIR" . 2>/dev/null || echo "⚠️ Backup parcial (alguns arquivos podem não existir)"
echo "✅ Backup criado: $BACKUP_FILE"

# 1. Copiar novos arquivos e diretórios
echo "📁 Copiando arquivos..."

# Criar diretórios se não existirem
sudo mkdir -p "$PROD_DIR/services"
sudo mkdir -p "$PROD_DIR/middleware"
sudo mkdir -p "$PROD_DIR/jobs"
sudo mkdir -p "$PROD_DIR/routes"
sudo mkdir -p "$PROD_DIR/utils"
sudo mkdir -p "$PROD_DIR/controllers"
sudo mkdir -p "$PROD_DIR/repositories"
sudo mkdir -p "$PROD_DIR/migrations"
sudo mkdir -p "$PROD_DIR/scripts"

# Copiar arquivos (preservando permissões)
echo "  - Copiando services..."
sudo cp -r "$DEV_DIR/services/"* "$PROD_DIR/services/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando middleware..."
sudo cp -r "$DEV_DIR/middleware/"* "$PROD_DIR/middleware/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando jobs..."
sudo cp -r "$DEV_DIR/jobs/"* "$PROD_DIR/jobs/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando routes..."
sudo cp -r "$DEV_DIR/routes/"* "$PROD_DIR/routes/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando utils..."
sudo cp -r "$DEV_DIR/utils/"* "$PROD_DIR/utils/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando controllers..."
sudo cp -r "$DEV_DIR/controllers/"* "$PROD_DIR/controllers/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando repositories..."
sudo cp -r "$DEV_DIR/repositories/"* "$PROD_DIR/repositories/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando migrations..."
sudo cp -r "$DEV_DIR/migrations/"* "$PROD_DIR/migrations/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando scripts..."
sudo cp -r "$DEV_DIR/scripts/"* "$PROD_DIR/scripts/" 2>/dev/null || echo "    ⚠️ Alguns arquivos podem não existir"

echo "  - Copiando index.js e package.json..."
sudo cp "$DEV_DIR/index.js" "$PROD_DIR/index.js"
sudo cp "$DEV_DIR/package.json" "$PROD_DIR/package.json"

# Ajustar permissões
echo "🔐 Ajustando permissões..."
sudo chown -R www-data:www-data "$PROD_DIR"
sudo chmod +x "$PROD_DIR/scripts/"*.sh 2>/dev/null || true

# 2. Instalar dependências
echo "📦 Instalando dependências..."
cd "$PROD_DIR"
sudo -u www-data npm install express-rate-limit winston socket.io node-cron axios

# 3. Executar migrações SQL
echo "🗄️ Executando migrações SQL..."
if [ -f "$PROD_DIR/migrations/add_websocket_and_webhooks.sql" ]; then
    sudo -u postgres psql -d blackhouse_db -f "$PROD_DIR/migrations/add_websocket_and_webhooks.sql" || {
        echo "⚠️ Erro ao executar migração. Verifique manualmente."
        echo "   Comando: sudo -u postgres psql -d blackhouse_db -f $PROD_DIR/migrations/add_websocket_and_webhooks.sql"
    }
else
    echo "⚠️ Arquivo de migração não encontrado. Execute manualmente:"
    echo "   sudo -u postgres psql -d blackhouse_db -f $PROD_DIR/migrations/add_websocket_and_webhooks.sql"
fi

# 4. Criar diretórios necessários
echo "📁 Criando diretórios..."
sudo mkdir -p /var/log/blackhouse-api
sudo mkdir -p /var/backups/blackhouse/db
sudo chown -R www-data:www-data /var/log/blackhouse-api
sudo chown -R www-data:www-data /var/backups/blackhouse

# 5. Configurar logrotate (se não existir)
if [ ! -f /etc/logrotate.d/blackhouse-api ]; then
    echo "📝 Configurando logrotate..."
    sudo tee /etc/logrotate.d/blackhouse-api > /dev/null <<EOF
/var/log/blackhouse-api/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload blackhouse-api > /dev/null 2>&1 || true
    endscript
}
EOF
    echo "✅ Logrotate configurado"
else
    echo "ℹ️ Logrotate já configurado"
fi

# 6. Validar configuração
echo "✅ Validando configuração..."
if [ ! -f "$PROD_DIR/.env" ]; then
    echo "❌ ERRO: Arquivo .env não encontrado em $PROD_DIR"
    exit 1
fi

# Verificar se JWT_SECRET está configurado
if ! grep -q "JWT_SECRET=" "$PROD_DIR/.env" || grep -q "JWT_SECRET=change_this" "$PROD_DIR/.env"; then
    echo "⚠️ AVISO: JWT_SECRET pode estar com valor padrão. Configure antes de produção!"
fi

# 7. Testar sintaxe do Node.js
echo "🔍 Validando sintaxe..."
cd "$PROD_DIR"
sudo -u www-data node -c index.js || {
    echo "❌ ERRO: Sintaxe inválida no index.js"
    exit 1
}

# 8. Reiniciar serviço
echo "🔄 Reiniciando serviço..."
sudo systemctl restart blackhouse-api

# Aguardar alguns segundos
sleep 3

# Verificar status
if sudo systemctl is-active --quiet blackhouse-api; then
    echo "✅ Serviço reiniciado com sucesso"
else
    echo "❌ ERRO: Serviço não está rodando. Verifique logs:"
    echo "   sudo journalctl -u blackhouse-api -n 50"
    exit 1
fi

# 9. Verificar logs recentes
echo "📊 Verificando logs recentes..."
sudo journalctl -u blackhouse-api --since "10 seconds ago" --no-pager | tail -10

echo ""
echo "✅ Deploy concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Verificar logs: sudo journalctl -u blackhouse-api -f"
echo "   2. Testar health check: curl http://localhost:3001/health"
echo "   3. Verificar se WebSocket está funcionando"
echo "   4. Configurar backup no crontab (se ainda não configurado)"
echo ""
