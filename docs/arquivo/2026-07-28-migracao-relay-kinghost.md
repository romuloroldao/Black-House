# Migração relay Postfix: Resend → SMTP KingHost

**Data:** 2026-07-28  
**Estado:** Script pronto. **Aguarda credenciais** da caixa SMTP contratada na KingHost.

## Porquê KingHost neste momento

- VPS já é KingHost (`blackhouse-app.vps-kinghost.net`).
- Porta **25 outbound** bloqueada → smart-host em **465/587** obrigatório.
- Hub local já existe: app → Postfix (`127.0.0.1:587`) → `relayhost`.
- Trocar só o `relayhost` (Resend → KingHost) **não exige mudança** em `server/.env`.

## Estado actual (antes da troca)

```text
App (Nodemailer) → Postfix local :587 → relayhost smtp.resend.com:465
```

- `SMTP_HOST=127.0.0.1` / user SASL local `blackhouse@blackhouse.app.br`
- `smtp.blackhouse.app.br` → `177.153.64.95` (A OK)
- MX continua em **SES inbound** (`inbound-smtp.sa-east-1.amazonaws.com`) — recepção AWS
- Reachability: `smtp.kinghost.net:465` e `:587` OK a partir desta VPS

## Alvo

```text
App → Postfix local :587 → relayhost smtp.kinghost.net:465
```

(Hospedagem: `smtp.kinghost.net`; revenda: `smtp.uni5.net`. Fora do BR / redes externas: `smtpi.*`.)

## O que precisas do painel KingHost

1. Plano de e-mail / KingMail activo para `blackhouse.app.br` (ou domínio usado no From).
2. Caixa criada, idealmente alinhada ao From da app: `nao-responda@blackhouse.app.br` (ou outra + actualizar `SMTP_FROM`).
3. **Utilizador** = e-mail completo da caixa.  
4. **Senha** da caixa.  
5. Confirmar se é hospedagem (`smtp.kinghost.net`) ou revenda (`smtp.uni5.net`).

## Script

| Ficheiro | Função |
|----------|--------|
| `/opt/blackhouse-smtp/migrate-relay-to-kinghost.sh` | Aplica KingHost |
| `/opt/blackhouse-smtp/rollback-relay-resend.sh` | Volta ao Resend |

```bash
KH_SMTP_USER='nao-responda@blackhouse.app.br' \
KH_SMTP_PASS='SENHA' \
KH_TEST_TO='teu@gmail.com' \
  /opt/blackhouse-smtp/migrate-relay-to-kinghost.sh
```

Opcional: `--host smtp.uni5.net` / `--port 587` / `--from ...`

## DNS / autenticação (obrigatório para inbox)

- **SPF:** incluir o include da KingHost (ex. `include:spf.kinghost.net`) no TXT de `blackhouse.app.br`.  
  Em 2026-07-28 o TXT/SPF do domínio apareceu **vazio** em vários resolvers — corrigir antes ou logo após a troca.
- **DKIM:** activar no painel KingHost e publicar CNAME/TXT que eles indicarem.
- **MX:** só alterar se quiseres **receber** correio na KingHost. Envio (relay) **não** exige mudar o MX SES actual.
- **From:** deve ser a caixa (ou alias autorizado) com que autenticas no SMTP KingHost.

## App Black House

Manter:

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=blackhouse@blackhouse.app.br
SMTP_FROM="Black House <nao-responda@blackhouse.app.br>"
```

Sem `RESEND_API_KEY`.

## Checklist pós-migração

- [ ] `mail.log` com `relay=smtp.kinghost.net` e `status=sent`
- [ ] Teste chega a Gmail/Outlook (não só spam)
- [ ] Confirmação de conta / reset de senha na app
- [ ] SPF/DKIM alinhados
- [ ] Desactivar/cancelar Resend quando estável

## Bloqueio actual

Não há user/senha da caixa KingHost nesta VPS. Sem isso o `relayhost` não pode ser trocado sem risco de parar o envio.
