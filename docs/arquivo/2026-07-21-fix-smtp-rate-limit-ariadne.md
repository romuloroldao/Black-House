# Correção SMTP rate-limit — coach Ariadne (2026-07-21)

## Problema
Job `AgendaCoachRemindersJob` (7h30) abria 1 conexão SMTP por e-mail. Postfix tinha `smtpd_client_connection_rate_limit=20`/min → após ~20 envios, `421 too many connections`. Ariadne (`ariadne.coach@gmail.com`) falhou no OVERDUE de 21/07.

## Correções
1. Throttle 400 ms entre e-mails no job (`agenda-coach-reminders.job.js`)
2. Transporter Nodemailer singleton (pool, maxConnections=1) + retry 421 (`send-transactional-email.js`)
3. Postfix `smtpd_client_connection_rate_limit=60`; API `SMTP_HOST=127.0.0.1` com `tls.servername=smtp.blackhouse.app.br`
4. Reenvio OVERDUE Ariadne: `email_status=sent` + mail.log `status=sent` às 13:23

## Validação
```
Jul 21 13:23:10 ... to=<ariadne.coach@gmail.com> ... status=sent
```
