# Backup, limpeza e object storage — 2026-07-25

## Medidas de disco

| Momento | Disco usado | Livre | Uso |
|---------|-------------|-------|-----|
| **Antes** | 22 GB | 45 GB | 33% |
| **Depois** | 16 GB | 51 GB | 24% |
| **Recuperado** | ~**6,1 GiB** | | |

### Limpeza efectuada

| Alvo | Acção | Resultado |
|------|--------|-----------|
| `journald` | `journalctl --vacuum-size=500M` | ~3,5 GB libertados |
| PM2 logs mortos | Removidos `index-out.log` (2 GB) + `index-error.log` (237 MB) | ~2,2 GB |
| `dist.backup.*` | Mantidos só os **3** mais recentes (de 115) | ~450 MB |
| pm2-logrotate | Confirmado: 50 MB / retain 7 / compress | activo |

## Backup unificado

### Script e cron

- Script: `/usr/local/bin/backup-blackhouse.sh`
- Compat: `/usr/local/bin/backup-db.sh` → chama o unificado
- Cron: `0 2 * * * /usr/local/bin/backup-blackhouse.sh >> /var/log/backup-blackhouse.log 2>&1`
- Destinos:
  - BD: `/var/backups/blackhouse/db/backup_YYYYMMDD_HHMMSS.sql.gz` (retenção **14 dias**)
  - Uploads: `/var/backups/blackhouse/uploads/storage_*.tar.gz` (retenção **7 dias**)
  - Cópia espelho dos dumps também em `/var/backups/postgresql/` (compat)

### Corrida manual (2026-07-25)

```
DB:      /var/backups/blackhouse/db/backup_20260725_151434.sql.gz   (~4.3M)
Uploads: /var/backups/blackhouse/uploads/storage_20260725_151434.tar.gz (~158M)
```

### Restore — PostgreSQL

```bash
# Atenção: destrutivo se recriar a BD. Preferir restore numa BD de teste primeiro.
gunzip -c /var/backups/blackhouse/db/backup_YYYYMMDD_HHMMSS.sql.gz \
  | sudo -u postgres psql -d blackhouse_db
```

### Restore — uploads

```bash
cd /root/server
# Extrai pasta `storage/` no cwd do parent (cuidado: sobrescreve)
tar -xzf /var/backups/blackhouse/uploads/storage_YYYYMMDD_HHMMSS.tar.gz
# Se extrair noutro sítio:
# tar -xzf ... -C /root/server
```

### Off-box (próximo passo)

Backups estão **só neste VPS**. Quando houver bucket (S3/R2/B2):

```bash
# Exemplo com rclone (após `rclone config`)
rclone copy /var/backups/blackhouse remote:blackhouse-backups/$(hostname)/
```

## Object storage (preparação — sem cutover)

| Peça | Path |
|------|------|
| Service | [`server/services/storage.service.js`](../../server/services/storage.service.js) |
| Rotas | [`server/routes/uploads.js`](../../server/routes/uploads.js) — usam o service |
| Sync one-shot | [`server/scripts/sync-storage-to-s3.js`](../../server/scripts/sync-storage-to-s3.js) |

### Driver actual

`STORAGE_DRIVER=fs` (default) — ficheiros em `/root/server/storage/`. URLs da API inalteradas: `/api/uploads/storage/...`.

### Activar S3 no futuro

1. Criar bucket S3-compatible.
2. Em `server/.env`:

```env
STORAGE_DRIVER=s3
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://...   # R2/MinIO; omitir para AWS
S3_REGION=auto
S3_FORCE_PATH_STYLE=true  # tipicamente MinIO
```

3. Instalar SDK: `cd server && npm i @aws-sdk/client-s3`
4. Migrar ficheiros existentes: `node server/scripts/sync-storage-to-s3.js`
5. `pm2 restart blackhouse-api --update-env`

**Postgres continua neste VPS** (68 MB) — não vale a pena separar host nesta fase.

## Decisões

- Não apagámos `.cursor-server` / `.worktrees` / cache npm (IDE em uso).
- Separação de BD para outro servidor: fora de escopo até haver necessidade real.
