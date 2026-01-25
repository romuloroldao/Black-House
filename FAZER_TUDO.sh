#!/bin/bash
# ============================================================================
# SCRIPT AUTOMÁTICO - FAZ TUDO SOZINHO!
# ============================================================================
# Basta executar: bash FAZER_TUDO.sh
# ============================================================================

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║     IMPORTAÇÃO AUTOMÁTICA DE DADOS CSV PARA SUPABASE                ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🔍 Procurando arquivos CSV..."
echo ""

# Cores para output
VERDE='\033[0;32m'
AMARELO='\033[1;33m'
VERMELHO='\033[0;31m'
NC='\033[0m' # No Color

# Procurar arquivos CSV em vários locais
LOCAIS=(
    "/mnt/c/Users/romul/Downloads"
    "/root"
    "."
    "$HOME/Downloads"
)

ARQUIVOS_ENCONTRADOS=0

for local in "${LOCAIS[@]}"; do
    if [ -d "$local" ]; then
        for arquivo in "$local"/*_rows.csv; do
            if [ -f "$arquivo" ]; then
                echo -e "${VERDE}✓${NC} Encontrado: $arquivo"
                cp "$arquivo" /root/ 2>/dev/null || true
                ARQUIVOS_ENCONTRADOS=$((ARQUIVOS_ENCONTRADOS + 1))
            fi
        done
    fi
done

echo ""

if [ $ARQUIVOS_ENCONTRADOS -eq 0 ]; then
    echo -e "${VERMELHO}❌ Nenhum arquivo CSV encontrado automaticamente!${NC}"
    echo ""
    echo "📋 Por favor, copie manualmente os arquivos CSV para /root/:"
    echo ""
    echo "   migrations_rows.csv"
    echo "   objects_rows.csv"
    echo "   buckets_rows.csv"
    echo "   prefixes_rows.csv"
    echo ""
    echo "Depois execute este script novamente!"
    exit 1
fi

echo -e "${VERDE}✅ Encontrados $ARQUIVOS_ENCONTRADOS arquivo(s)${NC}"
echo ""
echo "🚀 Executando script Python para gerar INSERTs..."
echo ""

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo -e "${VERMELHO}❌ Python3 não encontrado!${NC}"
    echo ""
    echo "Por favor, instale Python3 ou me avise para eu criar os scripts SQL manualmente."
    exit 1
fi

# Executar script Python
python3 import_csv_data.py

if [ $? -eq 0 ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo -e "║  ${VERDE}✅ SUCESSO! Scripts SQL gerados!${NC}                                    ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📁 Arquivos gerados em /root/:"
    echo ""
    echo "   ✓ migrations_inserts.sql"
    echo "   ✓ objects_inserts.sql"
    echo "   ✓ buckets_inserts.sql"
    echo "   ✓ prefixes_inserts.sql"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 PRÓXIMOS PASSOS:"
    echo ""
    echo "1. Acesse o Supabase Dashboard: https://app.supabase.com"
    echo "2. Vá em 'SQL Editor'"
    echo "3. Execute os scripts nesta ordem:"
    echo ""
    echo "   a) buckets_inserts.sql"
    echo "   b) migrations_inserts.sql"
    echo "   c) objects_inserts.sql"
    echo "   d) prefixes_inserts.sql"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 Dica: Você pode abrir cada arquivo .sql e copiar/colar no Supabase!"
    echo ""
else
    echo ""
    echo -e "${VERMELHO}❌ Erro ao executar o script Python${NC}"
    echo ""
    echo "Não se preocupe! Me avise e eu crio os scripts SQL manualmente."
    exit 1
fi
