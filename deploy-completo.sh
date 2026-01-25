#!/bin/bash
# Script de deploy completo do BlackHouse
# Execute após configurar DNS no Registro.br

set -e

echo "=== Deploy Completo BlackHouse ==="
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "Por favor, execute com sudo"
    exit 1
fi

# 1. Configurar Nginx
echo "1. Configurando Nginx..."
cp /root/deployment/nginx-blackhouse.conf /etc/nginx/sites-available/blackhouse
ln -sf /etc/nginx/sites-available/blackhouse /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
echo "Testando configuração do Nginx..."
nginx -t

# Recarregar Nginx
systemctl reload nginx
echo "✅ Nginx configurado"

# 2. Verificar DNS antes de SSL
echo ""
echo "2. Verificando DNS..."
echo "Aguardando 10 segundos para verificar propagação..."
sleep 10

DOMAIN_OK=true
for domain in blackhouse.app.br www.blackhouse.app.br api.blackhouse.app.br; do
    IP=$(dig +short $domain | head -1)
    if [ "$IP" = "177.153.64.95" ]; then
        echo "✅ $domain → $IP"
    else
        echo "⚠️  $domain → $IP (esperado: 177.153.64.95)"
        DOMAIN_OK=false
    fi
done

if [ "$DOMAIN_OK" = false ]; then
    echo ""
    echo "⚠️  ATENÇÃO: DNS ainda não propagou completamente!"
    echo "Aguarde mais alguns minutos e verifique novamente."
    echo "Execute: dig blackhouse.app.br +short"
    echo ""
    read -p "Deseja continuar mesmo assim? (s/N): " CONTINUE
    if [ "$CONTINUE" != "s" ] && [ "$CONTINUE" != "S" ]; then
        echo "Deploy cancelado. Configure DNS primeiro."
        exit 1
    fi
fi

# 3. Configurar SSL
echo ""
echo "3. Configurando SSL com Let's Encrypt..."
echo "Isso pode levar alguns minutos..."

certbot --nginx \
    -d blackhouse.app.br \
    -d www.blackhouse.app.br \
    -d api.blackhouse.app.br \
    --non-interactive \
    --agree-tos \
    --email admin@blackhouse.app.br \
    --redirect

echo "✅ SSL configurado"

# 4. Configurar API
echo ""
echo "4. Configurando API..."
if [ ! -f /var/www/blackhouse/server/.env ]; then
    echo "⚠️  Arquivo .env não encontrado em /var/www/blackhouse/server/"
    echo "Copiando de /root/server/.env..."
    cp /root/server/.env /var/www/blackhouse/server/.env
    echo "⚠️  IMPORTANTE: Edite /var/www/blackhouse/server/.env com credenciais de produção!"
fi

# Ajustar permissões
chown -R www-data:www-data /var/www/blackhouse
chmod -R 755 /var/www/blackhouse

# 5. Iniciar serviços
echo ""
echo "5. Iniciando serviços..."

# Habilitar e iniciar API
systemctl enable blackhouse-api
systemctl restart blackhouse-api

# Verificar status
echo ""
echo "Status dos serviços:"
systemctl is-active blackhouse-api && echo "✅ API: Ativa" || echo "❌ API: Inativa"
systemctl is-active nginx && echo "✅ Nginx: Ativo" || echo "❌ Nginx: Inativo"
systemctl is-active postgresql && echo "✅ PostgreSQL: Ativo" || echo "❌ PostgreSQL: Inativo"

# 6. Testar endpoints
echo ""
echo "6. Testando endpoints..."
sleep 2

echo "Testando API..."
API_HEALTH=$(curl -s https://api.blackhouse.app.br/health || echo "erro")
if echo "$API_HEALTH" | grep -q "ok"; then
    echo "✅ API respondendo"
else
    echo "⚠️  API não está respondendo. Verifique logs: sudo journalctl -u blackhouse-api -n 50"
fi

# 7. Configurar backup automático
echo ""
echo "7. Configurando backup automático..."
if ! crontab -l 2>/dev/null | grep -q "backup-db.sh"; then
    (crontab -l 2>/dev/null; echo "0 2 * * * DB_PASSWORD=\$(grep DB_PASSWORD /var/www/blackhouse/server/.env | cut -d '=' -f2) /usr/local/bin/backup-db.sh >> /var/log/backup-db.log 2>&1") | crontab -
    echo "✅ Backup automático configurado (diário às 2h)"
else
    echo "✅ Backup automático já configurado"
fi

# 8. Resumo final
echo ""
echo "=== Deploy Concluído ==="
echo ""
echo "🌐 Domínios:"
echo "   Frontend: https://blackhouse.app.br"
echo "   Frontend: https://www.blackhouse.app.br"
echo "   API:      https://api.blackhouse.app.br"
echo ""
echo "📋 Próximos passos:"
echo "   1. Verificar se o frontend foi buildado e copiado para /var/www/blackhouse/dist"
echo "   2. Testar acesso aos domínios"
echo "   3. Verificar logs se houver problemas:"
echo "      - API: sudo journalctl -u blackhouse-api -f"
echo "      - Nginx: sudo tail -f /var/log/nginx/blackhouse-error.log"
echo ""
echo "🔐 Segurança:"
echo "   - Altere as senhas em /var/www/blackhouse/server/.env"
echo "   - Configure firewall se necessário"
echo ""
echo "✅ Deploy finalizado!"
