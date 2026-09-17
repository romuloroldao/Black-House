# SMTPKL — Return Path OK; falta confirmar remetente

**Data:** 2026-08-11  

## Feito nesta VPS

1. Validação API `GET /v1/settings/return_paths/validate` → **status `configured`**, CNAME/DMARC/TXT **valid: true** para `no-reply.blackhouse.app.br`.
2. Credenciais smtpkl guardadas em `/opt/blackhouse-smtp/credentials-smtpkl.env`.
3. Relay **não** migrado (ainda Resend) — envio smtpkl continua `525` até confirmar remetente.

## Bloqueio restante (só no painel)

Mensagem da plataforma:

> Confirme o uso deste remetente em …/panel/settings/emails

No **SMTP Transacional KingHost** (ou SSO Locaweb `smtplw.com.br`):

1. Menu **Configurações** → **E-mails / Remetentes**
2. Adicionar/confirmar: `no-reply@no-reply.blackhouse.app.br`  
   (o domínio verificado é o subdomínio; `no-reply@blackhouse.app.br` só depois de domínio apex ou alias)
3. Avisar — reaplica-se o relay com:

```bash
set -a; source /opt/blackhouse-smtp/credentials-smtpkl.env; set +a
KH_TEST_TO='assessoriablackhouse@gmail.com' \
  /opt/blackhouse-smtp/migrate-relay-to-kinghost.sh \
    --user "$KH_SMTP_USER" --pass "$KH_SMTP_PASS" \
    --host "$KH_SMTP_HOST" --port 465 \
    --from "$KH_FROM" --test-to "$KH_TEST_TO"
```

E actualizar `AUTOMATED_EMAIL_FROM` / `SMTP_FROM` na app para o From confirmado.
