# SMTP corporativo Black House — Opção A (hub + Relay Resend)

**Data:** 2026-07-16  
**Hostname lógico:** `smtp.blackhouse.app.br`  
**IP VPS:** `177.153.64.95`  
**Modo:** Postfix local (submission) → smart-host **Resend** (`smtp.resend.com:465`)  
**Backup:** `/backup/smtp/2026-07-16/`  
**Credenciais app:** `/opt/blackhouse-smtp/credentials.txt` (root only, mode 600)

---

## 1. Arquitetura

```
[App Precivox/ERP/Black House/…]
        │  SMTP AUTH + TLS
        │  :587 STARTTLS  ou  :465 SMTPS
        ▼
[Postfix na VPS]  ← SASL (sasldb) · OpenDKIM · rate-limit · Fail2Ban · UFW
        │  relay TLS wrapper
        │  smtp.resend.com:465
        ▼
[Resend]  →  Internet (Gmail, Outlook, …)
```

- **Porta 25 pública:** fechada (só `127.0.0.1:25` para mail local).
- **Sem open relay:** relay só com SASL autenticado (ou localhost).
- **Black House app:** migrada em **2026-07-17** para `smtp.blackhouse.app.br:587` (user `blackhouse@blackhouse.app.br`). Relay continua Resend. Rollback: `/root/server/.env.bak.pre-smtp-hub` + `pm2 restart blackhouse-api --update-env`.

---

## 2. Portas e firewall (UFW)

| Porta | Serviço | Exposição |
|-------|---------|-----------|
| 22 | SSH | público |
| 80 / 443 | Nginx | público |
| 465 | SMTPS | público (AUTH+TLS) |
| 587 | Submission | público (AUTH+STARTTLS) |
| 25 | SMTP | **somente localhost** |
| 3001 | API | (como antes; atrás do Nginx) |

```bash
ufw status verbose
```

---

## 3. Utilizadores SMTP (por projecto)

Login no formato: `USER@blackhouse.app.br`

| Utilizador | Uso sugerido |
|------------|----------------|
| `blackhouse@blackhouse.app.br` | App Black House |
| `precivox@blackhouse.app.br` | Precivox |
| `erp@blackhouse.app.br` | ERP |
| `institucional@blackhouse.app.br` | Sites institucionais |
| `interno@blackhouse.app.br` | Sistemas internos |
| `marketing@blackhouse.app.br` | Marketing |
| `clientes@blackhouse.app.br` | Projectos de clientes |

Senhas: `/opt/blackhouse-smtp/credentials.txt` (e cópia em `/backup/smtp/2026-07-16/env/`).

Exemplo Nodemailer:

```js
{
  host: '127.0.0.1', // ou smtp.blackhouse.app.br após DNS
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: 'blackhouse@blackhouse.app.br',
    pass: '<senha>'
  }
}
```

---

## 4. DNS — acções manuais (Registro.br)

### 4.1 Obrigatório para o hub

| Tipo | Nome | Valor |
|------|------|--------|
| **A** | `smtp` | `177.153.64.95` |

Depois do A activo, emitir certificado:

```bash
certbot certonly --nginx -d smtp.blackhouse.app.br
# depois copiar para /etc/postfix/ssl e reload (ou alargar o cert existente)
```

Hoje o TLS do Postfix usa o cert de `blackhouse.app.br` (cópia em `/etc/postfix/ssl/`). Apps em `127.0.0.1` podem ignorar mismatch de nome; clientes externos devem usar o SAN correcto após DNS+cert.

### 4.2 SPF (apex) — crítico

Criar **um único** TXT no apex (hoje está **ausente**):

```
v=spf1 include:_spf.resend.com ~all
```

Confirmar no dashboard Resend os registos exactos (SPF/DKIM/MX do subdomínio `send` se a Resend usar).

### 4.3 DKIM Resend

Publicar os registos que a Resend mostra no painel (ex.: `resend._domainkey` / CNAMEs). São os que validam a entrega real via Resend.

### 4.4 DKIM local (OpenDKIM selector `bh2026`) — opcional mas recomendado

O hub assina com `s=bh2026`. Publicar TXT:

```
Nome: bh2026._domainkey
Tipo: TXT
Valor: (ver ficheiro abaixo — juntar as strings p= numa só)
```

Fonte: `/etc/opendkim/keys/blackhouse.app.br/bh2026.txt`

### 4.5 DMARC (já existe — evoluir depois)

Actual: `v=DMARC1; p=none;`  
Futuro (após SPF/DKIM estáveis): `p=quarantine` → `p=reject`, com `rua=` para relatórios.

### 4.6 MX

**Não alterar** sem plano: aponta para `inbound-smtp.sa-east-1.amazonaws.com` (SES inbound).

### 4.7 PTR

Continua `blackhouse-app.vps-kinghost.net`. Para Opção A (relay Resend) **não é bloqueador**. Só seria crítico em MTA directo (Opção B).

---

## 5. Serviços e ficheiros

| Item | Caminho / comando |
|------|-------------------|
| Postfix main | `/etc/postfix/main.cf` |
| Postfix master | `/etc/postfix/master.cf` |
| Relay Resend | `/etc/postfix/sasl_passwd` (+ `.db`) |
| SASL smtpd | `/etc/postfix/sasl/smtpd.conf` |
| SASL DB | `/etc/sasldb2` |
| OpenDKIM | `/etc/opendkim.conf`, `/etc/opendkim/*` |
| TLS | `/etc/postfix/ssl/{fullchain,privkey}.pem` |
| Certbot hook | `/etc/letsencrypt/renewal-hooks/deploy/postfix-ssl.sh` |
| Fail2Ban | `/etc/fail2ban/jail.d/postfix-smtp.conf` |
| Status | `/opt/blackhouse-smtp/status.sh` |
| Relatório diário | `/etc/cron.daily/blackhouse-smtp-report` → `/var/log/blackhouse-smtp-daily.log` |
| Logs | `/var/log/mail.log` |

```bash
systemctl status postfix opendkim fail2ban
mailq
/opt/blackhouse-smtp/status.sh
tail -f /var/log/mail.log
```

---

## 6. Teste já validado (2026-07-16)

```
relay=smtp.resend.com[…]:465, status=sent (250 …)
```

Auth SASL OK · DKIM local adicionado · TLS submission OK · open relay bloqueado (exige STARTTLS/AUTH).

---

## 7. Migração gradual (Fase 9) — ainda NÃO feita

1. Manter Black House em Resend directo até DNS SPF/DKIM OK.
2. Apontar **só** um ambiente de teste para `127.0.0.1:587` com user `blackhouse@…`.
3. Validar: reset senha, confirmação conta, notificações.
4. Só então alterar `SMTP_HOST` / user / pass em `/root/server/.env` e `pm2 restart blackhouse-api`.
5. Outros projectos: um de cada vez.

Rollback app: restaurar `SMTP_*` de `/backup/smtp/2026-07-16/env/server.env`.

---

## 8. Rollback infra

Ver `/backup/smtp/2026-07-16/ROLLBACK.md`.

Resumo rápido:

```bash
systemctl stop postfix opendkim
# Opcional: systemctl disable postfix opendkim
ufw delete allow 587/tcp
ufw delete allow 465/tcp
# App continua no Resend directo — sem impacto se não migrou
```

Restauro de configs: pastas em `/backup/smtp/2026-07-16/etc/`.

---

## 9. Troubleshooting

| Sintoma | Acção |
|---------|--------|
| `451 4.7.1` | OpenDKIM — permissões em `/etc/opendkim` |
| Fila enche, sem `status=sent` | `smtp` unix **sem chroot** (`master.cf`); `sasl_passwd` legível |
| Auth fail | `sasldblistusers2`; user = `name@blackhouse.app.br` |
| Resend 5xx | Credencial relay / domínio não verificado na Resend |
| Cert TLS | Hook deploy + `/etc/postfix/ssl` |

---

## 10. Checklist de manutenção

- [ ] Semanal: `mailq` vazia; `/opt/blackhouse-smtp/status.sh`
- [ ] Mensal: Fail2Ban bans; disco `/var/spool/postfix` e logs
- [ ] Renovação LE: confirmar hook Postfix
- [ ] Rotação senhas SMTP por projecto
- [ ] Evoluir DMARC após 2–4 semanas estáveis
- [ ] Plano upgrade Ubuntu 20.04 → 22.04/24.04

---

## 11. O que foi mantido / alterado

**Mantido:** Nginx, PM2 `blackhouse-api`, PostgreSQL, env Resend da app, MX SES, cert LE web.

**Alterado:** Instalados Postfix, OpenDKIM, Fail2Ban, mailutils; UFW activo; portas 465/587; relay Resend; utilizadores SASL; backups em `/backup/smtp/2026-07-16/`.

**Não feito nesta fase:** OpenDMARC (baixa prioridade em hub só-outbound); migração da app Black House; DNS no Registro.br (manual); cert dedicado `smtp.*`; testes inbox Gmail/Outlook externos com DNS completo.
