#!/bin/bash
# Script para executar tarefas que não precisam do banco de dados

set -e

echo "=== Executando Tarefas Sem Banco de Dados ==="
echo ""

# 1. Clonar repositório
echo "1. Clonando repositório..."
if [ ! -d "/root/Black-House" ]; then
    cd /root
    git clone https://github.com/romuloroldao/Black-House.git
    echo "   ✅ Repositório clonado"
else
    echo "   ⚠️  Repositório já existe"
fi

# 2. Instalar dependências
echo ""
echo "2. Instalando dependências..."
cd /root/Black-House
if [ ! -d "node_modules" ]; then
    npm install
    echo "   ✅ Dependências instaladas"
else
    echo "   ⚠️  Dependências já instaladas"
fi

# 3. Copiar api-client
echo ""
echo "3. Configurando api-client..."
mkdir -p src/lib
if [ ! -f "src/lib/api-client.ts" ]; then
    cp /root/src/lib/api-client.ts src/lib/api-client.ts
    echo "   ✅ api-client.ts copiado"
else
    echo "   ⚠️  api-client.ts já existe"
fi

# 4. Configurar .env
echo ""
echo "4. Configurando variáveis de ambiente..."
if [ ! -f ".env" ]; then
    echo "VITE_API_URL=https://api.blackhouse.app.br" > .env
    echo "   ✅ .env criado"
else
    echo "   ⚠️  .env já existe"
fi

# 5. Gerar credenciais
echo ""
echo "5. Gerando credenciais seguras..."
NOVA_SENHA_DB=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -hex 32)

echo "   Nova senha DB: $NOVA_SENHA_DB"
echo "   JWT Secret: $JWT_SECRET"
echo ""
echo "   ⚠️  IMPORTANTE: Atualize /var/www/blackhouse/server/.env com essas credenciais"

# 6. Configurar backup automático
echo ""
echo "6. Configurando backup automático..."
if ! crontab -l 2>/dev/null | grep -q "backup-db.sh"; then
    (crontab -l 2>/dev/null; echo "0 2 * * * DB_PASSWORD=\$(grep DB_PASSWORD /var/www/blackhouse/server/.env | cut -d '=' -f2) /usr/local/bin/backup-db.sh >> /var/log/backup-db.log 2>&1") | crontab -
    echo "   ✅ Backup automático configurado (diário às 2h)"
else
    echo "   ⚠️  Backup automático já configurado"
fi

# 7. Preparar estrutura
echo ""
echo "7. Preparando estrutura de deploy..."
sudo mkdir -p /var/www/blackhouse/{dist,server/storage/{progress-photos,avatars}}
sudo chown -R www-data:www-data /var/www/blackhouse
sudo chmod -R 755 /var/www/blackhouse
sudo chmod -R 775 /var/www/blackhouse/server/storage
echo "   ✅ Estrutura preparada"

echo ""
echo "=== Tarefas Concluídas! ==="
echo ""
echo "Próximos passos:"
echo "  1. Adaptar código frontend (substituir Supabase)"
echo "  2. Atualizar credenciais em /var/www/blackhouse/server/.env"
echo "  3. Fazer build: npm run build"
echo "  4. Copiar build: sudo cp -r dist/* /var/www/blackhouse/dist/"
