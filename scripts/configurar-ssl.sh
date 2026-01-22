#!/bin/bash
# Script para configurar SSL após DNS propagar

set -e

if [ "$EUID" -ne 0 ]; then 
    echo "Por favor, execute com sudo"
    exit 1
fi

echo "=== Configuração SSL ==="
echo ""

# Verificar DNS antes de continuar
echo "1. Verificando DNS..."
DOMAIN_OK=true

for domain in blackhouse.app.br www.blackhouse.app.br api.blackhouse.app.br; do
    IP=$(dig +short $domain | head -1)
    if [ "$IP" = "177.153.64.95" ]; then
        echo "   ✅ $domain → $IP"
    else
        echo "   ❌ $domain → $IP (esperado: 177.153.64.95)"
        DOMAIN_OK=false
    fi
done

if [ "$DOMAIN_OK" = false ]; then
    echo ""
    echo "⚠️  ATENÇÃO: DNS ainda não propagou completamente!"
    echo "Aguarde mais alguns minutos e verifique novamente."
    echo ""
    read -p "Deseja continuar mesmo assim? (s/N): " CONTINUE
    if [ "$CONTINUE" != "s" ] && [ "$CONTINUE" != "S" ]; then
        echo "Cancelado. Configure DNS primeiro."
        exit 1
    fi
fi

# Solicitar email
read -p "2. Digite seu email para o Let's Encrypt: " EMAIL

if [ -z "$EMAIL" ]; then
    echo "❌ Email é obrigatório"
    exit 1
fi

# Configurar SSL
echo ""
echo "3. Configurando SSL com Let's Encrypt..."
echo "Isso pode levar alguns minutos..."

certbot --nginx \
    -d blackhouse.app.br \
    -d www.blackhouse.app.br \
    -d api.blackhouse.app.br \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL configurado com sucesso!"
    echo ""
    echo "🌐 Domínios com SSL:"
    echo "   https://blackhouse.app.br"
    echo "   https://www.blackhouse.app.br"
    echo "   https://api.blackhouse.app.br"
    echo ""
    echo "📋 Renovação automática configurada"
    echo "   O Certbot renovará automaticamente antes de expirar"
else
    echo ""
    echo "❌ Erro ao configurar SSL"
    echo "Verifique os logs: sudo tail -f /var/log/letsencrypt/letsencrypt.log"
    exit 1
fi
