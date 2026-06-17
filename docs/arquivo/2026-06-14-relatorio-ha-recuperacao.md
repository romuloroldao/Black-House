# Relatório final — HA e recuperação automática Black House

**Data:** 2026-06-14  
**Ambiente:** VPS KingHost `blackhouse-app.vps-kinghost.net`

## O que foi investigado

Diagnóstico completo conforme Fase 1: uptime, reboots, journal anterior, kernel/dmesg, memória, disco, systemd failed, Nginx, PM2, PostgreSQL, unattended-upgrades.

**Conclusão:** indisponibilidade causada por **hang de I/O no disco** (kernel hung tasks em ext4) em 13/06 ~00:27, com VM possivelmente offline até reboot em 14/06 19:11. Após reboot, API degradada por **senha PostgreSQL desincronizada** e cluster PG15 conflitando com PG12.

## O que foi corrigido imediatamente

| Item | Ação |
|------|------|
| PostgreSQL auth | `ALTER USER app_user` alinhado com `server/.env` |
| PG15 conflito | `systemctl mask postgresql@15-main` |
| API health | `status: ok`, schema válido após restart PM2 |
| PM2 dump | `pm2 save` executado |

## O que foi implementado

### Scripts (`deployment/ops/` → `/opt/blackhouse/ops/`)

| Arquivo | Função |
|---------|--------|
| `watchdog.sh` | Monitora CPU/RAM/disco, portas, HTTP, PG, PM2; reinicia serviços; log |
| `telegram-alert.sh` | Alertas Telegram com cooldown 5 min |
| `setup-ops.sh` | Instalador master |
| `setup-swap.sh` | Swap 2 GB + `vm.swappiness=10` |
| `ecosystem.config.cjs` | PM2 produção documentado |
| `monitoring.env.example` | Template Telegram |

### Systemd

| Unit | Configuração |
|------|----------------|
| `blackhouse-watchdog.timer` | Execução a cada 1 minuto |
| `blackhouse-watchdog.service` | Oneshot → `watchdog.sh` |
| `nginx.service.d/restart.conf` | `Restart=always` |
| `pm2-root.service.d/restart.conf` | `Restart=always` |

### Políticas de restart existentes

- **PM2 app:** `autorestart: true`, `max_memory_restart: 500M`
- **PostgreSQL 12:** enabled via systemd
- **Nginx:** enabled; agora também `Restart=always`
- **Docker:** não aplicável (não instalado em prod)

### Alertas (Telegram)

Configurar em `/etc/blackhouse/monitoring.env`:

```bash
TELEGRAM_BOT_TOKEN=<do @BotFather>
TELEGRAM_CHAT_ID=<id do chat>
```

Alertas para: CPU >90%, RAM >90%, disco >85%, portas down, HTTP/health falha, PostgreSQL, PM2.

### Auto-start após reboot

Ordem de boot garantida:

1. `postgresql@12-main`
2. `pm2-root` → `pm2 resurrect` → `blackhouse-api`
3. `nginx`
4. `blackhouse-watchdog.timer` (checks após 2 min)

## Instalação / reinstalação

```bash
chmod +x /root/deployment/ops/*.sh
sudo bash /root/deployment/ops/setup-ops.sh
# Editar Telegram:
sudo nano /etc/blackhouse/monitoring.env
# Testar:
sudo /opt/blackhouse/ops/watchdog.sh
```

## Documentação entregue

1. `docs/arquivo/2026-06-14-diagnostico-indisponibilidade.md`
2. `docs/arquivo/2026-06-14-plano-recuperacao-desastre.md`
3. `docs/arquivo/2026-06-14-checklist-operacional-ha.md`
4. Este relatório

## Pendências do operador

1. **Configurar Telegram** em `/etc/blackhouse/monitoring.env`
2. **Ticket KingHost** sobre I/O hang em 13/06
3. **Monitoramento externo** (UptimeRobot/ping) — recomendado como camada extra
4. **Backup cron** PostgreSQL se ainda não automatizado
5. Considerar migrar PG12 → PG15 com plano de migração (não apenas desabilitar PG15)

## Estado atual (post-implementação)

Executar checklist em `docs/arquivo/2026-06-14-checklist-operacional-ha.md` após cada reboot.
