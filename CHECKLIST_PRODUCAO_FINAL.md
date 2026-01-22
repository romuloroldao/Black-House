# ✅ Checklist Final de Produção - Black House Platform

**Data**: 12 de Janeiro de 2026  
**Status**: 🟡 **PRONTO PARA PRODUÇÃO** (após completar checklist)

---

## 🔒 Segurança

### Autenticação e Autorização
- [x] JWT com expiração configurada (7 dias)
- [x] Validação de JWT em API e WebSocket
- [x] Secrets validation na inicialização
- [x] Password hashing com bcrypt
- [ ] **TODO**: Implementar refresh tokens
- [ ] **TODO**: Implementar blacklist de tokens revogados

### Rate Limiting
- [x] Rate limiting para autenticação (5 req / 15 min)
- [x] Rate limiting para API (100 req / min)
- [x] Rate limiting para webhooks (10 req / min)
- [x] Rate limiting para uploads (10 / hora)
- [x] Rate limiting no Nginx (camada adicional)

### Webhook Security
- [x] Validação de token (timing-safe)
- [x] Validação de tamanho de payload (max 1MB)
- [x] Validação de IP (whitelist opcional)
- [x] Rate limiting específico
- [x] Auditoria de eventos

### Headers de Segurança
- [x] Helmet configurado
- [x] CORS configurado
- [x] Security headers no Nginx
- [ ] **TODO**: CSRF protection (se necessário)

---

## 📊 Observabilidade

### Logging
- [x] Structured logging com Winston
- [x] Logs em JSON (produção)
- [x] Logs separados (app, error, exceptions)
- [x] Request logging
- [x] WebSocket logging
- [x] Job logging
- [x] Log rotation configurado

### Health Checks
- [x] `/health` - Básico
- [x] `/health/detailed` - Detalhado
- [x] `/health/ready` - Readiness
- [x] `/health/live` - Liveness

### Monitoramento
- [ ] **TODO**: Configurar alertas básicos
- [ ] **TODO**: Dashboard de métricas (opcional)

---

## 🔄 Confiabilidade

### Error Handling
- [x] Error handler centralizado
- [x] Sanitização de erros em produção
- [x] Logging de erros
- [x] Códigos de erro padronizados

### Timeouts
- [x] Timeout em chamadas HTTP (Asaas: 10s)
- [x] Timeout em queries do banco (30s)
- [x] Timeout no Nginx (30s)

### Retry Logic
- [ ] **TODO**: Retry para chamadas Asaas (com backoff)
- [ ] **TODO**: Circuit breaker (opcional)

### Graceful Shutdown
- [x] Handler para SIGTERM/SIGINT
- [x] Fechar conexões do banco
- [x] Fechar WebSocket
- [x] Parar jobs
- [x] Timeout de 30s

### Connection Pooling
- [x] Pool configurado (min: 2, max: 20)
- [x] Timeouts configurados
- [x] Statement timeout
- [ ] **TODO**: Monitoramento de conexões ativas

### Jobs Idempotência
- [x] Proteção contra execução simultânea
- [x] Logging detalhado
- [x] Tratamento de erros
- [x] Flags de controle (reminder_sent, etc)

---

## 💾 Backup e Recuperação

### Backup Automático
- [x] Script de backup criado
- [ ] **TODO**: Configurar crontab (0 2 * * *)
- [ ] **TODO**: Testar restore
- [ ] **TODO**: Backup de arquivos (storage)

### Estratégia de Backup
- [x] Backup diário do banco
- [x] Retenção de 30 dias
- [x] Compressão automática
- [ ] **TODO**: Backup offsite (opcional)

---

## 🌐 Infraestrutura

### Nginx
- [x] Configuração hardened
- [x] Rate limiting no Nginx
- [x] Security headers
- [x] Timeouts configurados
- [ ] **TODO**: HTTPS/SSL (Let's Encrypt)
- [ ] **TODO**: Firewall (UFW/iptables)

### Systemd
- [x] Service configurado
- [x] Restart automático
- [x] Environment file
- [x] Logs no journald

### Variáveis de Ambiente
- [x] .env configurado
- [x] Secrets validation
- [ ] **TODO**: Verificar .gitignore
- [ ] **TODO**: Documentar todas as variáveis

---

## 📝 Documentação

- [x] Auditoria de segurança
- [x] Guia de instalação
- [x] Documentação de eventos WebSocket
- [x] Documentação de jobs
- [x] Checklist de produção
- [ ] **TODO**: Runbook de operações
- [ ] **TODO**: Procedimento de disaster recovery

---

## 🚀 Deploy Checklist

### Pré-Deploy
- [ ] Gerar JWT_SECRET forte (64+ caracteres)
- [ ] Configurar todas as variáveis de ambiente
- [ ] Executar migrações SQL
- [ ] Testar localmente
- [ ] Verificar logs

### Deploy
- [ ] Instalar dependências (`npm install`)
- [ ] Copiar arquivos para produção
- [ ] Configurar Nginx
- [ ] Configurar Systemd
- [ ] Configurar logrotate
- [ ] Configurar backup (crontab)
- [ ] Reiniciar serviços

### Pós-Deploy
- [ ] Verificar health checks
- [ ] Testar autenticação
- [ ] Testar WebSocket
- [ ] Testar webhook (simulado)
- [ ] Verificar logs
- [ ] Monitorar por 24h

---

## ⚠️ Ações Críticas Antes de Produção

1. **Gerar JWT_SECRET forte**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Configurar HTTPS**:
   ```bash
   sudo certbot --nginx -d api.blackhouse.app.br
   ```

3. **Configurar Firewall**:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

4. **Verificar .gitignore**:
   - Garantir que `.env` está ignorado
   - Garantir que logs não são commitados

5. **Testar Backup e Restore**:
   ```bash
   # Backup
   /var/www/blackhouse/server/scripts/backup-db.sh
   
   # Testar restore em banco de teste
   ```

---

## 📊 Métricas de Sucesso

Após deploy, monitorar:
- Taxa de erro < 1%
- Latência p95 < 500ms
- Uptime > 99.9%
- Jobs executando sem erros
- Webhooks processados corretamente
- WebSocket connections estáveis

---

**Última atualização**: 12 de Janeiro de 2026
