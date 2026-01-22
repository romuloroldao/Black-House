#!/bin/bash
# Script de instalação completa do sistema

set -e

echo "=== Instalação do BlackHouse ==="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "Por favor, execute como root ou com sudo"
    exit 1
fi

# Instalar Node.js 18+
echo "Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Instalar Nginx
echo "Instalando Nginx..."
apt-get install -y nginx

# Instalar Certbot
echo "Instalando Certbot..."
apt-get install -y certbot python3-certbot-nginx

# Criar diretórios
echo "Criando diretórios..."
mkdir -p /var/www/blackhouse
mkdir -p /var/backups/postgresql
mkdir -p /var/www/blackhouse/server/storage

# Configurar permissões
echo "Configurando permissões..."
chown -R www-data:www-data /var/www/blackhouse
chmod +x /root/scripts/*.sh

# Copiar configuração do Nginx
echo "Configurando Nginx..."
cp /root/deployment/nginx.conf /etc/nginx/sites-available/blackhouse
ln -sf /etc/nginx/sites-available/blackhouse /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração do Nginx
nginx -t

# Copiar serviço systemd
echo "Configurando serviço systemd..."
cp /root/deployment/blackhouse-api.service /etc/systemd/system/
systemctl daemon-reload

echo ""
echo "=== Instalação concluída! ==="
echo ""
echo "Próximos passos:"
echo "1. Configure o PostgreSQL: ./scripts/setup-postgres.sh"
echo "2. Execute a migração do banco"
echo "3. Configure server/.env"
echo "4. Configure .env do frontend"
echo "5. Faça o build: npm run build"
echo "6. Copie os arquivos para /var/www/blackhouse"
echo "7. Inicie o serviço: systemctl start blackhouse-api"
echo "8. Configure SSL: certbot --nginx -d seudominio.com"
