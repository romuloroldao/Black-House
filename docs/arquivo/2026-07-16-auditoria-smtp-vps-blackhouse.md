# Auditoria Fase 1 — Infraestrutura SMTP Black House

**Data:** 2026-07-16  
**Âmbito:** VPS `blackhouse-app.vps-kinghost.net` (IP `177.153.64.95`)  
**Estado:** Somente leitura — **nenhuma alteração foi aplicada**  
**Próximo passo:** Aguardar decisão explícita antes da Fase 2 (backup) e Fase 3 (instalação)

---

## 1. Resumo executivo

| Item | Estado |
|------|--------|
| Postfix / OpenDKIM / OpenDMARC | **Não instalados** |
| Portas SMTP locais (25/465/587) | **Nenhuma em escuta** |
| Envio actual da Black House | **Resend** (`smtp.resend.com:465`) via Nodemailer |
| MX do domínio | **AWS SES inbound** (`inbound-smtp.sa-east-1.amazonaws.com`) |
| SPF (apex) | **Ausente** |
| DKIM (apex selectors comuns) | **Não encontrado** nos selectors testados |
| DMARC | Presente: `v=DMARC1; p=none;` |
| PTR | `blackhouse-app.vps-kinghost.net.` (alinhado ao hostname da VPS) |
| Porta 25 **saída** | **BLOQUEADA / inalcançável** (bloqueador crítico) |
| UFW / Fail2Ban | **Inactivos** |
| Docker | **Não instalado** (há `docker-compose.yml` só para dev local) |
| PM2 | Activo — `blackhouse-api` |
| Nginx | Activo — TLS Let's Encrypt válido |

### Bloqueador crítico (STOP)

**A VPS não consegue estabelecer TCP à porta 25 de MXs externos** (Gmail, Outlook, etc.: timeout / network unreachable).  
Sem saída na 25, um Postfix “puro” **não entrega** e-mail directamente à Internet. Isto é típico de VPS/cloud (Kinghost/Locaweb) que restringem SMTP outbound.

**Implicação:** Antes da Fase 3, é obrigatório escolher um dos caminhos abaixo (não se deve instalar Postfix como MTA final sem isto resolvido).

---

## 2. Sistema e recursos

| Recurso | Valor |
|---------|--------|
| SO | Ubuntu **20.04.6 LTS** (Focal) — **EOL desde Abril/2025** |
| Kernel | `5.4.0-216-generic` x86_64 |
| Virtualização | Xen (VPS Kinghost / datasource Locaweb Ec2-like) |
| Hostname | `blackhouse-app.vps-kinghost.net` |
| Uptime | ~32 dias (boot 2026-06-14) |
| CPU | 2× Intel Xeon E5-2630 v4 @ 2.20GHz |
| RAM | 3.8 GiB total · ~1.9 GiB disponível · Swap 2 GiB (~75 MiB used) |
| Disco `/` | 69G · **24G used (37%)** · 42G livres · inodes 7% |
| Load | Baixa (~0.2–0.7 no momento da auditoria) |

**Risco:** Ubuntu 20.04 fora de suporte padrão — plano de upgrade (22.04/24.04) deve entrar no roadmap, independentemente do SMTP.

---

## 3. Rede, firewall e portas

### IP público
- IPv4: `177.153.64.95/24` em `eth0`
- IPv6 global: não configurado (apenas link-local)

### Firewall
| Camada | Estado |
|--------|--------|
| UFW | **inactive** |
| iptables | Políticas **ACCEPT** (sem regras de filtragem) |
| nftables | Vazio / n/a |
| Fail2Ban | **inactive / não operacional** |

### Portas em escuta (relevantes)

| Porta | Bind | Processo |
|-------|------|----------|
| 22 | 0.0.0.0 / :: | `sshd` |
| 80 | 0.0.0.0 | `nginx` |
| 443 | 0.0.0.0 | `nginx` |
| 3001 | * | `node` (blackhouse-api via PM2) |
| 5432 | 127.0.0.1 / ::1 | PostgreSQL |
| 53 | 127.0.0.53 | systemd-resolved |
| 25 / 465 / 587 | — | **não escutam** |

### Testes de conectividade SMTP outbound

| Destino | Resultado |
|---------|-----------|
| `*:25` (Gmail, ASPMX, Hotmail, Orange) | **Timeout / Network unreachable** |
| `smtp.office365.com:587` | OK |
| `email-smtp.sa-east-1.amazonaws.com:587` | OK |
| `smtp.gmail.com:587` | OK (teste anterior) |

**Conclusão:** Submission/relay em 587/465 funciona; entrega directa MTA→MTA na 25 **não**.

### SSH (hardening actual)
- `PermitRootLogin yes`
- `PasswordAuthentication yes`  
(risco elevado; fora do âmbito SMTP mas relevante para a Fase 5)

---

## 4. Serviços activos

### Systemd (produção relevante)
- `nginx.service` — active/enabled
- `pm2-root.service` — active/enabled
- `postgresql@15-main` / cluster PG 15 (cliente `psql` reporta 17.5 no PATH)
- `ssh`, `cron`, `rsyslog`, `unattended-upgrades`

### PM2
| App | Status | Porta app |
|-----|--------|-----------|
| `blackhouse-api` | online | 3001 |

### Docker
- Binário Docker: **não instalado**
- Existe `/root/docker-compose.yml` apenas para Postgres de desenvolvimento — **não em uso em produção** nesta VPS

### Nginx
- Versão: 1.18.0 (Ubuntu)
- Site: `blackhouse` → `blackhouse.app.br`, `www`, `api.blackhouse.app.br`
- Módulo mail do Nginx está empacotado (`libnginx-mod-mail`) mas **não há proxy SMTP activo**

### Apache
- **Não instalado**

### Pacotes de mail
- Postfix / OpenDKIM / OpenDMARC / Exim / Dovecot: **ausentes**
- Bibliotecas SASL presentes (dependência de outros pacotes), sem stack SMTP configurada

---

## 5. DNS, SSL e domínio

### Resolução A / WWW
- `blackhouse.app.br` → `177.153.64.95`
- `www.blackhouse.app.br` → `177.153.64.95`
- `smtp.blackhouse.app.br` → **não existe**
- `mail.blackhouse.app.br` → **não existe**

### NS
- `b.sec.dns.br.` / `c.sec.dns.br.` (Registro.br)

### MX
```
10 inbound-smtp.sa-east-1.amazonaws.com.
```
Indica recepção via **Amazon SES** (inbound). Não aponta para esta VPS.

### SPF
- Registo TXT no apex `blackhouse.app.br`: **vazio / ausente** nos resolvers 8.8.8.8 e 1.1.1.1  
**Risco de entregabilidade** mesmo com Resend, se o domínio não tiver SPF correcto publicado no DNS gerido na Resend/Registro.br.

### DKIM
- Selectors testados sem resposta útil: `default`, `mail`, `smtp`, `selector1`, `selector2`, `google`
- Há indícios de material criptográfico / verificação associada a SES ou provedor externo em alguns nomes DNS (auditoria passiva); **não há stack DKIM local**

### DMARC
```
_dmarc.blackhouse.app.br.  TXT  "v=DMARC1; p=none;"
```
Política permissiva (monitoramento apenas) — adequado para início, insuficiente para produção madura.

### PTR (rDNS)
```
177.153.64.95 → blackhouse-app.vps-kinghost.net.
```
Alinhado ao hostname da máquina. **Não** aponta para `smtp.blackhouse.app.br` (necessário pedir à Kinghost/Locaweb se se adoptar MTA próprio com HELO `smtp.blackhouse.app.br`).

### SSL (Let's Encrypt)
| Certificado | Domínios | Validade |
|-------------|----------|----------|
| `blackhouse.app.br` | apex, www, api | até **2026-10-10** (~85 dias) |

**Não inclui** `smtp.blackhouse.app.br` (ainda inexistente).

### CAA
- Sem registos CAA observados

---

## 6. Blacklists

Consultas DNSBL via resolvers públicos:

| Lista | Resposta | Interpretação |
|-------|----------|---------------|
| zen.spamhaus.org | `127.255.255.254` | **Não é listing real** — código de política/recusa de query (Spamhaus bloqueia muitos resolvers públicos) |
| cbl.abuseat.org | `127.255.255.254` | Idem / query inválida |
| bl.spamcop.net | limpo | OK |
| barracudacentral | limpo | OK |
| sorbs | limpo | OK |
| psbl.surriel | limpo | OK |

**Acção futura:** validar no portal Spamhaus / MXToolbox com IP autenticado ou DNS dedicado, não só dig público.

---

## 7. Serviços que utilizam SMTP actualmente

### Aplicação Black House (única app PM2 nesta VPS)

**Configuração** (`/root/server/.env`, valores mascarados):

| Variável | Valor (resumo) |
|----------|----------------|
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | API key Resend (`re_…`) |
| `SMTP_FROM` / `AUTOMATED_EMAIL_FROM` | `Black House <nao-responda@blackhouse.app.br>` |
| `RESEND_API_KEY` | **não presente** (fluxo HTTP Resend não activo; usa SMTP) |

**Código:**
- `server/utils/send-transactional-email.js` — Resend HTTP **ou** Nodemailer SMTP
- Usado por reset de senha, confirmação de conta, notificações coach/aluno, etc.
- Dependência: `nodemailer@6.10.1`

### Outros projectos na VPS
- `/var/www/blackhouse` — frontend estático da Black House
- `/var/www/html` — default
- **Não foram encontradas** outras APIs PM2 (Precivox, ERP, etc.) nesta máquina neste momento

### MX / recepção
- Entrada de correio do domínio via **SES inbound**, não via esta VPS

---

## 8. Capacidade para SMTP próprio

| Critério | Avaliação |
|----------|-----------|
| CPU/RAM/Disco | Suficiente para Postfix + OpenDKIM + OpenDMARC + Fail2Ban (carga low) |
| Porta 25 outbound | **FALHA** — bloqueador |
| Hostname / PTR | Hostname Kinghost; PTR OK para o nome actual, **não** para marca `smtp.blackhouse.app.br` |
| Firewall host | Ausente — precisa hardening antes de expor 465/587 |
| Conflito com serviços | Baixo (nada na 25/465/587); Nginx/API/PG intocados se bem feito |
| DNS actual | MX SES + sem SPF — mudanças DNS devem ser planeadas para **não** partir Resend/SES |

---

## 9. Caminhos recomendados (decisão necessária)

### Opção A — SMTP corporativo com **smart-host** (recomendado nesta VPS)
- Instalar Postfix + SASL + OpenDKIM **localmente** como hub interno (`smtp.blackhouse.app.br`)
- Apps autenticam em `587`/`465` **na VPS**
- Postfix **relaya** para Resend / Amazon SES / outro ESP (portas 465/587 — já acessíveis)
- Mantém fila, credenciais por app, rate-limit, logs, Fail2Ban
- Entregabilidade depende do ESP + DNS (SPF/DKIM do ESP)

### Opção B — MTA autónomo (entrega directa na 25)
- Exige **desbloqueio da porta 25** junto da Kinghost/Locaweb **e** PTR customizado
- Maior risco de blacklist / reputação de IP novo
- Só avançar após confirmação por escrito do provider

### Opção C — Manter só Resend (sem Postfix)
- Mais simples; não cumpre o objectivo de “SMTP corporativo multi-app” na VPS
- Pode coexistir: apps → Postfix local → Resend (Opção A)

**Recomendação do auditor:** **Opção A**, com migração gradual da Black House e documentação de credenciais por projecto.

---

## 10. Riscos identificados (pré-alteração)

1. **Porta 25 bloqueada** — impede MTA autónomo.
2. **Sem SPF no apex** — entregabilidade / alinhamento DMARC frágil.
3. **UFW e Fail2Ban off** — abrir 465/587 sem hardening aumenta superfície de abuso.
4. **SSH root + password** — risco de compromisso da VPS.
5. **Ubuntu 20.04 EOL** — patches de segurança limitados.
6. **MX em SES** — não alterar MX sem plano de recepção.
7. **Migração abrupta** da Black House de Resend → SMTP local pode partir reset de senha / notificações.
8. **PTR/HELO** desalinhados se se anunciar `smtp.blackhouse.app.br` sem pedido ao provider.

---

## 11. O que foi mantido (nada alterado)

- Nginx, PM2, PostgreSQL, aplicação Black House
- Certificados Let's Encrypt
- Variáveis SMTP Resend
- DNS público
- iptables / UFW
- Hostname e PTR

---

## 12. Plano de rollback (para fases futuras — ainda não executado)

Antes de qualquer mudança:

1. Backup em `/backup/smtp/YYYY-MM-DD/` de: `/etc/postfix`, `/etc/opendkim`, `/etc/opendmarc`, `/etc/nginx`, `/etc/letsencrypt`, unidades systemd novas, env, DNS documentado.
2. Snapshot/documentação do estado PM2 e `server/.env`.
3. Rollback típico:
   - Parar/desactivar unidades Postfix/OpenDKIM **sem** tocar Nginx/PM2
   - Restaurar configs do backup
   - Reverter `SMTP_*` da app para Resend
   - Remover regras UFW específicas de 465/587 se adicionadas
4. Critério de segurança: **nunca** `apt remove --purge` sem backup e sem confirmação; preferir `systemctl stop` + `disable`.

---

## 13. Checklist para autorização da Fase 2+

Antes de backup/instalação, confirmar:

- [ ] Escolha: **Opção A** (smart-host), **B** (MTA directo) ou **C** (só Resend)
- [ ] Se B: ticket Kinghost para **porta 25 outbound** + **PTR** `smtp.blackhouse.app.br`
- [ ] Acesso ao painel DNS (Registro.br) para SPF/DKIM/DMARC/`smtp` A
- [ ] Acesso à conta Resend (e/ou SES) para alinhar SPF/DKIM
- [ ] Janela de manutenção (preferencialmente sem downtime; mudanças incrementais)
- [ ] Aprovação explícita: “pode avançar para Fase 2 — Backup”

---

## 14. Inventário de evidências (comandos usados)

Auditoria passiva com: `uname`, `hostnamectl`, `free`, `df`, `lscpu`, `ss`, `iptables`, `ufw`, `systemctl`, `pm2`, `nginx -v`, `dig`, `openssl x509`, `certbot certificates`, `nc`/`timeout` para portas, `dpkg`, leitura de `.env` (valores sensíveis mascarados), inspeção de `send-transactional-email.js`.

---

**Fim da Fase 1.** Nenhuma alteração de infraestrutura foi realizada.
