const crypto = require('crypto');
const { getCoachAsaasService, buildSubscriptionExternalRef } = require('../coach-asaas');
const { ensureAsaasCustomer } = require('./outbound-commander');
const { upsertSubscriptionFromAsaas } = require('./entity-upsert');
const { SYNC_STATUS } = require('../constants');
const { logFinancialAudit } = require('../audit/audit-logger');

async function createSubscriptionOutbound(pool, {
  coachId,
  aluno,
  value,
  billingType = 'BOLETO',
  cycle = 'MONTHLY',
  nextDueDate,
  paymentPlanId = null,
  description,
  actorId = null,
}) {
  const coachCtx = await getCoachAsaasService(pool, coachId);
  if (!coachCtx?.service) {
    throw new Error('Conta Asaas não configurada');
  }

  const subscriptionId = crypto.randomUUID();
  const externalReference = buildSubscriptionExternalRef(subscriptionId);
  const customerRow = await ensureAsaasCustomer(pool, coachId, aluno, coachCtx.service);

  const asaasSub = await coachCtx.service.createSubscription({
    customer: customerRow.asaas_customer_id,
    billingType,
    value,
    nextDueDate,
    cycle,
    description: description || `Assinatura - ${aluno.nome}`,
    externalReference,
  });

  await pool.query(
    `INSERT INTO public.asaas_subscriptions (
      id, coach_id, aluno_id, asaas_subscription_id, asaas_customer_id,
      payment_plan_id, external_reference, status, value, billing_type, cycle,
      next_due_date, sync_status, asaas_updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
    [
      subscriptionId,
      coachId,
      aluno.id,
      asaasSub.id,
      customerRow.asaas_customer_id,
      paymentPlanId,
      externalReference,
      asaasSub.status || 'ACTIVE',
      value,
      billingType,
      cycle,
      nextDueDate,
      SYNC_STATUS.SYNCED,
    ],
  );

  await logFinancialAudit(pool, {
    coachId,
    alunoId: aluno.id,
    entityType: 'subscription',
    entityId: subscriptionId,
    action: 'subscription_created_outbound',
    actorType: 'coach',
    actorId,
    metadata: { asaasSubscriptionId: asaasSub.id },
  });

  return upsertSubscriptionFromAsaas(pool, coachId, asaasSub, 'SUBSCRIPTION_CREATED');
}

module.exports = {
  createSubscriptionOutbound,
};
