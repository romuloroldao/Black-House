#!/bin/bash

# Script de Backup do Supabase
# Data: $(date)

set -e

BACKUP_DIR="/root/backup-supabase"
BACKUP_FILE="$BACKUP_DIR/backup_completo_$(date +%Y%m%d_%H%M%S).dump"
CERT_FILE="$BACKUP_DIR/supabase-root.crt"

# Credenciais
DB_HOST="db.cghzttbggklhuyqxzabq.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="RR0ld40.864050!"

# Pooler (alternativa)
POOLER_HOST="aws-0-sa-east-1.pooler.supabase.com"
POOLER_PORT="6543"
PROJECT_ID="cghzttbggklhuyqxzabq"

echo "=========================================="
echo "  BACKUP COMPLETO DO SUPABASE"
echo "=========================================="
echo "Data/Hora: $(date)"
echo "Diretório: $BACKUP_DIR"
echo "Arquivo: $BACKUP_FILE"
echo ""

# Verificar se o certificado existe
if [ ! -f "$CERT_FILE" ]; then
    echo "❌ ERRO: Certificado SSL não encontrado em $CERT_FILE"
    exit 1
fi

# Verificar se pg_dump está disponível
if ! command -v pg_dump &> /dev/null; then
    echo "❌ ERRO: pg_dump não encontrado"
    exit 1
fi

echo "✅ pg_dump: $(pg_dump --version)"
echo ""

# Função para tentar backup direto
backup_direct() {
    echo "=== Tentando conexão direta (porta 5432) ==="
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=require&sslrootcert=$CERT_FILE" \
        --no-owner \
        --no-acl \
        --schema=public \
        --schema=storage \
        --schema=auth \
        -F c \
        -f "$BACKUP_FILE" \
        -v 2>&1 | tee "$BACKUP_DIR/backup_log_$(date +%Y%m%d_%H%M%S).txt"
    
    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
        echo ""
        echo "✅ BACKUP CONCLUÍDO COM SUCESSO!"
        echo "Arquivo: $BACKUP_FILE"
        ls -lh "$BACKUP_FILE"
        return 0
    else
        echo "❌ Falha na conexão direta"
        return 1
    fi
}

# Função para tentar backup via pooler
backup_pooler() {
    echo "=== Tentando conexão via pooler (porta 6543) ==="
    # Tentar com usuário.postgres
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        "postgresql://$DB_USER.$PROJECT_ID:$DB_PASSWORD@$POOLER_HOST:$POOLER_PORT/$DB_NAME?sslmode=require&sslrootcert=$CERT_FILE" \
        --no-owner \
        --no-acl \
        --schema=public \
        --schema=storage \
        --schema=auth \
        -F c \
        -f "$BACKUP_FILE" \
        -v 2>&1 | tee "$BACKUP_DIR/backup_log_$(date +%Y%m%d_%H%M%S).txt"
    
    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
        echo ""
        echo "✅ BACKUP CONCLUÍDO COM SUCESSO via pooler!"
        echo "Arquivo: $BACKUP_FILE"
        ls -lh "$BACKUP_FILE"
        return 0
    else
        echo "❌ Falha na conexão via pooler"
        return 1
    fi
}

# Função para tentar backup via pooler sem PROJECT_ID
backup_pooler_simple() {
    echo "=== Tentando conexão via pooler (usuário simples) ==="
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        "postgresql://$DB_USER:$DB_PASSWORD@$POOLER_HOST:$POOLER_PORT/$DB_NAME?sslmode=require&sslrootcert=$CERT_FILE" \
        --no-owner \
        --no-acl \
        --schema=public \
        --schema=storage \
        --schema=auth \
        -F c \
        -f "$BACKUP_FILE" \
        -v 2>&1 | tee "$BACKUP_DIR/backup_log_$(date +%Y%m%d_%H%M%S).txt"
    
    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
        echo ""
        echo "✅ BACKUP CONCLUÍDO COM SUCESSO via pooler!"
        echo "Arquivo: $BACKUP_FILE"
        ls -lh "$BACKUP_FILE"
        return 0
    else
        echo "❌ Falha na conexão via pooler"
        return 1
    fi
}

# Tentar diferentes métodos
if backup_direct; then
    exit 0
elif backup_pooler; then
    exit 0
elif backup_pooler_simple; then
    exit 0
else
    echo ""
    echo "=========================================="
    echo "❌ ERRO: Nenhum método de conexão funcionou"
    echo "=========================================="
    echo ""
    echo "Possíveis causas:"
    echo "1. Servidor não tem conectividade IPv6 habilitada"
    echo "2. Firewall bloqueando conexões"
    echo "3. Credenciais incorretas"
    echo "4. Servidor Supabase fora do ar"
    echo ""
    echo "SOLUÇÕES:"
    echo "1. Executar este script de um servidor com IPv6 habilitado"
    echo "2. Usar Supabase CLI: npx supabase db dump"
    echo "3. Fazer backup pelo painel do Supabase"
    echo "4. Verificar conectividade de rede"
    echo ""
    exit 1
fi
