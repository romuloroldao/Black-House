#!/bin/bash
# Script para build e deploy do frontend

set -e

PROJECT_DIR="${1:-/root/Black-House}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "⚠️  Diretório do projeto não encontrado: $PROJECT_DIR"
    exit 1
fi

echo "=== Build e Deploy do Frontend ==="
echo ""

cd "$PROJECT_DIR"

# 1. Verificar se .env está configurado
if [ ! -f ".env" ] || ! grep -q "VITE_API_URL" .env; then
    echo "⚠️  .env não configurado. Configurando..."
    echo "VITE_API_URL=https://api.blackhouse.app.br" > .env
fi

# 2. Instalar dependências
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# 3. Build
echo ""
echo "🔨 Fazendo build de produção..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Erro: Diretório dist não foi criado!"
    exit 1
fi

# 4. Backup do dist anterior (se existir)
if [ -d "/var/www/blackhouse/dist" ] && [ "$(ls -A /var/www/blackhouse/dist)" ]; then
    echo ""
    echo "💾 Fazendo backup do dist anterior..."
    sudo mv /var/www/blackhouse/dist /var/www/blackhouse/dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# 5. Copiar para diretório do Nginx
echo ""
echo "📤 Copiando arquivos para /var/www/blackhouse/dist..."
sudo mkdir -p /var/www/blackhouse/dist
sudo cp -r dist/* /var/www/blackhouse/dist/
sudo chown -R www-data:www-data /var/www/blackhouse/dist
sudo chmod -R 755 /var/www/blackhouse/dist

# 6. Verificar
echo ""
echo "✅ Verificando arquivos..."
FILE_COUNT=$(find /var/www/blackhouse/dist -type f | wc -l)
echo "   Arquivos copiados: $FILE_COUNT"

if [ -f "/var/www/blackhouse/dist/index.html" ]; then
    echo "   ✅ index.html encontrado"
else
    echo "   ⚠️  index.html não encontrado!"
fi

# 7. Recarregar Nginx
echo ""
echo "🔄 Recarregando Nginx..."
sudo systemctl reload nginx

echo ""
echo "=== Deploy Concluído! ==="
echo ""
echo "🌐 Frontend disponível em:"
echo "   http://blackhouse.app.br (aguardar DNS propagar)"
echo "   http://www.blackhouse.app.br"
echo ""
echo "📋 Para verificar:"
echo "   curl -I http://blackhouse.app.br"
echo "   sudo tail -f /var/log/nginx/blackhouse-error.log"
