#!/bin/bash
# Script de backup automático do PostgreSQL

BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME:-blackhouse_db}"
DB_USER="${DB_USER:-app_user}"
DB_HOST="${DB_HOST:-localhost}"

# Carregar senha do arquivo .env se existir
if [ -f "/var/www/blackhouse/server/.env" ]; then
    export $(grep -v '^#' /var/www/blackhouse/server/.env | grep DB_PASSWORD | xargs)
fi

# Se DB_PASSWORD não estiver definido, tentar ler de variável de ambiente
if [ -z "$DB_PASSWORD" ]; then
    echo "ERRO: DB_PASSWORD não definido. Configure no .env ou exporte a variável."
    exit 1
fi

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

# Exportar variáveis de ambiente
export PGPASSWORD="${DB_PASSWORD}"

# Realizar backup
echo "Iniciando backup do banco de dados $DB_NAME..."
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

if [ $? -eq 0 ]; then
    echo "Backup concluído: backup_$DATE.sql"
    
    # Compactar backup
    gzip $BACKUP_DIR/backup_$DATE.sql
    echo "Backup compactado: backup_$DATE.sql.gz"
    
    # Manter apenas últimos 7 dias
    find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
    echo "Backups antigos removidos (mantidos últimos 7 dias)"
else
    echo "ERRO: Falha no backup!"
    exit 1
fi

# Limpar variável de ambiente
unset PGPASSWORD
