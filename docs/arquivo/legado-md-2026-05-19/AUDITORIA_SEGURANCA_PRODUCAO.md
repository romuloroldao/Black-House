# 🔒 Auditoria de Segurança e Produção - Black House Platform

**Data**: 12 de Janeiro de 2026  
**Status**: 🟡 **AUDITORIA COMPLETA - CORREÇÕES NECESSÁRIAS**

---

## 🔍 1. Security Audit Findings

### 🔴 Crítico

#### 1.1 JWT Security Issues
**Problemas Encontrados**:
- ✅ Expiração configurada (7 dias) - **OK**
- ❌ Sem refresh token mechanism
- ❌ Sem validação de expiração em WebSocket após conexão
- ❌ JWT_SECRET pode estar fraco (verificar no .env)

**Risco**: Tokens podem ser usados indefinidamente se não expirarem ou se forem comprometidos.

#### 1.2 Rate Limiting Ausente
**Problemas Encontrados**:
- ❌ Nenhum rate limiting implementado
- ❌ Endpoints públicos (auth, webhooks) vulneráveis a brute force
- ❌ Sem proteção contra DDoS

**Risco**: Ataques de força bruta, DDoS, abuso de API.

#### 1.3 Webhook Security
**Problemas Encontrados**:
- ✅ Validação de token implementada
- ❌ Sem IP allowlist
- ❌ Sem rate limiting específico
- ❌ Sem validação de payload size

**Risco**: Webhooks falsos, ataques de injeção.

#### 1.4 Secrets Management
**Problemas Encontrados**:
- ⚠️ .env no repositório (verificar .gitignore)
- ❌ Sem rotação de secrets
- ❌ Sem validação de secrets na inicialização

**Risco**: Exposição de credenciais.

### 🟡 Importante

#### 1.5 Logging
**Problemas Encontrados**:
- ❌ Logs não estruturados
- ❌ Sem rotação de logs
- ❌ Logs podem conter informações sensíveis
- ❌ Sem níveis de log (info, warn, error)

**Risco**: Dificuldade de debugging, exposição de dados.

#### 1.6 Error Handling
**Problemas Encontrados**:
- ⚠️ Alguns erros expõem stack traces
- ❌ Sem tratamento centralizado de erros
- ❌ Sem sanitização de mensagens de erro

**Risco**: Exposição de informações do sistema.

#### 1.7 Database Connection Pooling
**Problemas Encontrados**:
- ⚠️ Pool padrão do pg (10 conexões)
- ❌ Sem configuração explícita de limites
- ❌ Sem monitoramento de conexões

**Risco**: Exaustão de conexões, degradação de performance.

### 🟢 Melhorias

#### 1.8 Healthcheck
**Status**: ✅ Básico implementado  
**Melhorias**: Adicionar checks de banco, WebSocket, jobs.

#### 1.9 Graceful Shutdown
**Status**: ❌ Não implementado  
**Risco**: Perda de requisições em andamento.

#### 1.10 CORS Configuration
**Status**: ✅ Configurado  
**Melhorias**: Adicionar CSRF protection.

---

## 🛡️ 2. Required Hardening Changes

### 2.1 Rate Limiting

**Implementar**:
- `express-rate-limit` para endpoints públicos
- Rate limiting diferenciado por endpoint
- IP-based rate limiting para webhooks

**Configuração**:
```javascript
// Auth endpoints: 5 tentativas por 15 minutos
// API endpoints: 100 requisições por minuto
// Webhooks: 10 requisições por minuto por IP
```

### 2.2 Webhook Security Hardening

**Implementar**:
- IP allowlist (opcional, se Asaas fornecer IPs)
- Validação de payload size (max 1MB)
- Timeout de processamento (30s)
- Retry logic com backoff

### 2.3 JWT Improvements

**Implementar**:
- Refresh token mechanism
- Validação periódica de token em WebSocket
- Blacklist de tokens revogados (opcional)
- Verificação de força do JWT_SECRET na inicialização

### 2.4 Structured Logging

**Implementar**:
- Winston ou Pino para logging estruturado
- Níveis de log (error, warn, info, debug)
- Formato JSON para produção
- Rotação de logs (logrotate)

### 2.5 Error Handling

**Implementar**:
- Error handler centralizado
- Sanitização de mensagens de erro
- Logging de erros sem stack trace em produção
- Códigos de erro padronizados

### 2.6 Healthcheck Enhancement

**Implementar**:
- `/health` - Básico (já existe)
- `/health/detailed` - Banco, WebSocket, Jobs
- `/health/ready` - Pronto para receber tráfego
- `/health/live` - Aplicação está viva

### 2.7 Graceful Shutdown

**Implementar**:
- Handler para SIGTERM/SIGINT
- Fechar conexões do banco
- Finalizar jobs em execução
- Fechar servidor HTTP/WebSocket

### 2.8 Connection Pooling

**Implementar**:
- Configuração explícita de pool
- Monitoramento de conexões ativas
- Timeout de conexão
- Retry logic

---

## ✅ 3. Production Configuration Checklist

### Variáveis de Ambiente Obrigatórias

```env
# Segurança
JWT_SECRET=<64+ caracteres aleatórios>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
ENABLE_WEBSOCKET=true
ENABLE_JOBS=true

# Asaas
ASAAS_API_KEY=<chave_produção>
ASAAS_ENVIRONMENT=production
ASAAS_WEBHOOK_TOKEN=<token_aleatório_forte>
ASAAS_WEBHOOK_IP_WHITELIST=<opcional, IPs do Asaas>

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_AUTH_WINDOW=900000  # 15 minutos
RATE_LIMIT_API_MAX=100
RATE_LIMIT_API_WINDOW=60000    # 1 minuto

# Database
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=/var/log/blackhouse-api/app.log

# Timeouts
HTTP_TIMEOUT=30000
ASAAS_TIMEOUT=10000
```

### Secrets Validation

Adicionar validação na inicialização:
- JWT_SECRET mínimo 32 caracteres
- ASAAS_API_KEY presente se necessário
- DB_PASSWORD presente

---

## 🌐 4. Suggested Nginx Configuration

### Melhorias de Segurança

```nginx
# Rate limiting no Nginx (camada adicional)
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=10r/m;

# Bloquear métodos não permitidos
if ($request_method !~ ^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$) {
    return 405;
}

# Headers de segurança adicionais
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;

# Ocultar versão do Nginx
server_tokens off;

# Timeouts
proxy_connect_timeout 30s;
proxy_send_timeout 30s;
proxy_read_timeout 30s;
```

---

## 💾 5. Backup and Disaster Recovery Plan

### Estratégia de Backup

#### 5.1 Database Backup
**Frequência**: Diário (2h da manhã)  
**Retenção**: 30 dias  
**Localização**: `/var/backups/blackhouse/db/`

**Script**:
```bash
#!/bin/bash
# /usr/local/bin/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/blackhouse/db"
DB_NAME="blackhouse_db"
DB_USER="app_user"

mkdir -p $BACKUP_DIR

# Backup completo
pg_dump -U $DB_USER -d $DB_NAME -F c -f $BACKUP_DIR/backup_$DATE.dump

# Manter apenas últimos 30 dias
find $BACKUP_DIR -name "backup_*.dump" -mtime +30 -delete

# Backup de schema apenas (sem dados)
pg_dump -U $DB_USER -d $DB_NAME -s -f $BACKUP_DIR/schema_$DATE.sql
```

#### 5.2 File Storage Backup
**Frequência**: Semanal  
**Retenção**: 4 semanas  
**Método**: rsync ou tar

#### 5.3 Configuration Backup
**Frequência**: Semanal  
**Conteúdo**: .env, nginx config, systemd service

### Disaster Recovery

**RTO (Recovery Time Objective)**: 4 horas  
**RPO (Recovery Point Objective)**: 24 horas

**Procedimento**:
1. Restaurar banco do último backup
2. Restaurar arquivos de storage
3. Restaurar configurações
4. Verificar integridade
5. Reiniciar serviços

---

## 📊 6. Monitoring and Logs Strategy

### 6.1 Structured Logging

**Formato JSON**:
```json
{
  "timestamp": "2026-01-12T10:30:00Z",
  "level": "info",
  "service": "api",
  "requestId": "req_123",
  "method": "POST",
  "path": "/api/payments/create-asaas",
  "userId": "user_456",
  "duration": 234,
  "statusCode": 200
}
```

### 6.2 Log Levels

- **ERROR**: Erros que requerem atenção imediata
- **WARN**: Avisos, mas sistema continua funcionando
- **INFO**: Informações importantes (requests, jobs)
- **DEBUG**: Debug detalhado (apenas em desenvolvimento)

### 6.3 Log Rotation

**logrotate config** (`/etc/logrotate.d/blackhouse-api`):
```
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
```

### 6.4 Monitoring Metrics

**Métricas a coletar**:
- Requests por segundo
- Latência (p50, p95, p99)
- Taxa de erro
- Conexões ativas do banco
- Jobs executados/falhados
- WebSocket connections ativas

---

## ✅ 7. Final Production Readiness Checklist

### Segurança
- [ ] Rate limiting implementado
- [ ] Webhook security hardened
- [ ] JWT_SECRET forte (64+ caracteres)
- [ ] Secrets não commitados
- [ ] HTTPS configurado (Let's Encrypt)
- [ ] CORS configurado corretamente
- [ ] Headers de segurança no Nginx

### Observabilidade
- [ ] Logging estruturado implementado
- [ ] Healthcheck endpoints funcionando
- [ ] Log rotation configurado
- [ ] Métricas básicas coletadas

### Confiabilidade
- [ ] Graceful shutdown implementado
- [ ] Connection pooling configurado
- [ ] Retry logic para APIs externas
- [ ] Timeouts configurados
- [ ] Jobs idempotentes

### Backup e Recuperação
- [ ] Backup automático do banco configurado
- [ ] Backup de arquivos configurado
- [ ] Procedimento de restore testado
- [ ] Documentação de DR criada

### Infraestrutura
- [ ] Systemd service configurado
- [ ] Nginx configurado e testado
- [ ] Firewall configurado
- [ ] Monitoramento básico ativo

---

**Próximos passos**: Implementar correções identificadas nesta auditoria.

**Última atualização**: 12 de Janeiro de 2026
