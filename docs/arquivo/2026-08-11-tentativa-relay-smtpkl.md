# Tentativa relay Postfix → KingHost SMTP Transacional (smtpkl)

**Data:** 2026-08-11  
**Estado:** Credenciais AUTH OK; **envio bloqueado** por From não autorizado. Relay **revertido** para Resend.

## O que funcionou

- Host: `kinghost.smtpkl.com.br`
- Portas: **465** (SSL) e **587** (STARTTLS) — ambas autenticam
- User: ID smtpkl (guardado em `/opt/blackhouse-smtp/credentials-smtpkl.env`, mode 600)

```text
App → Postfix 127.0.0.1:587 → kinghost.smtpkl.com.br:465  (AUTH OK)
```

## O que falhou

Resposta do servidor ao `RCPT TO`:

```text
525 5.7.13 Este remetente nao-responda@blackhouse.app.br
nao tem permissao para enviar e-mails.
```

Vários From foram testados (`nao-responda@`, `contato@`, `blackhouse@`, etc.) — **todos** rejeitados.  
No painel do **SMTP Transacional** KingHost é preciso **autorizar o domínio / remetente** (ex. `nao-responda@blackhouse.app.br` ou `@blackhouse.app.br`) antes de cortar a Resend.

## Acções nesta VPS

1. Backup pré-troca: `/backup/smtp/2026-08-11-pre-smtpkl-*`
2. `migrate-relay-to-kinghost.sh --host kinghost.smtpkl.com.br --port 465` aplicado
3. Bounce confirmado no `mail.log`
4. **Rollback** para `[smtp.resend.com]:465` — envio de verificação `status=sent` novamente

## Reaplicar quando o From estiver liberado

```bash
set -a; source /opt/blackhouse-smtp/credentials-smtpkl.env; set +a
KH_TEST_TO='teu@email.com' \
  /opt/blackhouse-smtp/migrate-relay-to-kinghost.sh \
    --user "$KH_SMTP_USER" --pass "$KH_SMTP_PASS" \
    --host "$KH_SMTP_HOST" --port "$KH_SMTP_PORT" \
    --from "$KH_FROM" --test-to "$KH_TEST_TO"
```

Validar no `mail.log`: `relay=kinghost.smtpkl.com.br` + `status=sent`.  
Só então cancelar a conta Resend.

Rollback: restaurar backup `2026-08-11-pre-smtpkl-*` ou `/opt/blackhouse-smtp/rollback-relay-resend.sh`.
