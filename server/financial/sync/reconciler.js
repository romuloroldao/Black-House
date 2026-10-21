const { getCoachAsaasService } = require('../coach-asaas');
const { upsertPaymentFromAsaas, upsertCustomerFromAsaas, upsertSubscriptionFromAsaas } = require('./entity-upsert');
const { recalculateStudentAccess } = require('../access/access-engine');
const logger = require('../../utils/logger');

async function reconcileCoach(pool, coachId, { notificationService = null } = {}) {
  const coachCtx = await getCoachAsaasService(pool, coachId);
  if (!coachCtx?.service) return { skipped: true };

  const checkpointResult = await pool.query(
    `SELECT last_cursor FROM public.financial_sync_checkpoints
     WHERE coach_id = $1 AND resource_type = 'payments' LIMIT 1`,
    [coachId],
  );
  const since = checkpointResult.rows[0]?.last_cursor || null;

  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let maxUpdated = since;
  const alunoIds = new Set();

  while (hasMore) {
    const params = { offset, limit };
    if (since) params.updatedSince = since;

    const page = await coachCtx.service.listPayments(params);
    const items = page.data || [];

    for (const payment of items) {
      const { payment: row } = await upsertPaymentFromAsaas(pool, coachId, payment, 'PAYMENT_UPDATED');
      if (row?.aluno_id) alunoIds.add(row.aluno_id);
      const updated = payment.dateUpdated || payment.updatedAt;
      if (updated && (!maxUpdated || updated > maxUpdated)) maxUpdated = updated;
    }

    hasMore = page.hasMore === true || items.length === limit;
    offset += limit;
  }

  await pool.query(
    `INSERT INTO public.financial_sync_checkpoints (coach_id, resource_type, last_cursor, last_success_at)
     VALUES ($1, 'payments', $2, NOW())
     ON CONFLICT (coach_id, resource_type) DO UPDATE SET
       last_cursor = EXCLUDED.last_cursor,
       last_success_at = NOW()`,
    [coachId, maxUpdated],
  );

  await pool.query(
    'UPDATE public.asaas_config SET last_reconciliation_at = NOW(), updated_at = NOW() WHERE coach_id = $1',
    [coachId],
  );

  for (const alunoId of alunoIds) {
    await recalculateStudentAccess(pool, alunoId, { notificationService });
  }

  logger.info('financial.reconcile.completed', { coachId, paymentsChecked: offset });
  return { coachId, reconciled: true };
}

async function reconcileAllCoaches(pool, notificationService) {
  const coaches = await pool.query(
    'SELECT coach_id FROM public.asaas_config WHERE asaas_api_key IS NOT NULL',
  );
  let count = 0;
  for (const row of coaches.rows) {
    try {
      await reconcileCoach(pool, row.coach_id, { notificationService });
      count += 1;
    } catch (err) {
      logger.error('financial.reconcile.coach_failed', { coachId: row.coach_id, error: err.message });
    }
  }
  return count;
}

module.exports = {
  reconcileCoach,
  reconcileAllCoaches,
};
