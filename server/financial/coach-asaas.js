const AsaasService = require('../services/asaas.service');
const { decryptCoachAsaasApiKey } = require('../utils/asaas-coach-secret-crypto');
const logger = require('../utils/logger');

async function getCoachAsaasConfig(pool, coachId) {
  const result = await pool.query(
    'SELECT * FROM public.asaas_config WHERE coach_id = $1 LIMIT 1',
    [coachId],
  );
  return result.rows[0] || null;
}

async function getCoachAsaasService(pool, coachId) {
  const config = await getCoachAsaasConfig(pool, coachId);
  if (!config?.asaas_api_key) {
    if (process.env.ASAAS_ALLOW_GLOBAL_FALLBACK === 'true' && process.env.ASAAS_API_KEY) {
      logger.warn('financial.coach_asaas.using_global_fallback', { coachId });
      return {
        service: new AsaasService(process.env.ASAAS_API_KEY, process.env.ASAAS_ENVIRONMENT || 'production'),
        config: null,
        isGlobalFallback: true,
      };
    }
    return null;
  }

  const plainKey = decryptCoachAsaasApiKey(config.asaas_api_key);
  return {
    service: new AsaasService(plainKey, config.is_sandbox ? 'sandbox' : 'production'),
    config,
    isGlobalFallback: false,
  };
}

function buildCustomerExternalRef(alunoId) {
  return `bh_aluno_${alunoId}`;
}

function buildPaymentExternalRef(paymentUuid) {
  return `bh_pay_${paymentUuid}`;
}

function buildSubscriptionExternalRef(subscriptionUuid) {
  return `bh_sub_${subscriptionUuid}`;
}

function parseAlunoIdFromExternalRef(ref) {
  if (!ref) return null;
  const m = String(ref).match(/^bh_aluno_([0-9a-f-]{36})$/i);
  if (m) return m[1];
  const legacy = String(ref).match(/^aluno_([0-9a-f-]{36})$/i);
  return legacy ? legacy[1] : null;
}

function parsePaymentUuidFromExternalRef(ref) {
  if (!ref) return null;
  const m = String(ref).match(/^bh_pay_([0-9a-f-]{36})$/i);
  return m ? m[1] : null;
}

function usesSharedAsaasAccount() {
  return (
    process.env.ASAAS_SHARED_ACCOUNT === 'true' ||
    process.env.ASAAS_ALLOW_GLOBAL_FALLBACK === 'true'
  );
}

async function getSharedWebhookPrimaryCoachId(pool) {
  if (process.env.ASAAS_SHARED_WEBHOOK_COACH_ID) {
    return process.env.ASAAS_SHARED_WEBHOOK_COACH_ID;
  }
  const cfg = await pool.query(
    'SELECT coach_id FROM public.asaas_config ORDER BY updated_at DESC NULLS LAST LIMIT 1',
  );
  if (cfg.rows[0]?.coach_id) return cfg.rows[0].coach_id;

  const coaches = await pool.query(
    `SELECT coach_id, COUNT(*) AS n
     FROM public.alunos
     WHERE coach_id IS NOT NULL
     GROUP BY coach_id
     ORDER BY n DESC
     LIMIT 1`,
  );
  return coaches.rows[0]?.coach_id || null;
}

async function resolveCoachIdFromAsaasPayload(pool, payload) {
  const payment = payload?.payment;
  const customer = payload?.customer;
  const subscription = payload?.subscription;

  if (payment) {
    const payRef = parsePaymentUuidFromExternalRef(payment.externalReference);
    if (payRef) {
      const r = await pool.query(
        'SELECT coach_id FROM public.asaas_payments WHERE id = $1 LIMIT 1',
        [payRef],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }

    const alunoRef = parseAlunoIdFromExternalRef(payment.externalReference);
    if (alunoRef) {
      const r = await pool.query(
        'SELECT coach_id FROM public.alunos WHERE id = $1 LIMIT 1',
        [alunoRef],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }

    if (payment.id) {
      const r = await pool.query(
        'SELECT coach_id FROM public.asaas_payments WHERE asaas_payment_id = $1 LIMIT 1',
        [payment.id],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }

    if (payment.customer) {
      const r = await pool.query(
        'SELECT coach_id FROM public.asaas_customers WHERE asaas_customer_id = $1 LIMIT 1',
        [payment.customer],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }
  }

  if (customer) {
    const alunoId = parseAlunoIdFromExternalRef(customer.externalReference);
    if (alunoId) {
      const r = await pool.query(
        'SELECT coach_id FROM public.alunos WHERE id = $1 LIMIT 1',
        [alunoId],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }

    if (customer.id) {
      const r = await pool.query(
        'SELECT coach_id FROM public.asaas_customers WHERE asaas_customer_id = $1 LIMIT 1',
        [customer.id],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }

    if (customer.email) {
      const r = await pool.query(
        'SELECT coach_id FROM public.alunos WHERE lower(email) = lower($1)',
        [customer.email],
      );
      if (r.rows.length === 1) return r.rows[0].coach_id;
    }
  }

  if (subscription) {
    const alunoId = parseAlunoIdFromExternalRef(subscription.externalReference);
    if (alunoId) {
      const r = await pool.query(
        'SELECT coach_id FROM public.alunos WHERE id = $1 LIMIT 1',
        [alunoId],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }

    if (subscription.customer) {
      const r = await pool.query(
        'SELECT coach_id FROM public.asaas_customers WHERE asaas_customer_id = $1 LIMIT 1',
        [subscription.customer],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }

    if (subscription.id) {
      const r = await pool.query(
        'SELECT coach_id FROM public.asaas_subscriptions WHERE asaas_subscription_id = $1 LIMIT 1',
        [subscription.id],
      );
      if (r.rows[0]?.coach_id) return r.rows[0].coach_id;
    }
  }

  return getSharedWebhookPrimaryCoachId(pool);
}

module.exports = {
  getCoachAsaasConfig,
  getCoachAsaasService,
  buildCustomerExternalRef,
  buildPaymentExternalRef,
  buildSubscriptionExternalRef,
  parseAlunoIdFromExternalRef,
  parsePaymentUuidFromExternalRef,
  usesSharedAsaasAccount,
  getSharedWebhookPrimaryCoachId,
  resolveCoachIdFromAsaasPayload,
};
