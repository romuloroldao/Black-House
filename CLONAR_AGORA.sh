#!/bin/bash
# Script para clonar repositório - escolha o método

echo "=== Clonar Repositório Black-House ==="
echo ""
echo "O repositório é privado. Escolha o método:"
echo ""
echo "1. Token GitHub (mais rápido)"
echo "2. SSH (mais seguro)"
echo "3. Já tenho o repositório em outro lugar"
echo ""
read -p "Escolha (1-3): " OPCAO

case $OPCAO in
    1)
        echo ""
        echo "📋 Para criar um token:"
        echo "   1. Acesse: https://github.com/settings/tokens"
        echo "   2. Generate new token (classic)"
        echo "   3. Escopo: repo"
        echo "   4. Copie o token"
        echo ""
        read -p "Cole seu token aqui: " TOKEN
        if [ -z "$TOKEN" ]; then
            echo "❌ Token não fornecido"
            exit 1
        fi
        cd /root
        git clone https://${TOKEN}@github.com/romuloroldao/Black-House.git
        ;;
    2)
        echo ""
        echo "📋 Certifique-se de ter configurado SSH no GitHub"
        echo "   Ver: https://github.com/settings/keys"
        echo ""
        read -p "Pressione Enter para continuar..."
        cd /root
        git clone git@github.com:romuloroldao/Black-House.git
        ;;
    3)
        echo ""
        echo "📋 Transfira o repositório para /root/Black-House"
        echo "   Ou execute manualmente o clone"
        exit 0
        ;;
    *)
        echo "Opção inválida"
        exit 1
        ;;
esac

if [ -d "/root/Black-House" ]; then
    echo ""
    echo "✅ Repositório clonado com sucesso!"
    echo ""
    echo "Próximos passos:"
    echo "  cd /root/Black-House"
    echo "  npm install"
    echo "  /root/scripts/adaptar-automatico.sh /root/Black-House"
else
    echo ""
    echo "❌ Erro ao clonar repositório"
    exit 1
fi
