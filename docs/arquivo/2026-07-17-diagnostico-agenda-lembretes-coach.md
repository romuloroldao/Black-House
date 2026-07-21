# Diagnóstico: lembretes Agenda coach (2026-07-17)

## Sintoma
Coach reclamava que não recebia notificações da Agenda (passou a usar Google Calendar). Conta referida como `assessoria@blackhouse.com.br`.

## Loop de feedback
Executar `AgendaCoachRemindersJob.execute()` e observar:
1. candidatos overdue / milestones
2. insert em `agenda_coach_reminder_dispatches`
3. `email_status` + `/var/log/mail.log`

## Hipóteses (ranqueadas)
1. **Job a crashar no 2.º dia de OVERDUE** por unique constraint — **CONFIRMADA**
2. E-mail errado / inbox diferente — **parcial** (conta real é Gmail)
3. Canal `in_app_only` — descartada (sem `coach_profiles`; default e-mail)
4. SMTP/Resend down — descartada (outros envios OK)
5. Jobs desactivados (`ENABLE_JOBS`) — descartada

## Causa raiz
Constraint `agenda_coach_reminder_dispatches_cycle_unique` em `(agenda_evento_id, reminder_cycle_id, milestone)` impedia um segundo `OVERDUE_DAILY` no dia seguinte.

O código pretendia 1 e-mail/atrasado **por dia** (`overdue_daily_unique` + `dispatch_on`), mas o `ON CONFLICT` só cobria a unique diária. No dia seguinte o INSERT batia na unique de ciclo → **excepção não tratada** → job parava inteiro.

Último despacho bem-sucedido: **2026-06-24**. Depois disso: silêncio até o fix.

## Correção
- Migração `server/migrations/20260717_fix_agenda_overdue_unique.sql`: unique de ciclo **parcial** (exclui `OVERDUE_DAILY`)
- `registerDispatch` com data SP + catch `23505`
- Job overdue com try/catch à volta do dispatch
- Criado `coach_profiles` em falta para o coach
- Guard em `notifyUser` se `emitToUser` ausente

## Validação pós-fix (2026-07-17)
- Job: `sent=33` (20 e-mails SMTP + 13 in-app por cap diário de 20)
- Destino real: **`assessoriablackhouse@gmail.com`** (não existe user `assessoria@blackhouse.com.br`)
- mail.log: `status=sent` para esse Gmail via hub → Resend

## Nota operacional
Há **33 eventos pendentes atrasados** (Abr–Jun). Limpar/concluir na Agenda reduz ruído e o cap de 20 e-mails/dia.
