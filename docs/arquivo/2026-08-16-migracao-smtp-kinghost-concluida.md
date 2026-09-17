# Migração SMTP: Resend → KingHost smtpkl (Concluída)

**Data:** 2026-08-16  
**Estado:** ✅ Produção

## Resumo

Migração do relay SMTP da Resend para o KingHost SMTP Transacional (smtpkl), incluindo sistema de fila persistente para garantir que nenhum e-mail seja perdido.

## Alterações

### 1. Sistema de Fila de E-mails (novo)

Tabela `email_queue` no PostgreSQL com:
- Persistência de todos os e-mails antes do envio
- Retry automático com backoff exponencial (5 tentativas: 0s → 30s → 2min → 10min → 1h)
- Status: `pending` → `processing` → `sent` | `failed` → `dead`
- Job processa a fila a cada 30 segundos
- Cleanup automático de e-mails enviados (>30 dias) às 4h

Ficheiros criados:
- `server/utils/email-queue.js` — módulo de fila
- `server/jobs/email-queue.job.js` — job de processamento
- Tabela `email_queue` no schema PostgreSQL

### 2. Relay Postfix

```
ANTES: App → Postfix 127.0.0.1:587 → smtp.resend.com:465
AGORA: App → Postfix 127.0.0.1:587 → kinghost.smtpkl.com.br:465
```

Credenciais em `/opt/blackhouse-smtp/credentials-smtpkl.env` (mode 600).

### 3. Remetente (From)

```
ANTES: nao-responda@blackhouse.app.br
AGORA: no-reply@no-reply.blackhouse.app.br
```

O domínio verificado no smtpkl é o **subdomínio** `no-reply.blackhouse.app.br`, por isso o From tem de ser desse domínio.

### 4. Configuração (.env)

```bash
AUTOMATED_EMAIL_FROM="Black House <no-reply@no-reply.blackhouse.app.br>"
SMTP_FROM="Black House <no-reply@no-reply.blackhouse.app.br>"
```

## Fluxo de Envio

1. Chamada a `sendTransactionalEmail()` → e-mail adicionado à fila (`pending`)
2. Job `EmailQueueJob` (cada 30s) processa a fila
3. `sendEmailDirect()` envia via Postfix local → relay KingHost
4. Sucesso → status `sent`; Falha → retry com backoff ou `dead` após 5 tentativas

## Verificação

```bash
# Verificar relay actual
postconf -h relayhost
# [kinghost.smtpkl.com.br]:465

# Verificar últimos envios
grep "status=sent" /var/log/mail.log | tail -5

# Verificar fila de e-mails
psql -c "SELECT status, COUNT(*) FROM email_queue GROUP BY status;"
```

## Rollback

```bash
# Voltar para Resend
/opt/blackhouse-smtp/rollback-relay-resend.sh

# Restaurar .env com From antigo
AUTOMATED_EMAIL_FROM="Black House <nao-responda@blackhouse.app.br>"
SMTP_FROM="Black House <nao-responda@blackhouse.app.br>"

pm2 restart blackhouse-api --update-env
```

## Próximos passos (opcional)

- Cancelar conta Resend após confirmar estabilidade (1-2 semanas)
- Se quiser From `no-reply@blackhouse.app.br` (apex), cadastrar e verificar `blackhouse.app.br` no painel smtpkl

## Ficheiros modificados

- `server/.env` — novo From
- `server/utils/send-transactional-email.js` — usa fila em vez de envio directo
- `server/utils/email-queue.js` — novo
- `server/jobs/email-queue.job.js` — novo
- `server/jobs/index.js` — regista EmailQueueJob
- `server/index.js` — inicializa pool da fila
- `schema_adaptado_postgres.sql` — tabela email_queue
- `/etc/postfix/main.cf` — relayhost KingHost
- `/etc/postfix/sasl_passwd` — credenciais smtpkl
