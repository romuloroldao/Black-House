#!/bin/bash

# Script de Backup do Supabase usando Supabase CLI
# Data: $(date)

set -e

BACKUP_DIR="/root/backup-supabase"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE_SQL="$BACKUP_DIR/backup_completo_${TIMESTAMP}.sql"
BACKUP_FILE_DUMP="$BACKUP_DIR/backup_completo_${TIMESTAMP}.dump"

# Credenciais
PROJECT_REF="cghzttbggklhuyqxzabq"
DB_PASSWORD="RR0ld40.864050!"
DB_HOST="db.cghzttbggklhuyqxzabq.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
CERT_FILE="$BACKUP_DIR/supabase-root.crt"

echo "=========================================="
echo "  BACKUP SUPABASE - USANDO CLI"
echo "=========================================="
echo "Data/Hora: $(date)"
echo "Diretório: $BACKUP_DIR"
echo ""

# Verificar se Node.js está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ ERRO: npm não encontrado"
    echo "Instale Node.js primeiro: sudo apt install nodejs npm"
    exit 1
fi

echo "✅ npm: $(npm --version)"
echo ""

# Método 1: Usar projeto reference (requer login)
echo "=== Método 1: Backup usando PROJECT_REF ==="
echo "⚠️  NOTA: Isso requer fazer login primeiro com: npx supabase login"
echo ""
if npx --yes supabase login --help &> /dev/null; then
    echo "Tentando backup com project-ref..."
    npx --yes supabase db dump \
        --project-ref "$PROJECT_REF" \
        --password "$DB_PASSWORD" \
        --schema public,storage,auth \
        --file "$BACKUP_FILE_SQL" 2>&1 | tee "$BACKUP_DIR/backup_log_${TIMESTAMP}.txt"
    
    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE_SQL" ] && [ -s "$BACKUP_FILE_SQL" ]; then
        echo ""
        echo "✅ BACKUP CONCLUÍDO COM SUCESSO!"
        echo "Arquivo SQL: $BACKUP_FILE_SQL"
        ls -lh "$BACKUP_FILE_SQL"
        exit 0
    fi
else
    echo "⚠️  Método 1 requer login - pulando..."
fi

echo ""
echo "=== Método 2: Backup usando DB_URL direto ==="

# Tentar com pg_dump direto usando variáveis de ambiente
export PGHOST="$DB_HOST"
export PGPORT="$DB_PORT"
export PGDATABASE="$DB_NAME"
export PGUSER="$DB_USER"
export PGPASSWORD="$DB_PASSWORD"
export PGSSLMODE="require"
export PGSSLROOTCERT="$CERT_FILE"

if [ -f "$CERT_FILE" ]; then
    echo "✅ Certificado encontrado: $CERT_FILE"
    
    # Tentar conexão via IPv6 direto (forçando)
    echo "Tentando conexão via IPv6..."
    
    # Usar pg_dump direto
    if pg_dump \
        --no-owner \
        --no-acl \
        --schema=public \
        --schema=storage \
        --schema=auth \
        -F c \
        -f "$BACKUP_FILE_DUMP" \
        -v 2>&1 | tee "$BACKUP_DIR/backup_log_${TIMESTAMP}.txt"; then
        
        if [ -f "$BACKUP_FILE_DUMP" ] && [ -s "$BACKUP_FILE_DUMP" ]; then
            echo ""
            echo "✅ BACKUP CONCLUÍDO COM SUCESSO!"
            echo "Arquivo: $BACKUP_FILE_DUMP"
            ls -lh "$BACKUP_FILE_DUMP"
            exit 0
        fi
    fi
fi

echo ""
echo "=========================================="
echo "❌ ERRO: Nenhum método funcionou"
echo "=========================================="
echo ""
echo "SOLUÇÕES RECOMENDADAS:"
echo ""
echo "1. HABILITAR IPv6 no servidor:"
echo "   sudo sysctl -w net.ipv6.conf.all.disable_ipv6=0"
echo "   sudo sysctl -w net.ipv6.conf.default.disable_ipv6=0"
echo "   echo 'net.ipv6.conf.all.disable_ipv6 = 0' | sudo tee -a /etc/sysctl.conf"
echo "   sudo systemctl restart networking"
echo ""
echo "2. FAZER BACKUP PELO PAINEL DO SUPABASE:"
echo "   - Acesse: https://app.supabase.com/project/$PROJECT_REF"
echo "   - Vá em Database → Backups → Download"
echo ""
echo "3. EXECUTAR DE OUTRA MÁQUINA com IPv6 habilitado"
echo ""
echo "4. USAR CONEXÃO VPN ou túnel IPv6"
echo ""
exit 1
