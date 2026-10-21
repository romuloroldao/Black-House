const crypto = require('crypto');
const { getCoachAsaasService, buildCustomerExternalRef, buildPaymentExternalRef } = require('../coach-asaas');
const { SYNC_STATUS } = require('../constants');
const { logFinancialAudit } = require('../audit/audit-logger');
const { upsertCustomerFromAsaas } = require('./entity-upsert');

async function ensureAsaasCustomer(pool, coachId, aluno, asaasService) {
  const extRef = buildCustomerExternalRef(aluno.id);
  const existing = await pool.query(
    `SELECT * FROM public.asaas_customers
     WHERE coach_id = $1 AND aluno_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [coachId, aluno.id],
  );
  if (existing.rows[0]) return existing.rows[0];

  const customer = await asaasService.createOrGetCustomer({
    name: aluno.nome,
    email: aluno.email || `${String(aluno.nome).toLowerCase().replace(/\s+/g, '.')}@aluno.temp`,
    cpfCnpj: aluno.cpf || undefined,
    phone: aluno.telefone || undefined,
    externalId: extRef,
  });

  return upsertCustomerFromAsaas(pool, coachId, customer, 'CUSTOMER_CREATED');
}

async function createPaymentOutbound(pool, {
  coachId,
  aluno,
  value,
  billingType,
  dueDate,
  description,
  actorId = null,
}) {
  const coachCtx = await getCoachAsaasService(pool, coachId);
  if (!coachCtx?.service) {
    const err = new Error('Conta Asaas não configurada para este coach.');
    err.statusCode = 503;
    err.error_code = 'ASAAS_NOT_CONFIGURED';
    throw err;
  }

  const paymentId = crypto.randomUUID();
  const externalReference = buildPaymentExternalRef(paymentId);

  const customerRow = await ensureAsaasCustomer(pool, coachId, aluno, coachCtx.service);
  if (!customerRow?.asaas_customer_id) {
    throw new Error('Não foi possível criar ou localizar o cliente no Asaas.');
  }

  await pool.query(
    `INSERT INTO public.asaas_payments (
      id, coach_id, aluno_id, value, billing_type, due_date, description,
      status, asaas_customer_id, external_reference, sync_status, last_outbound_attempt_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10,NOW())`,
    [
      paymentId,
      coachId,
      aluno.id,
      value,
      billingType,
      dueDate,
      description || null,
      customerRow.asaas_customer_id,
      externalReference,
      SYNC_STATUS.PENDING_OUTBOUND,
    ],
  );

  let asaasPayment;
  try {
    asaasPayment = await coachCtx.service.createPayment({
      customerId: customerRow.asaas_customer_id,
      value,
      billingType,
      dueDate,
      description: description || `Pagamento - ${aluno.nome}`,
      externalReference,
    });
  } catch (err) {
    await pool.query('DELETE FROM public.asaas_payments WHERE id = $1', [paymentId]);
    throw err;
  }

  const result = await pool.query(
    `UPDATE public.asaas_payments SET
      asaas_payment_id = $1,
      status = $2,
      invoice_url = $3,
      bank_slip_url = $4,
      pix_copy_paste = $5,
      sync_status = $6,
      asaas_updated_at = NOW(),
      updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      asaasPayment.id,
      asaasPayment.status || 'PENDING',
      asaasPayment.invoiceUrl || null,
      asaasPayment.bankSlipUrl || null,
      asaasPayment.pix?.copyPaste || asaasPayment.pixCopyPaste || null,
      SYNC_STATUS.SYNCED,
      paymentId,
    ],
  );

  await logFinancialAudit(pool, {
    coachId,
    alunoId: aluno.id,
    entityType: 'payment',
    entityId: paymentId,
    action: 'payment_created_outbound',
    actorType: 'coach',
    actorId,
    afterState: result.rows[0],
    metadata: { asaasPaymentId: asaasPayment.id },
  });

  return result.rows[0];
}

async function syncAlunoToAsaasCustomer(pool, coachId, aluno) {
  const coachCtx = await getCoachAsaasService(pool, coachId);
  if (!coachCtx?.service) return null;

  const existing = await pool.query(
    'SELECT * FROM public.asaas_customers WHERE coach_id = $1 AND aluno_id = $2 LIMIT 1',
    [coachId, aluno.id],
  );

  const payload = {
    name: aluno.nome,
    email: aluno.email,
    cpfCnpj: aluno.cpf,
    phone: aluno.telefone,
    externalReference: buildCustomerExternalRef(aluno.id),
  };

  if (existing.rows[0]?.asaas_customer_id) {
    const updated = await coachCtx.service.updateCustomer(existing.rows[0].asaas_customer_id, payload);
    return upsertCustomerFromAsaas(pool, coachId, updated, 'CUSTOMER_UPDATED');
  }

  const created = await coachCtx.service.createOrGetCustomer({
    ...payload,
    externalId: payload.externalReference,
  });
  return upsertCustomerFromAsaas(pool, coachId, created, 'CUSTOMER_CREATED');
}

module.exports = {
  ensureAsaasCustomer,
  createPaymentOutbound,
  syncAlunoToAsaasCustomer,
};
