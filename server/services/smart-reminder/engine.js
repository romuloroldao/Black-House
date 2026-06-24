/**
 * Motor de lembretes inteligentes — orquestra domínios, ledger e notificações.
 */
const logger = require('../../utils/logger');
const { MILESTONES, DISPATCH_STATUS } = require('./types');
const { getCopy } = require('./copy');
const { listActiveDomains, getDomainHandler } = require('./resolvers');
const { startOfCalendarWeek } = require('../../utils/checkin-week');

async function legacyCheckinFallback(pool, notificationService, now) {
  if (!notificationService?.notifyCheckinReminder) {
    return { sent: 0, skipped: 0, expired: 0, errors: 0, flows: 0, legacy: true };
  }

  const weekStart = startOfCalendarWeek(now);
  const day = now.getDay();
  const hour = now.getHours();
  const isMondayMorning = day === 1 && hour === 10;

  if (!isMondayMorning) {
    return { sent: 0, skipped: 0, expired: 0, errors: 0, flows: 0, legacy: true };
  }

  const r = await pool.query(
    `SELECT DISTINCT a.id, a.coach_id
     FROM public.alunos a
     WHERE a.coach_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.weekly_checkins wc
         WHERE wc.aluno_id = a.id AND wc.created_at >= $1::timestamptz
       )`,
    [weekStart.toISOString()],
  );

  let sent = 0;
  for (const row of r.rows) {
    try {
      await notificationService.notifyCheckinReminder(row.id, row.coach_id);
      sent += 1;
    } catch (e) {
      logger.warn('smart_reminder.legacy_checkin_failed', { alunoId: row.id, error: e.message });
    }
  }

  return { sent, skipped: 0, expired: 0, errors: 0, flows: r.rows.length, legacy: true };
}

async function tableExists(pool, tableName) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return r.rows.length > 0;
}

async function registerDispatch(pool, payload) {
  const r = await pool.query(
    `INSERT INTO public.task_reminder_dispatches (
       domain, entity_id, aluno_id, coach_id, flow_cycle_id,
       milestone, scheduled_at, deadline_at, notification_channel, status
     ) VALUES (
       $1::public.task_domain, $2, $3, $4, $5,
       $6::public.reminder_milestone, $7::timestamptz, $8::timestamptz,
       $9::public.student_notification_channel, $10::public.reminder_dispatch_status
     )
     ON CONFLICT (domain, entity_id, flow_cycle_id, milestone) DO NOTHING
     RETURNING id, status`,
    [
      payload.domain,
      payload.entityId,
      payload.alunoId,
      payload.coachId,
      payload.flowCycleId,
      payload.milestone,
      payload.scheduledAt.toISOString(),
      payload.deadlineAt ? payload.deadlineAt.toISOString() : null,
      payload.notificationChannel || 'in_app_and_email',
      payload.status || DISPATCH_STATUS.PENDING,
    ],
  );
  return r.rows[0] || null;
}

async function updateDispatchStatus(pool, dispatchId, status, extra = {}) {
  await pool.query(
    `UPDATE public.task_reminder_dispatches
     SET status = $2::public.reminder_dispatch_status,
         cancel_reason = COALESCE($3, cancel_reason),
         email_status = COALESCE($4, email_status),
         email_provider = COALESCE($5, email_provider),
         email_error = COALESCE($6, email_error),
         sent_at = CASE WHEN $2::text = 'sent' THEN COALESCE(sent_at, NOW()) ELSE sent_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [
      dispatchId,
      status,
      extra.cancelReason || null,
      extra.emailStatus || null,
      extra.emailProvider || null,
      extra.emailError || null,
    ],
  );
}

async function recordAdherence(pool, payload) {
  await pool.query(
    `INSERT INTO public.task_adherence_events (
       domain, entity_id, aluno_id, coach_id, flow_cycle_id, outcome, metadata
     ) VALUES (
       $1::public.task_domain, $2, $3, $4, $5, $6, $7::jsonb
     )
     ON CONFLICT (domain, entity_id, flow_cycle_id, outcome) DO NOTHING`,
    [
      payload.domain,
      payload.entityId,
      payload.alunoId,
      payload.coachId,
      payload.flowCycleId,
      payload.outcome,
      JSON.stringify(payload.metadata || {}),
    ],
  );
}

async function cancelPendingDispatches(pool, { domain, entityId, flowCycleId, reason }) {
  await pool.query(
    `UPDATE public.task_reminder_dispatches
     SET status = 'cancelled'::public.reminder_dispatch_status,
         cancel_reason = $4,
         updated_at = NOW()
     WHERE domain = $1::public.task_domain
       AND entity_id = $2
       AND flow_cycle_id = $3::uuid
       AND status = 'pending'::public.reminder_dispatch_status`,
    [domain, entityId, flowCycleId, reason],
  );
}

async function processFlow(pool, notificationService, flow, now) {
  const handler = getDomainHandler(flow.domain);
  if (!handler) return { action: 'skipped', reason: 'unknown_domain' };

  if (flow.deadlineAt && now > flow.deadlineAt && flow.milestone !== MILESTONES.EXPIRED) {
    const completed = await handler.isCompleted(pool, {
      alunoId: flow.alunoId,
      weekKey: flow.weekKey,
      timeZone: flow.timeZone,
      entityId: flow.entityId,
    });
    if (completed) {
      await cancelPendingDispatches(pool, {
        domain: flow.domain,
        entityId: flow.entityId,
        flowCycleId: flow.flowCycleId,
        reason: 'completed',
      });
      return { action: 'skipped', reason: 'completed_after_deadline' };
    }
  }

  const completed = await handler.isCompleted(pool, {
    alunoId: flow.alunoId,
    weekKey: flow.weekKey,
    timeZone: flow.timeZone,
    entityId: flow.entityId,
  });

  if (completed) {
    await cancelPendingDispatches(pool, {
      domain: flow.domain,
      entityId: flow.entityId,
      flowCycleId: flow.flowCycleId,
      reason: 'completed',
    });
    if (notificationService?.cancelRemindersForTask) {
      await notificationService.cancelRemindersForTask({
        flowCycleId: flow.flowCycleId,
        alunoId: flow.alunoId,
        domain: flow.domain,
        notificationTypes: ['checkin_reminder', 'task_reminder'],
      });
    }
    return { action: 'skipped', reason: 'completed' };
  }

  if (now < flow.scheduledAt) {
    return { action: 'skipped', reason: 'not_due' };
  }

  const dispatch = await registerDispatch(pool, flow);
  if (!dispatch) {
    return { action: 'skipped', reason: 'already_dispatched' };
  }

  if (flow.milestone === MILESTONES.EXPIRED) {
    await recordAdherence(pool, {
      domain: flow.domain,
      entityId: flow.entityId,
      alunoId: flow.alunoId,
      coachId: flow.coachId,
      flowCycleId: flow.flowCycleId,
      outcome: 'missed',
      metadata: { weekKey: flow.weekKey },
    });

    const copy = getCopy(flow.domain, flow.milestone);
    if (copy && notificationService?.notifySmartTaskReminder) {
      await notificationService.notifySmartTaskReminder({
        flow,
        copy,
        coachOnly: true,
      });
    }

    await updateDispatchStatus(pool, dispatch.id, DISPATCH_STATUS.SENT);
    return { action: 'expired', dispatchId: dispatch.id };
  }

  const copy = getCopy(flow.domain, flow.milestone);
  if (!copy || !notificationService?.notifySmartTaskReminder) {
    await updateDispatchStatus(pool, dispatch.id, DISPATCH_STATUS.SKIPPED, {
      cancelReason: 'no_notifier',
    });
    return { action: 'skipped', reason: 'no_notifier' };
  }

  try {
    const result = await notificationService.notifySmartTaskReminder({ flow, copy });
    await updateDispatchStatus(pool, dispatch.id, DISPATCH_STATUS.SENT, {
      emailStatus: result?.emailStatus || 'skipped',
      emailProvider: result?.emailProvider || null,
      emailError: result?.emailError || null,
    });
    return { action: 'sent', dispatchId: dispatch.id, milestone: flow.milestone };
  } catch (error) {
    await updateDispatchStatus(pool, dispatch.id, DISPATCH_STATUS.SKIPPED, {
      cancelReason: error.message,
      emailStatus: 'failed',
      emailError: error.message,
    });
    logger.warn('smart_reminder.send_failed', {
      domain: flow.domain,
      entityId: flow.entityId,
      milestone: flow.milestone,
      error: error.message,
    });
    return { action: 'error', error: error.message };
  }
}

async function collectFlows(pool, now = new Date()) {
  const flows = [];
  for (const domain of listActiveDomains()) {
    const handler = getDomainHandler(domain);
    if (!handler?.fetchActiveFlows) continue;
    const active = await handler.fetchActiveFlows(pool, now);
    flows.push(...active);
    if (handler.fetchExpiredFlows) {
      const expired = await handler.fetchExpiredFlows(pool, now);
      flows.push(...expired);
    }
  }
  return flows;
}

async function processAll(pool, notificationService, now = new Date()) {
  if (!(await tableExists(pool, 'task_reminder_dispatches'))) {
    logger.warn('smart_reminder.tables_missing', {
      hint: 'npm run db:migrate',
    });
    return legacyCheckinFallback(pool, notificationService, now);
  }

  const flows = await collectFlows(pool, now);
  let sent = 0;
  let skipped = 0;
  let expired = 0;
  let errors = 0;

  for (const flow of flows) {
    const result = await processFlow(pool, notificationService, flow, now);
    if (result.action === 'sent') sent += 1;
    else if (result.action === 'expired') expired += 1;
    else if (result.action === 'error') errors += 1;
    else skipped += 1;
  }

  return { sent, skipped, expired, errors, flows: flows.length };
}

async function onTaskCompleted(pool, notificationService, payload) {
  const handler = getDomainHandler(payload.domain);
  if (!handler) return;

  const flowCycleId =
    payload.flowCycleId ||
    (handler.flowCycleId && payload.weekKey
      ? handler.flowCycleId(payload.alunoId, payload.weekKey)
      : null);
  const entityId =
    payload.entityId ||
    (handler.buildEntityId && payload.weekKey
      ? handler.buildEntityId(payload.alunoId, payload.weekKey)
      : null);

  if (!flowCycleId || !entityId) return;

  await cancelPendingDispatches(pool, {
    domain: payload.domain,
    entityId,
    flowCycleId,
    reason: 'completed',
  });

  await recordAdherence(pool, {
    domain: payload.domain,
    entityId,
    alunoId: payload.alunoId,
    coachId: payload.coachId,
    flowCycleId,
    outcome: 'completed',
    metadata: payload.metadata || {},
  });

  if (notificationService?.cancelRemindersForTask) {
    await notificationService.cancelRemindersForTask({
      flowCycleId,
      alunoId: payload.alunoId,
      domain: payload.domain,
      notificationTypes: ['checkin_reminder', 'task_reminder', 'checkin_missed'],
    });
  }
}

module.exports = {
  processAll,
  processFlow,
  onTaskCompleted,
  collectFlows,
  registerDispatch,
  cancelPendingDispatches,
  recordAdherence,
  tableExists,
};
