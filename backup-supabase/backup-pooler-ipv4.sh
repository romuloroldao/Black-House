#!/bin/bash
# Script de Backup via Pooler IPv4 (SEM necessidade de IPv6)

set -e

BACKUP_DIR="/root/backup-supabase"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_completo_pooler_${TIMESTAMP}.dump"
CERT_FILE="$BACKUP_DIR/supabase-root.crt"

# Pooler IPv4 - Session Mode (porta 5432)
POOLER_HOST="aws-0-sa-east-1.pooler.supabase.com"
POOLER_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.cghzttbggklhuyqxzabq"
DB_PASSWORD="RR0ld40.864050!"

echo "=========================================="
echo "  BACKUP SUPABASE VIA POOLER IPv4"
echo "=========================================="
echo "Data/Hora: $(date)"
echo "Pooler: $POOLER_HOST:$POOLER_PORT"
echo "Arquivo: $BACKUP_FILE"
echo ""

# Verificar certificado
if [ ! -f "$CERT_FILE" ]; then
    echo "❌ ERRO: Certificado não encontrado: $CERT_FILE"
    exit 1
fi

echo "=== Tentando conexão via Pooler IPv4 (Session Mode) ==="

PGPASSWORD="$DB_PASSWORD" pg_dump \
  "postgresql://$DB_USER:$DB_PASSWORD@$POOLER_HOST:$POOLER_PORT/$DB_NAME?sslmode=require&sslrootcert=$CERT_FILE" \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=storage \
  --schema=auth \
  -F c \
  -f "$BACKUP_FILE" \
  -v 2>&1 | tee "$BACKUP_DIR/backup_pooler_log_${TIMESTAMP}.txt"

if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo ""
    echo "✅✅✅ BACKUP CONCLUÍDO COM SUCESSO VIA IPv4! ✅✅✅"
    echo "Arquivo: $BACKUP_FILE"
    ls -lh "$BACKUP_FILE"
    echo ""
    echo "Tamanho do backup: $(du -h $BACKUP_FILE | cut -f1)"
    exit 0
else
    echo ""
    echo "❌ Falha no backup via pooler - Tentando formato alternativo..."
    echo ""
    
    # Tentar com usuário simples
    DB_USER_SIMPLE="postgres"
    BACKUP_FILE_ALT="$BACKUP_DIR/backup_completo_pooler_${TIMESTAMP}_alt.dump"
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
      "postgresql://$DB_USER_SIMPLE:$DB_PASSWORD@$POOLER_HOST:$POOLER_PORT/$DB_NAME?sslmode=require&sslrootcert=$CERT_FILE" \
      --no-owner \
      --no-acl \
      --schema=public \
      --schema=storage \
      --schema=auth \
      -F c \
      -f "$BACKUP_FILE_ALT" \
      -v 2>&1 | tee "$BACKUP_DIR/backup_pooler_log_${TIMESTAMP}_alt.txt"
    
    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE_ALT" ] && [ -s "$BACKUP_FILE_ALT" ]; then
        echo ""
        echo "✅✅✅ BACKUP CONCLUÍDO COM SUCESSO! ✅✅✅"
        echo "Arquivo: $BACKUP_FILE_ALT"
        ls -lh "$BACKUP_FILE_ALT"
        exit 0
    else
        echo ""
        echo "❌❌❌ ERRO: Backup via pooler falhou ❌❌❌"
        echo ""
        echo "POSSÍVEIS CAUSAS:"
        echo "1. Formato de usuário incorreto no pooler"
        echo "2. Pooler pode ter limitações para pg_dump"
        echo "3. Credenciais podem precisar ser verificadas no painel"
        echo ""
        echo "RECOMENDAÇÃO: Use o Painel do Supabase:"
        echo "https://app.supabase.com/project/cghzttbggklhuyqxzabq"
        echo "Settings → Database → Connection String"
        echo "Verifique o formato correto do usuário para o pooler"
        exit 1
    fi
fi
