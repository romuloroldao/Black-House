# Plano de recuperação de desastre — Black House

**Versão:** 2026-06-14  
**RTO objetivo:** < 30 minutos  
**RPO objetivo:** último backup PostgreSQL (diário recomendado)

## Escopo

Stack em produção na VPS KingHost:

- Nginx (80/443) → frontend estático + proxy API
- PM2 → `blackhouse-api` (Node, porta 3001)
- PostgreSQL 12 (`blackhouse_db`, usuário `app_user`)
- Sem Docker em produção

## Cenários e procedimentos

### 1. Servidor não responde (SSH/HTTP)

1. Painel KingHost → verificar status da VM
2. Se VM suspensa/travada → **reboot via painel**
3. Após boot, verificar:
   ```bash
   systemctl status nginx pm2-root postgresql@15-main
   pm2 list
   curl -s http://127.0.0.1:3001/health
   ```
4. Se health ≠ ok → ver cenário 3 ou 4

### 2. Hang de I/O (servidor vivo mas sem resposta)

Sintomas: SSH lento, `systemd-journal` hung, load alto, sem OOM.

1. Reboot via painel do provedor (não aguardar indefinidamente)
2. Após reboot, executar checklist operacional
3. Reportar incidente ao provedor com timestamp do hang

### 3. API down (Nginx OK, health falha)

```bash
pm2 logs blackhouse-api --lines 50
pm2 restart blackhouse-api
# Se persistir:
systemctl restart postgresql@15-main
pm2 restart blackhouse-api
/opt/blackhouse/ops/watchdog.sh
```

### 4. PostgreSQL down ou auth failure

```bash
systemctl status postgresql@15-main
sudo -u postgres psql -c "SELECT 1"
# Senha desincronizada:
PASS=$(grep '^DB_PASSWORD=' /root/server/.env | cut -d= -f2- | sed 's/^"//;s/"$//')
sudo -u postgres psql -c "ALTER USER app_user WITH PASSWORD '$PASS';"
systemctl restart postgresql@15-main
pm2 restart blackhouse-api
```

**Não** reinstalar PostgreSQL 12 neste servidor — produção é exclusivamente PG15.

### 5. Nginx down

```bash
nginx -t
systemctl restart nginx
tail -50 /var/log/nginx/blackhouse-error.log
```

### 6. Perda total da VPS

1. Provisionar nova VPS Ubuntu 20.04+
2. Restaurar DNS (Cloudflare) apontando ao novo IP
3. Clonar repositório, `deployment/install.sh`
4. Restaurar backup PostgreSQL: `server/scripts/backup-db.sh` (inverso)
5. Copiar `server/.env` e `.env` frontend de backup seguro
6. `npm run build` + deploy em `/var/www/blackhouse`
7. `bash deployment/ops/setup-ops.sh`
8. `certbot --nginx` se necessário

## Backups

| Recurso | Local | Frequência recomendada |
|---------|-------|------------------------|
| PostgreSQL | `/var/backups/postgresql/` | Diário (cron) |
| `server/.env` | Backup off-site criptografado | Após cada alteração |
| Frontend build | Git + `/var/www/blackhouse/dist` | Após cada deploy |

Comando backup manual:

```bash
cd /root/server && bash scripts/backup-db.sh
```

## Contatos e dependências

- **Provedor:** KingHost VPS
- **DNS/CDN:** Cloudflare (`blackhouse.app.br`, `api.blackhouse.app.br`)
- **Alertas:** Telegram (`/etc/blackhouse/monitoring.env`)

## Validação post-recuperação

```bash
curl -s https://api.blackhouse.app.br/health | jq .
curl -sI https://blackhouse.app.br | head -5
systemctl --failed
pm2 list
```

Todos devem retornar healthy / sem failed units.
