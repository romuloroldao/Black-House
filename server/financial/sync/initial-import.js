const { getCoachAsaasService, usesSharedAsaasAccount, resolveCoachIdFromAsaasPayload } = require('../coach-asaas');
const { upsertPaymentFromAsaas, upsertCustomerFromAsaas, upsertSubscriptionFromAsaas } = require('./entity-upsert');
const { recalculateStudentAccess } = require('../access/access-engine');
const { registerCoachWebhook, registerSharedAsaasWebhook } = require('./webhook-registration');
const AsaasService = require('../../services/asaas.service');
const logger = require('../../utils/logger');

const { resolveAlunoAndCoachForAsaasCustomer } = require('./customer-matcher');

async function ensureCoachSyncConfig(pool, coachId) {
  await pool.query(
    `INSERT INTO public.asaas_config (coach_id, is_sandbox)
     VALUES ($1, $2)
     ON CONFLICT (coach_id) DO NOTHING`,
    [coachId, process.env.ASAAS_ENVIRONMENT !== 'production'],
  );
}

async function markCoachSyncStatus(pool, coachId, status) {
  await ensureCoachSyncConfig(pool, coachId);
  if (status === 'running') {
    await pool.query(
      `UPDATE public.asaas_config SET initial_sync_status = 'running', updated_at = NOW() WHERE coach_id = $1`,
      [coachId],
    );
    return;
  }
  if (status === 'completed') {
    await pool.query(
      `UPDATE public.asaas_config
       SET initial_sync_status = 'completed', initial_sync_completed_at = NOW(), updated_at = NOW()
       WHERE coach_id = $1`,
      [coachId],
    );
    return;
  }
  await pool.query(
    `UPDATE public.asaas_config SET initial_sync_status = 'failed', updated_at = NOW() WHERE coach_id = $1`,
    [coachId],
  );
}

async function importSharedAsaasFinancialData(pool, { notificationService = null } = {}) {
  if (!process.env.ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  const service = new AsaasService(
    process.env.ASAAS_API_KEY,
    process.env.ASAAS_ENVIRONMENT || 'production',
  );

  const coachRows = await pool.query(
    `SELECT DISTINCT coach_id FROM public.alunos WHERE coach_id IS NOT NULL`,
  );
  const coachIds = coachRows.rows.map((r) => r.coach_id);
  for (const coachId of coachIds) {
    await markCoachSyncStatus(pool, coachId, 'running');
  }

  const stats = {
    customersMatched: 0,
    customersOrphan: 0,
    paymentsImported: 0,
    paymentsSkipped: 0,
    subscriptionsImported: 0,
    subscriptionsOrphan: 0,
    coachesTouched: new Set(),
  };

  try {
    await registerSharedAsaasWebhook(pool, service);

    let offset = 0;
    const limit = 100;
    let hasMore = true;
    while (hasMore) {
      const page = await service.listCustomers({ offset, limit });
      const items = page.data || [];
      for (const customer of items) {
        const { alunoId, coachId } = await resolveAlunoAndCoachForAsaasCustomer(pool, customer);
        if (!alunoId || !coachId) {
          stats.customersOrphan += 1;
          continue;
        }
        await upsertCustomerFromAsaas(pool, coachId, customer, 'CUSTOMER_CREATED');
        stats.customersMatched += 1;
        stats.coachesTouched.add(coachId);
      }
      hasMore = page.hasMore === true || items.length === limit;
      offset += limit;
    }

    offset = 0;
    hasMore = true;
    while (hasMore) {
      const page = await service.listPayments({ offset, limit });
      const items = page.data || [];
      for (const payment of items) {
        const coachId = await resolveCoachIdFromAsaasPayload(pool, { payment });
        if (!coachId) {
          stats.paymentsSkipped += 1;
          continue;
        }
        const result = await upsertPaymentFromAsaas(pool, coachId, payment, 'PAYMENT_CREATED');
        if (result.skipped || result.orphan) {
          stats.paymentsSkipped += 1;
        } else {
          stats.paymentsImported += 1;
          stats.coachesTouched.add(coachId);
        }
      }
      hasMore = page.hasMore === true || items.length === limit;
      offset += limit;
    }

    offset = 0;
    hasMore = true;
    while (hasMore) {
      const page = await service.listSubscriptions({ offset, limit });
      const items = page.data || [];
      for (const subscription of items) {
        const coachId = await resolveCoachIdFromAsaasPayload(pool, { subscription });
        if (!coachId) {
          stats.subscriptionsOrphan += 1;
          continue;
        }
        const row = await upsertSubscriptionFromAsaas(pool, coachId, subscription, 'SUBSCRIPTION_CREATED');
        if (row) {
          stats.subscriptionsImported += 1;
          stats.coachesTouched.add(coachId);
        } else {
          stats.subscriptionsOrphan += 1;
        }
      }
      hasMore = page.hasMore === true || items.length === limit;
      offset += limit;
    }

    for (const coachId of stats.coachesTouched) {
      const alunos = await pool.query('SELECT id FROM public.alunos WHERE coach_id = $1', [coachId]);
      for (const row of alunos.rows) {
        await recalculateStudentAccess(pool, row.id, { notificationService });
      }
      await markCoachSyncStatus(pool, coachId, 'completed');
    }

    for (const coachId of coachIds) {
      if (!stats.coachesTouched.has(coachId)) {
        await markCoachSyncStatus(pool, coachId, 'completed');
      }
    }

    logger.info('financial.initial_import.shared_complete', {
      ...stats,
      coachesTouched: [...stats.coachesTouched],
    });

    return stats;
  } catch (err) {
    logger.error('financial.initial_import.shared_failed', { error: err.message });
    for (const coachId of coachIds) {
      await markCoachSyncStatus(pool, coachId, 'failed');
    }
    throw err;
  }
}

async function importCoachFinancialData(pool, coachId, { monthsBack = 24, notificationService = null } = {}) {
  const coachCtx = await getCoachAsaasService(pool, coachId);
  if (!coachCtx?.service) {
    throw new Error('Asaas não configurado para este coach');
  }

  await pool.query(
    `UPDATE public.asaas_config SET initial_sync_status = 'running', updated_at = NOW() WHERE coach_id = $1`,
    [coachId],
  );

  try {
    await registerCoachWebhook(pool, coachId, coachCtx.service);

    let offset = 0;
    const limit = 100;
    let hasMore = true;
    while (hasMore) {
      const page = await coachCtx.service.listCustomers({ offset, limit });
      const items = page.data || [];
      for (const customer of items) {
        await upsertCustomerFromAsaas(pool, coachId, customer, 'CUSTOMER_CREATED');
      }
      hasMore = page.hasMore === true || items.length === limit;
      offset += limit;
    }

    offset = 0;
    hasMore = true;
    while (hasMore) {
      const page = await coachCtx.service.listPayments({ offset, limit });
      const items = page.data || [];
      for (const payment of items) {
        await upsertPaymentFromAsaas(pool, coachId, payment, 'PAYMENT_CREATED');
      }
      hasMore = page.hasMore === true || items.length === limit;
      offset += limit;
    }

    offset = 0;
    hasMore = true;
    while (hasMore) {
      const page = await coachCtx.service.listSubscriptions({ offset, limit });
      const items = page.data || [];
      for (const subscription of items) {
        await upsertSubscriptionFromAsaas(pool, coachId, subscription, 'SUBSCRIPTION_CREATED');
      }
      hasMore = page.hasMore === true || items.length === limit;
      offset += limit;
    }

    const alunos = await pool.query(
      'SELECT id FROM public.alunos WHERE coach_id = $1',
      [coachId],
    );
    for (const row of alunos.rows) {
      await recalculateStudentAccess(pool, row.id, { notificationService });
    }

    await pool.query(
      `UPDATE public.asaas_config
       SET initial_sync_status = 'completed', initial_sync_completed_at = NOW(), updated_at = NOW()
       WHERE coach_id = $1`,
      [coachId],
    );
  } catch (err) {
    logger.error('financial.initial_import.failed', { coachId, error: err.message });
    await pool.query(
      `UPDATE public.asaas_config SET initial_sync_status = 'failed', updated_at = NOW() WHERE coach_id = $1`,
      [coachId],
    );
    throw err;
  }
}

module.exports = {
  importCoachFinancialData,
  importSharedAsaasFinancialData,
};
