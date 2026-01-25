#!/bin/bash
# Script para verificar status DNSSEC do domínio

DOMAIN="blackhouse.app.br"

echo "=========================================="
echo "🔐 Verificação DNSSEC - $DOMAIN"
echo "=========================================="
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar Servidores DNS
echo "1️⃣  Servidores DNS:"
NS_RESULT=$(dig NS $DOMAIN +short 2>/dev/null)
if echo "$NS_RESULT" | grep -q "auto.dns.br"; then
    echo -e "${GREEN}✅ Usando DNS do Registro.br${NC}"
    echo "$NS_RESULT" | sed 's/^/   /'
else
    echo -e "${YELLOW}⚠️  Servidores DNS:${NC}"
    echo "$NS_RESULT" | sed 's/^/   /'
fi
echo ""

# 2. Verificar Registros DS
echo "2️⃣  Registros DS (DNSSEC):"
DS_RESULT=$(dig DS $DOMAIN +short 2>/dev/null)
if [ -z "$DS_RESULT" ]; then
    echo -e "${YELLOW}⚠️  DNSSEC não está ativo${NC}"
    echo "   Não foram encontrados registros DS"
    echo "   Para ativar, veja: CONFIGURAR_DNSSEC.md"
else
    echo -e "${GREEN}✅ DNSSEC está ATIVO${NC}"
    echo "$DS_RESULT" | sed 's/^/   /'
fi
echo ""

# 3. Verificar DNSKEY
echo "3️⃣  Registros DNSKEY:"
DNSKEY_RESULT=$(dig DNSKEY $DOMAIN +dnssec 2>/dev/null | grep -E "DNSKEY|RRSIG")
if [ -z "$DNSKEY_RESULT" ]; then
    echo -e "${YELLOW}⚠️  Nenhum registro DNSKEY encontrado${NC}"
else
    echo -e "${GREEN}✅ Registros DNSKEY encontrados${NC}"
    echo "$DNSKEY_RESULT" | head -3 | sed 's/^/   /'
fi
echo ""

# 4. Verificar Validação DNSSEC
echo "4️⃣  Validação DNSSEC:"
VALIDATION=$(dig $DOMAIN +dnssec +cd 2>/dev/null | grep -c "RRSIG")
if [ "$VALIDATION" -gt 0 ]; then
    echo -e "${GREEN}✅ DNSSEC validando corretamente ($VALIDATION assinaturas encontradas)${NC}"
else
    echo -e "${YELLOW}⚠️  Validação DNSSEC não encontrada${NC}"
fi
echo ""

# 5. Teste de Validação Externa
echo "5️⃣  Teste de Validação:"
VALIDATION_TEST=$(dig $DOMAIN +dnssec 2>/dev/null | grep -o "flags:.*ad" || echo "")
if echo "$VALIDATION_TEST" | grep -q "ad"; then
    echo -e "${GREEN}✅ DNSSEC validado com sucesso (flag AD presente)${NC}"
else
    echo -e "${YELLOW}⚠️  DNSSEC não está sendo validado (flag AD ausente)${NC}"
    echo "   Isso é normal se DNSSEC foi ativado recentemente (aguarde propagação)"
fi
echo ""

# Resumo
echo "=========================================="
echo "📋 Resumo"
echo "=========================================="

if [ -z "$DS_RESULT" ]; then
    echo -e "${YELLOW}⚠️  DNSSEC NÃO está configurado${NC}"
    echo ""
    echo "Para configurar DNSSEC:"
    echo "1. Acesse o painel do Registro.br"
    echo "2. Encontre a opção DNSSEC na página do domínio"
    echo "3. Ative DNSSEC"
    echo "4. Aguarde propagação (até 1 hora)"
    echo ""
    echo "Veja instruções detalhadas em: CONFIGURAR_DNSSEC.md"
else
    echo -e "${GREEN}✅ DNSSEC está configurado e ativo${NC}"
    echo ""
    echo "DNSSEC está protegendo seu domínio contra ataques DNS."
fi

echo ""
