# Checklist operacional — Black House VPS

Use após **deploy**, **reboot** ou **incidente**.

## Boot automático

- [ ] `systemctl is-enabled nginx` → enabled
- [ ] `systemctl is-enabled pm2-root` → enabled
- [ ] `systemctl is-enabled postgresql@15-main` → enabled
- [ ] Apenas cluster **15** em `pg_lsclusters` (sem PG12)
- [ ] `systemctl is-enabled blackhouse-watchdog.timer` → enabled
- [ ] `swapon --show` → swap ativo (2G recomendado)

## Serviços em execução

```bash
systemctl status nginx pm2-root postgresql@15-main --no-pager
pm2 list
systemctl --failed
```

- [ ] Nginx: active
- [ ] PM2: active, `blackhouse-api` online
- [ ] PostgreSQL 15: active
- [ ] Sem units failed

## Portas

```bash
ss -tlnp | grep -E ':80|:443|:3001|:5432'
```

- [ ] 80, 443 (nginx)
- [ ] 3001 (API)
- [ ] 5432 (postgres, localhost)

## Health checks

```bash
curl -s http://127.0.0.1:3001/health | jq .
curl -sk -H "Host: api.blackhouse.app.br" https://127.0.0.1/health | jq .
curl -sk -H "Host: blackhouse.app.br" https://127.0.0.1/ -o /dev/null -w "%{http_code}\n"
```

- [ ] API direct: `status: ok`, `schema.valid: true`
- [ ] API via nginx: HTTP 200
- [ ] Frontend via nginx: HTTP 200

## Monitoramento

- [ ] `/etc/blackhouse/monitoring.env` configurado (Telegram)
- [ ] `systemctl status blackhouse-watchdog.timer` → active
- [ ] `tail -20 /var/log/blackhouse/watchdog.log` → checks OK

## Recursos

```bash
free -h && df -h / && uptime
```

- [ ] RAM available > 500 MB
- [ ] Disco `/` < 85%
- [ ] Load average razoável

## Deploy rápido (referência)

```bash
cd /root && npm run build
rsync -a dist/ /var/www/blackhouse/dist/
pm2 restart blackhouse-api
nginx -t && systemctl reload nginx
```

## PM2 persistência

```bash
pm2 save
```

Após alterar processos PM2, sempre `pm2 save`.
