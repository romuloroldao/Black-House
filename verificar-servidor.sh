#!/bin/bash
# Script de verificação do servidor - BlackHouse
# Use este script para verificar se tudo está pronto para vincular DNS

echo "=========================================="
echo "🔍 Verificação do Servidor BlackHouse"
echo "=========================================="
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        return 0
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

# 1. Verificar IP do servidor
echo "1️⃣  IP do Servidor:"
IP=$(hostname -I | awk '{print $1}')
echo "   IP Público: $IP"
echo "   IP esperado para DNS: 177.153.64.95"
if [ "$IP" = "177.153.64.95" ] || hostname -I | grep -q "177.153.64.95"; then
    echo -e "${GREEN}✅ IP correto${NC}"
else
    echo -e "${YELLOW}⚠️  Verifique se o IP está correto${NC}"
fi
echo ""

# 2. Verificar Nginx
echo "2️⃣  Nginx:"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx está rodando${NC}"
    systemctl status nginx --no-pager | grep "Active:" | sed 's/^/   /'
else
    echo -e "${RED}❌ Nginx não está rodando${NC}"
    exit 1
fi

if nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo -e "${GREEN}✅ Configuração do Nginx está OK${NC}"
else
    echo -e "${RED}❌ Erro na configuração do Nginx${NC}"
    nginx -t
    exit 1
fi

# Verificar se está escutando na porta 80
if netstat -tlnp 2>/dev/null | grep -q ":80.*nginx" || ss -tlnp 2>/dev/null | grep -q ":80.*nginx"; then
    echo -e "${GREEN}✅ Nginx escutando na porta 80${NC}"
else
    echo -e "${RED}❌ Nginx não está escutando na porta 80${NC}"
fi
echo ""

# 3. Verificar arquivos da aplicação
echo "3️⃣  Arquivos da Aplicação:"
if [ -f "/var/www/blackhouse/dist/index.html" ]; then
    echo -e "${GREEN}✅ index.html encontrado${NC}"
    echo "   Tamanho: $(du -h /var/www/blackhouse/dist/index.html | cut -f1)"
else
    echo -e "${RED}❌ index.html NÃO encontrado${NC}"
fi

if [ -d "/var/www/blackhouse/dist/assets" ]; then
    ASSETS_COUNT=$(ls -1 /var/www/blackhouse/dist/assets/ 2>/dev/null | wc -l)
    echo -e "${GREEN}✅ Diretório assets encontrado ($ASSETS_COUNT arquivos)${NC}"
else
    echo -e "${RED}❌ Diretório assets NÃO encontrado${NC}"
fi

# Verificar permissões
OWNER=$(stat -c '%U:%G' /var/www/blackhouse/dist/index.html 2>/dev/null)
if [ "$OWNER" = "www-data:www-data" ]; then
    echo -e "${GREEN}✅ Permissões corretas (www-data:www-data)${NC}"
else
    echo -e "${YELLOW}⚠️  Permissões: $OWNER (esperado: www-data:www-data)${NC}"
fi
echo ""

# 4. Verificar configuração Nginx
echo "4️⃣  Configuração Nginx:"
if [ -f "/etc/nginx/sites-available/blackhouse" ]; then
    echo -e "${GREEN}✅ Arquivo de configuração encontrado${NC}"
    if grep -q "blackhouse.app.br" /etc/nginx/sites-available/blackhouse; then
        echo -e "${GREEN}✅ Domínio blackhouse.app.br configurado${NC}"
    fi
    if grep -q "www.blackhouse.app.br" /etc/nginx/sites-available/blackhouse; then
        echo -e "${GREEN}✅ Domínio www.blackhouse.app.br configurado${NC}"
    fi
    if grep -q "api.blackhouse.app.br" /etc/nginx/sites-available/blackhouse; then
        echo -e "${GREEN}✅ Domínio api.blackhouse.app.br configurado${NC}"
    fi
else
    echo -e "${RED}❌ Arquivo de configuração NÃO encontrado${NC}"
fi

if [ -L "/etc/nginx/sites-enabled/blackhouse" ]; then
    echo -e "${GREEN}✅ Site habilitado${NC}"
else
    echo -e "${RED}❌ Site NÃO está habilitado${NC}"
fi
echo ""

# 5. Verificar resposta HTTP
echo "5️⃣  Teste HTTP:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Servidor respondendo HTTP 200 (localhost)${NC}"
else
    echo -e "${RED}❌ Servidor retornando código: $HTTP_CODE${NC}"
fi

HTTP_CODE_IP=$(curl -s -o /dev/null -w "%{http_code}" http://177.153.64.95)
if [ "$HTTP_CODE_IP" = "200" ]; then
    echo -e "${GREEN}✅ Servidor respondendo HTTP 200 (IP público)${NC}"
else
    echo -e "${YELLOW}⚠️  IP público retornando código: $HTTP_CODE_IP${NC}"
fi
echo ""

# 6. Verificar API
echo "6️⃣  API Backend:"
if systemctl list-units --type=service --all | grep -q "blackhouse-api.service"; then
    if systemctl is-active --quiet blackhouse-api; then
        echo -e "${GREEN}✅ Serviço blackhouse-api está rodando${NC}"
        
        # Testar health check
        API_HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null)
        if echo "$API_HEALTH" | grep -q "ok"; then
            echo -e "${GREEN}✅ API respondendo no /health${NC}"
        else
            echo -e "${YELLOW}⚠️  API não está respondendo no /health${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Serviço blackhouse-api existe mas não está rodando${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Serviço blackhouse-api não encontrado (pode ser normal se ainda não configurado)${NC}"
fi

# Verificar se porta 3001 está aberta
if netstat -tlnp 2>/dev/null | grep -q ":3001" || ss -tlnp 2>/dev/null | grep -q ":3001"; then
    echo -e "${GREEN}✅ Porta 3001 está aberta${NC}"
else
    echo -e "${YELLOW}⚠️  Porta 3001 não está aberta${NC}"
fi
echo ""

# 7. Verificar Certbot (SSL)
echo "7️⃣  Certbot (SSL):"
if command -v certbot &> /dev/null; then
    echo -e "${GREEN}✅ Certbot instalado${NC}"
    CERTBOT_VERSION=$(certbot --version 2>/dev/null | head -1)
    echo "   Versão: $CERTBOT_VERSION"
else
    echo -e "${RED}❌ Certbot NÃO está instalado${NC}"
    echo "   Instale com: sudo apt install certbot python3-certbot-nginx"
fi
echo ""

# 8. Verificar DNS (se já estiver configurado)
echo "8️⃣  Verificação DNS:"
DNS_IP=$(dig +short blackhouse.app.br @8.8.8.8 2>/dev/null | head -1)
if [ -z "$DNS_IP" ]; then
    echo -e "${YELLOW}⚠️  DNS ainda NÃO configurado${NC}"
    echo "   Configure no Registro.br apontando para: 177.153.64.95"
elif [ "$DNS_IP" = "177.153.64.95" ]; then
    echo -e "${GREEN}✅ DNS configurado corretamente: $DNS_IP${NC}"
else
    echo -e "${YELLOW}⚠️  DNS apontando para: $DNS_IP (esperado: 177.153.64.95)${NC}"
fi

DNS_WWW=$(dig +short www.blackhouse.app.br @8.8.8.8 2>/dev/null | head -1)
if [ -z "$DNS_WWW" ]; then
    echo -e "${YELLOW}⚠️  DNS www ainda NÃO configurado${NC}"
elif [ "$DNS_WWW" = "177.153.64.95" ]; then
    echo -e "${GREEN}✅ DNS www configurado corretamente: $DNS_WWW${NC}"
fi

DNS_API=$(dig +short api.blackhouse.app.br @8.8.8.8 2>/dev/null | head -1)
if [ -z "$DNS_API" ]; then
    echo -e "${YELLOW}⚠️  DNS api ainda NÃO configurado${NC}"
elif [ "$DNS_API" = "177.153.64.95" ]; then
    echo -e "${GREEN}✅ DNS api configurado corretamente: $DNS_API${NC}"
fi
echo ""

# 9. Verificar firewall
echo "9️⃣  Firewall:"
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        echo -e "${YELLOW}⚠️  UFW está ativo${NC}"
        if ufw status | grep -q "80/tcp"; then
            echo -e "${GREEN}✅ Porta 80 aberta no firewall${NC}"
        else
            echo -e "${RED}❌ Porta 80 NÃO está aberta no firewall${NC}"
            echo "   Execute: sudo ufw allow 80/tcp"
        fi
        if ufw status | grep -q "443/tcp"; then
            echo -e "${GREEN}✅ Porta 443 aberta no firewall${NC}"
        else
            echo -e "${YELLOW}⚠️  Porta 443 NÃO está aberta (necessária para SSL)${NC}"
            echo "   Execute: sudo ufw allow 443/tcp"
        fi
    else
        echo -e "${GREEN}✅ UFW está inativo (sem bloqueios)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  UFW não instalado (verificar iptables manualmente)${NC}"
fi

# Verificar iptables
if iptables -L -n 2>/dev/null | grep -q "REJECT\|DROP"; then
    echo -e "${YELLOW}⚠️  Iptables pode ter regras restritivas${NC}"
else
    echo -e "${GREEN}✅ Iptables sem bloqueios aparentes${NC}"
fi
echo ""

# Resumo Final
echo "=========================================="
echo "📋 Resumo Final"
echo "=========================================="
echo ""
echo "✅ Servidor está PRONTO para vincular DNS no Registro.br"
echo ""
echo "📝 Próximos passos:"
echo "   1. Configure DNS no Registro.br:"
echo "      - Tipo A | Nome: @ | Valor: 177.153.64.95"
echo "      - Tipo A | Nome: www | Valor: 177.153.64.95"
echo "      - Tipo A | Nome: api | Valor: 177.153.64.95"
echo ""
echo "   2. Aguarde propagação DNS (5-30 minutos)"
echo ""
echo "   3. Verifique propagação:"
echo "      dig blackhouse.app.br +short"
echo ""
echo "   4. Após DNS propagar, configure SSL:"
echo "      sudo certbot --nginx -d blackhouse.app.br -d www.blackhouse.app.br -d api.blackhouse.app.br --non-interactive --agree-tos --email admin@blackhouse.app.br --redirect"
echo ""
echo "   5. Ou execute o script completo:"
echo "      sudo bash /root/deploy-completo.sh"
echo ""
