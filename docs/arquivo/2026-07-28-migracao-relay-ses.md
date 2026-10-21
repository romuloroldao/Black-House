# Migração relay Postfix: Resend → Amazon SES

**Data:** 2026-07-28  
**Estado:** Preparado (backup + scripts). **Aguarda credenciais SMTP SES** para aplicar.

## Porquê SES

- App já usa SMTP Black House (`127.0.0.1:587`) — sem mudança de código.
- Porta 25 outbound da VPS está bloqueada → é obrigatório um smart-host em 587/465.
- DNS do domínio já usa AWS: SPF `include:amazonses.com`, MX inbound SES `sa-east-1`.

## Estado actual

```text
App → Postfix local → relayhost smtp.resend.com:465
```

## Alvo

```text
App → Postfix local → relayhost email-smtp.sa-east-1.amazonaws.com:587
```

## Backup

`/backup/smtp/2026-07-28-pre-ses/` (`main.cf`, `sasl_passwd`, `postconf-n.txt`)

## Scripts

| Script | Função |
|--------|--------|
| `/opt/blackhouse-smtp/migrate-relay-to-ses.sh` | Aplica SES |
| `/opt/blackhouse-smtp/rollback-relay-resend.sh` | Volta ao Resend |

### Aplicar (quando tiveres as credenciais)

1. AWS Console → **SES** → região **sa-east-1** → SMTP settings → **Create SMTP credentials**
2. Confirmar identidade `blackhouse.app.br` / `nao-responda@blackhouse.app.br` e saída de sandbox (se ainda estiver)
3. Na VPS:

```bash
SES_SMTP_USER='AKIA...' \
SES_SMTP_PASS='...' \
SES_TEST_TO='teu-email@gmail.com' \
  /opt/blackhouse-smtp/migrate-relay-to-ses.sh
```

4. Verificar `/var/log/mail.log` (`status=sent`) e a caixa de destino.
5. Remover a API key / SMTP Resend do dashboard Resend quando estável.

### Rollback

```bash
/opt/blackhouse-smtp/rollback-relay-resend.sh
```

## App Black House

Nada a alterar em `server/.env` se já estiver:

- `SMTP_HOST=127.0.0.1` (ou `smtp.blackhouse.app.br`)
- Sem `RESEND_API_KEY`

## Checklist pós-migração

- [ ] Confirmação de conta
- [ ] Reset de senha
- [ ] Lembrete agenda coach
- [ ] Bounce/complaint no SES
- [ ] DMARC (hoje `p=none`) — evoluir depois com dados

## Bloqueio actual

Não há `AWS_*` nem credenciais SES SMTP nesta VPS. Sem elas a troca do `relayhost` não pode ser concluída sem interromper o envio.
