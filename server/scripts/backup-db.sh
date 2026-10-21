#!/bin/bash
# Script de Backup do Banco de Dados
# Executa backup diário do PostgreSQL

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/blackhouse/db"
DB_NAME="${DB_NAME:-blackhouse_db}"
DB_USER="${DB_USER:-app_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Criar diretório se não existir
mkdir -p "$BACKUP_DIR"

# Log
LOG_FILE="/var/log/blackhouse-backup.log"
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Iniciando backup do banco de dados..."

# Backup completo (formato custom do pg_dump)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.dump"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    log "Backup completo criado: $BACKUP_FILE"
    
    # Comprimir backup
    gzip "$BACKUP_FILE"
    log "Backup comprimido: ${BACKUP_FILE}.gz"
    
    # Backup de schema apenas (sem dados)
    SCHEMA_FILE="$BACKUP_DIR/schema_$DATE.sql"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -s -f "$SCHEMA_FILE"
    
    if [ $? -eq 0 ]; then
        log "Schema backup criado: $SCHEMA_FILE"
        gzip "$SCHEMA_FILE"
    fi
    
    # Manter apenas últimos 30 dias
    find "$BACKUP_DIR" -name "backup_*.dump.gz" -mtime +30 -delete
    find "$BACKUP_DIR" -name "schema_*.sql.gz" -mtime +30 -delete
    
    log "Backup concluído com sucesso"
    exit 0
else
    log "ERRO: Falha ao criar backup"
    exit 1
fi
