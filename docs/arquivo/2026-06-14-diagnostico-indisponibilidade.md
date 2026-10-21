# Diagnóstico de indisponibilidade — Black House VPS

**Data:** 2026-06-14  
**Host:** `blackhouse-app.vps-kinghost.net` (KingHost VPS, Xen)

## Resumo executivo

O servidor ficou **indisponível entre ~00:27 do 13/06 e o reboot manual/provedor às 19:11 do 14/06** (~43 horas). A causa raiz do **hang** foi **I/O de disco bloqueado** (kernel hung tasks em `ext4_sync_file`), não OOM nem falha de aplicação isolada. Após o reboot, a API subiu via PM2 mas ficou **degradada** por conflito PostgreSQL 12/15 e senha `app_user` desincronizada.

## Evidências coletadas

| Verificação | Resultado |
|-------------|-----------|
| `uptime` | Reboot em 14/06 19:11; uptime ~12 min no momento do diagnóstico |
| `journalctl --list-boots` | Boot anterior: 17/05 → 13/06 00:27:29 |
| `last reboot` | Único reboot recente: 14/06 19:11 |
| OOM Killer | **Não detectado** nos logs |
| Swap | **0 B** — sem proteção contra pico de RAM |
| Disco `/` | 29% usado — sem saturação de espaço |
| `systemctl --failed` | `postgresql@15-main` (conflito porta 5432 com PG12) |
| Nginx | Active, enabled |
| PM2 | Active, `blackhouse-api` online |
| Docker | **Não instalado** em produção |
| MySQL / Redis | **Não presentes** |
| Unattended upgrades | `Automatic-Reboot` desabilitado (comentado) |

## Causa raiz do hang (13/06 00:27)

Logs do kernel no final do boot anterior:

```
INFO: task systemd-journal blocked for more than 120 seconds
wait_on_page_writeback → ext4_sync_file → vfs_fsync_range
```

Interpretação: o **journald ficou bloqueado em fsync do ext4** por mais de 120s. Isso indica **degradação ou contenção de I/O no volume** (`/dev/xvda2`), típico de:

1. Hypervisor/provedor com storage lento ou instável (VPS Xen KingHost)
2. Saturação de I/O sem espaço em disco (espaço OK neste caso)
3. VM suspensa ou migrada pelo provedor sem shutdown limpo

Não há evidência de reboot automático por `unattended-upgrades` nem de OOM killer.

## Causa da API degradada após reboot

1. **PostgreSQL 15** tentou iniciar no boot e falhou — porta 5432 já usada pelo **PostgreSQL 12** (cluster ativo de produção).
2. Senha de `app_user` no PG12 não correspondia ao `DB_PASSWORD` em `server/.env` → `/health` retornava `status: degraded`.

**Correção aplicada:** `ALTER USER app_user` sincronizado; PG15 **masked**; health retorna `ok`.

## Riscos residuais

- Sem swap em VPS 3.8 GB RAM
- Nginx `Restart=no` (corrigido via drop-in)
- PM2 `Restart=on-failure` (corrigido via drop-in `always`)
- Sem monitoramento externo até Telegram configurado
- Dependência de reboot manual após hang de I/O

## Próximos passos recomendados (provedor)

- Abrir ticket KingHost sobre I/O hang em 13/06 00:27
- Solicitar verificação de saúde do volume `/dev/xvda2`
- Considerar monitoramento externo (UptimeRobot, etc.) além do watchdog local
