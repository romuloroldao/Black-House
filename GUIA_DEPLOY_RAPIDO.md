# 🚀 Guia Rápido de Deploy - Correções de Segurança

**Data**: 12 de Janeiro de 2026

---

## ⚡ Deploy Automatizado (Recomendado)

Execute o script de deploy automatizado:

```bash
sudo /root/deploy-seguranca.sh
```

O script irá:
1. ✅ Criar backup automático
2. ✅ Copiar todos os arquivos novos
3. ✅ Instalar dependências
4. ✅ Executar migrações SQL
5. ✅ Criar diretórios necessários
6. ✅ Configurar logrotate
7. ✅ Validar configuração
8. ✅ Reiniciar serviço
9. ✅ Verificar status

---

## 📋 Deploy Manual (Passo a Passo)

Se preferir fazer manualmente:

### 1. Backup

```bash
cd /var/www/blackhouse/server
sudo tar -czf /var/backups/blackhouse/deploy/backup_$(date +%Y%m%d_%H%M%S).tar.gz .
```

### 2. Copiar Arquivos

```bash
# Criar diretórios
sudo mkdir -p /var/www/blackhouse/server/{services,middleware,jobs,routes,utils,controllers,repositories,migrations,scripts}

# Copiar arquivos (do /root/server para /var/www/blackhouse/server)
sudo cp -r /root/server/services/* /var/www/blackhouse/server/services/
sudo cp -r /root/server/middleware/* /var/www/blackhouse/server/middleware/
sudo cp -r /root/server/jobs/* /var/www/blackhouse/server/jobs/
sudo cp -r /root/server/routes/* /var/www/blackhouse/server/routes/
sudo cp -r /root/server/utils/* /var/www/blackhouse/server/utils/
sudo cp -r /root/server/controllers/* /var/www/blackhouse/server/controllers/
sudo cp -r /root/server/repositories/* /var/www/blackhouse/server/repositories/
sudo cp -r /root/server/migrations/* /var/www/blackhouse/server/migrations/
sudo cp -r /root/server/scripts/* /var/www/blackhouse/server/scripts/
sudo cp /root/server/index.js /var/www/blackhouse/server/
sudo cp /root/server/package.json /var/www/blackhouse/server/

# Ajustar permissões
sudo chown -R www-data:www-data /var/www/blackhouse/server
sudo chmod +x /var/www/blackhouse/server/scripts/*.sh
```

### 3. Instalar Dependências

```bash
cd /var/www/blackhouse/server
sudo -u www-data npm install express-rate-limit winston socket.io node-cron axios
```

### 4. Executar Migrações

```bash
sudo -u postgres psql -d blackhouse_db -f /var/www/blackhouse/server/migrations/add_websocket_and_webhooks.sql
```

### 5. Criar Diretórios

```bash
sudo mkdir -p /var/log/blackhouse-api
sudo mkdir -p /var/backups/blackhouse/db
sudo chown -R www-data:www-data /var/log/blackhouse-api
sudo chown -R www-data:www-data /var/backups/blackhouse
```

### 6. Configurar Logrotate

```bash
sudo tee /etc/logrotate.d/blackhouse-api > /dev/null <<'EOF'
/var/log/blackhouse-api/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload blackhouse-api > /dev/null 2>&1 || true
    endscript
}
EOF
```

### 7. Reiniciar Serviço

```bash
sudo systemctl restart blackhouse-api
sudo systemctl status blackhouse-api
```

---

## ✅ Verificação Pós-Deploy

### 1. Verificar Status do Serviço

```bash
sudo systemctl status blackhouse-api
```

Deve mostrar: `Active: active (running)`

### 2. Verificar Logs

```bash
sudo journalctl -u blackhouse-api -f
```

Procure por:
- ✅ "WebSocket Service inicializado"
- ✅ "Asaas Service inicializado"
- ✅ "Background Jobs inicializados"
- ✅ "Webhook routes configuradas"
- ✅ "API rodando na porta 3001"

### 3. Testar Health Check

```bash
curl http://localhost:3001/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": ...
}
```

### 4. Testar Health Check Detalhado

```bash
curl http://localhost:3001/health/detailed
```

Deve mostrar status de banco, WebSocket, jobs e memória.

### 5. Verificar Dependências

```bash
cd /var/www/blackhouse/server
npm list express-rate-limit winston socket.io node-cron axios
```

Todos devem estar listados.

---

## 🐛 Troubleshooting

### Erro: "Cannot find module 'express-rate-limit'"

**Solução**: Instalar dependências
```bash
cd /var/www/blackhouse/server
sudo -u www-data npm install
```

### Erro: "Table 'notificacoes' does not exist"

**Solução**: Executar migração
```bash
sudo -u postgres psql -d blackhouse_db -f /var/www/blackhouse/server/migrations/add_websocket_and_webhooks.sql
```

### Erro: "JWT_SECRET não configurado"

**Solução**: Configurar no `.env`
```bash
sudo nano /var/www/blackhouse/server/.env
# Adicionar: JWT_SECRET=<seu_secret_forte>
```

### Serviço não inicia

**Solução**: Verificar logs
```bash
sudo journalctl -u blackhouse-api -n 50 --no-pager
```

### Erro de permissão

**Solução**: Ajustar permissões
```bash
sudo chown -R www-data:www-data /var/www/blackhouse/server
sudo chmod +x /var/www/blackhouse/server/scripts/*.sh
```

---

## 📝 Checklist Pós-Deploy

- [ ] Serviço rodando (`systemctl status`)
- [ ] Health check funcionando
- [ ] Logs sem erros críticos
- [ ] Dependências instaladas
- [ ] Migrações executadas
- [ ] Diretórios criados
- [ ] Logrotate configurado
- [ ] Backup funcionando (testar manualmente)

---

## 🎯 Próximos Passos

Após deploy bem-sucedido:

1. **Configurar Backup Automático**:
   ```bash
   crontab -e
   # Adicionar: 0 2 * * * /var/www/blackhouse/server/scripts/backup-db.sh
   ```

2. **Configurar Variáveis de Ambiente** (se necessário):
   - `ASAAS_API_KEY`
   - `ASAAS_WEBHOOK_TOKEN`
   - `ENABLE_WEBSOCKET=true`
   - `ENABLE_JOBS=true`

3. **Testar Funcionalidades**:
   - WebSocket connection
   - Background jobs (verificar logs)
   - Webhook (simulado)

---

**Última atualização**: 12 de Janeiro de 2026
