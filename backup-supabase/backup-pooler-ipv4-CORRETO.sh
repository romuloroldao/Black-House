#!/bin/bash
# Script de Backup via Pooler IPv4 (SEM necessidade de IPv6)
# Baseado na documentação oficial: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler

set -e

BACKUP_DIR="/root/backup-supabase"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_completo_pooler_${TIMESTAMP}.dump"
CERT_FILE="$BACKUP_DIR/supabase-root.crt"

# Informações do projeto (obtenha do painel do Supabase)
PROJECT_REF="cghzttbggklhuyqxzabq"
REGION="sa-east-1"
DB_NAME="postgres"
DB_PASSWORD="RR0ld40.864050!"

# Pooler Session Mode (porta 5432) - Para conexões persistentes
# Formato: postgres.[PROJECT-REF]:PASSWORD@aws-0-[REGION].pooler.supabase.com:5432/postgres
POOLER_SESSION_HOST="aws-0-${REGION}.pooler.supabase.com"
POOLER_SESSION_PORT="5432"
DB_USER_SESSION="postgres.${PROJECT_REF}"

# Pooler Transaction Mode (porta 6543) - Para conexões curtas/serverless
# Formato: postgres:PASSWORD@db.[PROJECT-REF].supabase.co:6543/postgres
# NOTA: Transaction mode NÃO suporta prepared statements, pode ter limitações para pg_dump
POOLER_TRANSACTION_HOST="db.${PROJECT_REF}.supabase.co"
POOLER_TRANSACTION_PORT="6543"
DB_USER_TRANSACTION="postgres"

echo "=========================================="
echo "  BACKUP SUPABASE VIA POOLER IPv4"
echo "  (Baseado na documentação oficial)"
echo "=========================================="
echo "Data/Hora: $(date)"
echo "Project Ref: $PROJECT_REF"
echo "Region: $REGION"
echo "Arquivo: $BACKUP_FILE"
echo ""

# Verificar certificado
if [ ! -f "$CERT_FILE" ]; then
    echo "❌ ERRO: Certificado não encontrado: $CERT_FILE"
    exit 1
fi

# Função para tentar backup via Session Mode
backup_session_mode() {
    echo "=== Tentando Pooler SESSION MODE (porta 5432) ==="
    echo "Formato: postgres.$PROJECT_REF@$POOLER_SESSION_HOST:$POOLER_SESSION_PORT"
    echo ""
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
      "postgresql://$DB_USER_SESSION:$DB_PASSWORD@$POOLER_SESSION_HOST:$POOLER_SESSION_PORT/$DB_NAME?sslmode=require&sslrootcert=$CERT_FILE" \
      --no-owner \
      --no-acl \
      --schema=public \
      --schema=storage \
      --schema=auth \
      -F c \
      -f "$BACKUP_FILE" \
      -v 2>&1 | tee "$BACKUP_DIR/backup_session_log_${TIMESTAMP}.txt"
    
    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        echo ""
        echo "✅✅✅ BACKUP CONCLUÍDO COM SUCESSO VIA SESSION MODE! ✅✅✅"
        echo "Arquivo: $BACKUP_FILE"
        ls -lh "$BACKUP_FILE"
        echo ""
        echo "Tamanho: $(du -h $BACKUP_FILE | cut -f1)"
        return 0
    else
        echo "❌ Falha no Session Mode"
        rm -f "$BACKUP_FILE"
        return 1
    fi
}

# Função para tentar backup via Transaction Mode (pode ter limitações)
backup_transaction_mode() {
    echo ""
    echo "=== Tentando Pooler TRANSACTION MODE (porta 6543) ==="
    echo "⚠️  AVISO: Transaction mode pode ter limitações para pg_dump"
    echo "    (não suporta prepared statements)"
    echo "Formato: postgres@$POOLER_TRANSACTION_HOST:$POOLER_TRANSACTION_PORT"
    echo ""
    
    BACKUP_FILE_TRANS="$BACKUP_DIR/backup_completo_pooler_trans_${TIMESTAMP}.dump"
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
      "postgresql://$DB_USER_TRANSACTION:$DB_PASSWORD@$POOLER_TRANSACTION_HOST:$POOLER_TRANSACTION_PORT/$DB_NAME?sslmode=require&sslrootcert=$CERT_FILE" \
      --no-owner \
      --no-acl \
      --schema=public \
      --schema=storage \
      --schema=auth \
      -F c \
      -f "$BACKUP_FILE_TRANS" \
      -v 2>&1 | tee "$BACKUP_DIR/backup_transaction_log_${TIMESTAMP}.txt"
    
    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE_TRANS" ] && [ -s "$BACKUP_FILE_TRANS" ]; then
        echo ""
        echo "✅✅✅ BACKUP CONCLUÍDO VIA TRANSACTION MODE! ✅✅✅"
        echo "Arquivo: $BACKUP_FILE_TRANS"
        ls -lh "$BACKUP_FILE_TRANS"
        echo ""
        echo "Tamanho: $(du -h $BACKUP_FILE_TRANS | cut -f1)"
        return 0
    else
        echo "❌ Falha no Transaction Mode"
        rm -f "$BACKUP_FILE_TRANS"
        return 1
    fi
}

# Tentar Session Mode primeiro (recomendado para backups)
if backup_session_mode; then
    exit 0
fi

# Se Session Mode falhar, tentar Transaction Mode
if backup_transaction_mode; then
    exit 0
fi

# Se ambos falharem
echo ""
echo "=========================================="
echo "❌ ERRO: Ambos os métodos falharam"
echo "=========================================="
echo ""
echo "POSSÍVEIS CAUSAS:"
echo "1. Connection string incorreta (verifique no painel)"
echo "2. Pooler não habilitado para este projeto"
echo "3. Credenciais incorretas"
echo "4. pg_dump pode ter limitações com poolers"
echo ""
echo "VERIFIQUE NO PAINEL DO SUPABASE:"
echo "1. Acesse: https://app.supabase.com/project/$PROJECT_REF"
echo "2. Vá em Settings → Database → Connection String"
echo "3. Copie a connection string EXATA do pooler"
echo "4. Use esse formato no script"
echo ""
echo "RECOMENDAÇÃO FINAL:"
echo "Use o Painel do Supabase para fazer o backup:"
echo "https://app.supabase.com/project/$PROJECT_REF"
echo "Database → Backups → Download"
echo ""
echo "OU use a connection string do Dedicated Pooler (PgBouncer) se disponível:"
echo "- Disponível apenas para planos pagos"
echo "- Melhor performance e latência"
echo "- Porta 6543, sempre em Transaction Mode"
echo ""
exit 1
