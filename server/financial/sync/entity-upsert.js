const { PAYMENT_STATUS_MAP, SYNC_STATUS } = require('../constants');
const {
  parseAlunoIdFromExternalRef,
  parsePaymentUuidFromExternalRef,
  buildCustomerExternalRef,
} = require('../coach-asaas');
const { resolveAlunoAndCoachForAsaasCustomer } = require('./customer-matcher');
const { logFinancialAudit } = require('../audit/audit-logger');

function parseAsaasDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapAsaasPaymentStatus(payment, eventType) {
  if (payment?.status) return payment.status;
  const mapped = PAYMENT_STATUS_MAP[eventType];
  return mapped || 'PENDING';
}

async function resolveAlunoForPayment(pool, coachId, payment) {
  const extRef = payment.externalReference;
  const fromPaymentRef = parsePaymentUuidFromExternalRef(extRef);
  if (fromPaymentRef) {
    const byId = await pool.query(
      'SELECT aluno_id FROM public.asaas_payments WHERE id = $1 AND coach_id = $2 LIMIT 1',
      [fromPaymentRef, coachId],
    );
    if (byId.rows[0]?.aluno_id) return byId.rows[0].aluno_id;
  }

  const fromCustomerRef = parseAlunoIdFromExternalRef(extRef);
  if (fromCustomerRef) {
    const aluno = await pool.query(
      'SELECT id FROM public.alunos WHERE id = $1 AND coach_id = $2 LIMIT 1',
      [fromCustomerRef, coachId],
    );
    if (aluno.rows[0]) return aluno.rows[0].id;
  }

  if (payment.customer) {
    const cust = await pool.query(
      `SELECT aluno_id, coach_id FROM public.asaas_customers
       WHERE asaas_customer_id = $1 LIMIT 1`,
      [payment.customer],
    );
    if (cust.rows[0]?.aluno_id && cust.rows[0].coach_id === coachId) {
      return cust.rows[0].aluno_id;
    }
  }

  return null;
}

async function upsertPaymentFromAsaas(pool, coachId, payment, eventType) {
  const asaasPaymentId = payment.id;
  const asaasUpdatedAt = parseAsaasDate(payment.dateUpdated || payment.updatedAt);
  const status = mapAsaasPaymentStatus(payment, eventType);

  let existing = null;
  if (payment.externalReference) {
    const byRef = await pool.query(
      'SELECT * FROM public.asaas_payments WHERE coach_id = $1 AND external_reference = $2 LIMIT 1',
      [coachId, payment.externalReference],
    );
    existing = byRef.rows[0] || null;
  }
  if (!existing && asaasPaymentId) {
    const byAsaas = await pool.query(
      'SELECT * FROM public.asaas_payments WHERE asaas_payment_id = $1 LIMIT 1',
      [asaasPaymentId],
    );
    existing = byAsaas.rows[0] || null;
  }

  if (existing?.asaas_updated_at && asaasUpdatedAt) {
    const localTime = new Date(existing.asaas_updated_at).getTime();
    if (asaasUpdatedAt.getTime() < localTime && !['PAYMENT_DELETED', 'PAYMENT_REFUNDED'].includes(eventType)) {
      return { payment: existing, skipped: true };
    }
  }

  const alunoId = existing?.aluno_id || await resolveAlunoForPayment(pool, coachId, payment);
  const syncStatus = alunoId ? SYNC_STATUS.SYNCED : SYNC_STATUS.ORPHAN;

  const fields = {
    coach_id: coachId,
    aluno_id: alunoId,
    asaas_payment_id: asaasPaymentId,
    asaas_customer_id: payment.customer || existing?.asaas_customer_id,
    value: payment.value ?? existing?.value ?? 0,
    description: payment.description ?? existing?.description,
    billing_type: payment.billingType || existing?.billing_type || 'BOLETO',
    status,
    due_date: payment.dueDate || existing?.due_date,
    invoice_url: payment.invoiceUrl || existing?.invoice_url,
    bank_slip_url: payment.bankSlipUrl || existing?.bank_slip_url,
    pix_copy_paste: payment.pixCopyPaste || payment.pix?.copyPaste || existing?.pix_copy_paste,
    external_reference: payment.externalReference || existing?.external_reference,
    sync_status: syncStatus,
    asaas_updated_at: asaasUpdatedAt,
    payment_date: payment.paymentDate || existing?.payment_date,
    client_payment_date: payment.clientPaymentDate || existing?.client_payment_date,
    net_value: payment.netValue ?? existing?.net_value,
    deleted_at: eventType === 'PAYMENT_DELETED' ? new Date() : null,
  };

  let row;
  if (existing) {
    const result = await pool.query(
      `UPDATE public.asaas_payments SET
        aluno_id = COALESCE($1, aluno_id),
        asaas_payment_id = COALESCE($2, asaas_payment_id),
        asaas_customer_id = COALESCE($3, asaas_customer_id),
        value = $4,
        description = $5,
        billing_type = $6,
        status = $7,
        due_date = COALESCE($8, due_date),
        invoice_url = $9,
        bank_slip_url = $10,
        pix_copy_paste = $11,
        external_reference = COALESCE($12, external_reference),
        sync_status = $13,
        asaas_updated_at = $14,
        payment_date = $15,
        client_payment_date = $16,
        net_value = $17,
        deleted_at = $18,
        updated_at = NOW()
       WHERE id = $19
       RETURNING *`,
      [
        fields.aluno_id,
        fields.asaas_payment_id,
        fields.asaas_customer_id,
        fields.value,
        fields.description,
        fields.billing_type,
        fields.status,
        fields.due_date,
        fields.invoice_url,
        fields.bank_slip_url,
        fields.pix_copy_paste,
        fields.external_reference,
        fields.sync_status,
        fields.asaas_updated_at,
        fields.payment_date,
        fields.client_payment_date,
        fields.net_value,
        fields.deleted_at,
        existing.id,
      ],
    );
    row = result.rows[0];
  } else if (alunoId && fields.due_date) {
    const result = await pool.query(
      `INSERT INTO public.asaas_payments (
        coach_id, aluno_id, asaas_payment_id, asaas_customer_id, value, description,
        billing_type, status, due_date, invoice_url, bank_slip_url, pix_copy_paste,
        external_reference, sync_status, asaas_updated_at, payment_date, client_payment_date, net_value
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        fields.coach_id,
        fields.aluno_id,
        fields.asaas_payment_id,
        fields.asaas_customer_id,
        fields.value,
        fields.description,
        fields.billing_type,
        fields.status,
        fields.due_date,
        fields.invoice_url,
        fields.bank_slip_url,
        fields.pix_copy_paste,
        fields.external_reference,
        fields.sync_status,
        fields.asaas_updated_at,
        fields.payment_date,
        fields.client_payment_date,
        fields.net_value,
      ],
    );
    row = result.rows[0];
  } else {
    await logFinancialAudit(pool, {
      coachId,
      action: 'payment_orphan_skipped_insert',
      metadata: { asaasPaymentId, eventType },
    });
    return { payment: null, skipped: true, orphan: true };
  }

  await logFinancialAudit(pool, {
    coachId,
    alunoId: row.aluno_id,
    entityType: 'payment',
    entityId: row.id,
    action: existing ? 'payment_updated' : 'payment_imported',
    beforeState: existing,
    afterState: row,
    metadata: { eventType, asaasPaymentId },
  });

  return { payment: row, skipped: false };
}

async function upsertCustomerFromAsaas(pool, coachId, customer, eventType) {
  let resolvedAlunoId = parseAlunoIdFromExternalRef(customer.externalReference);
  const asaasUpdatedAt = parseAsaasDate(customer.dateUpdated || customer.updatedAt);
  const deletedAt = eventType === 'CUSTOMER_DELETED' ? new Date() : null;

  if (!resolvedAlunoId) {
    const matched = await resolveAlunoAndCoachForAsaasCustomer(pool, customer, { coachId });
    resolvedAlunoId = matched.alunoId || null;
  }

  if (!resolvedAlunoId) {
    await logFinancialAudit(pool, {
      coachId,
      action: 'customer_orphan',
      metadata: { asaasCustomerId: customer.id, eventType },
    });
    return null;
  }

  const existingByAluno = await pool.query(
    'SELECT * FROM public.asaas_customers WHERE coach_id = $1 AND aluno_id = $2 LIMIT 1',
    [coachId, resolvedAlunoId],
  );

  if (existingByAluno.rows[0]) {
    const result = await pool.query(
      `UPDATE public.asaas_customers SET
         asaas_customer_id = $1,
         asaas_external_reference = COALESCE($2, asaas_external_reference),
         sync_status = $3,
         asaas_updated_at = $4,
         deleted_at = $5,
         updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        customer.id,
        customer.externalReference || buildCustomerExternalRef(resolvedAlunoId),
        SYNC_STATUS.SYNCED,
        asaasUpdatedAt,
        deletedAt,
        existingByAluno.rows[0].id,
      ],
    );
    return result.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO public.asaas_customers
      (coach_id, aluno_id, asaas_customer_id, asaas_external_reference, sync_status, asaas_updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (asaas_customer_id) DO UPDATE SET
       coach_id = EXCLUDED.coach_id,
       aluno_id = COALESCE(EXCLUDED.aluno_id, public.asaas_customers.aluno_id),
       asaas_external_reference = COALESCE(EXCLUDED.asaas_external_reference, public.asaas_customers.asaas_external_reference),
       sync_status = EXCLUDED.sync_status,
       asaas_updated_at = EXCLUDED.asaas_updated_at,
       deleted_at = EXCLUDED.deleted_at,
       updated_at = NOW()
     RETURNING *`,
    [
      coachId,
      resolvedAlunoId,
      customer.id,
      customer.externalReference || buildCustomerExternalRef(resolvedAlunoId),
      SYNC_STATUS.SYNCED,
      asaasUpdatedAt,
      deletedAt,
    ],
  );

  return result.rows[0];
}

async function upsertSubscriptionFromAsaas(pool, coachId, subscription, eventType) {
  const alunoId = parseAlunoIdFromExternalRef(subscription.externalReference);
  const asaasUpdatedAt = parseAsaasDate(subscription.dateUpdated || subscription.updatedAt);
  const deletedAt = ['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'].includes(eventType)
    ? new Date()
    : null;

  let resolvedAlunoId = alunoId;
  if (!resolvedAlunoId && subscription.customer) {
    const cust = await pool.query(
      'SELECT aluno_id FROM public.asaas_customers WHERE coach_id = $1 AND asaas_customer_id = $2 LIMIT 1',
      [coachId, subscription.customer],
    );
    resolvedAlunoId = cust.rows[0]?.aluno_id || null;
  }

  if (!resolvedAlunoId) {
    await logFinancialAudit(pool, {
      coachId,
      action: 'subscription_orphan',
      metadata: { asaasSubscriptionId: subscription.id, eventType },
    });
    return null;
  }

  const result = await pool.query(
    `INSERT INTO public.asaas_subscriptions
      (coach_id, aluno_id, asaas_subscription_id, asaas_customer_id, external_reference,
       status, value, billing_type, cycle, next_due_date, sync_status, asaas_updated_at, deleted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (asaas_subscription_id) DO UPDATE SET
       status = EXCLUDED.status,
       value = EXCLUDED.value,
       billing_type = EXCLUDED.billing_type,
       cycle = EXCLUDED.cycle,
       next_due_date = EXCLUDED.next_due_date,
       sync_status = EXCLUDED.sync_status,
       asaas_updated_at = EXCLUDED.asaas_updated_at,
       deleted_at = EXCLUDED.deleted_at,
       updated_at = NOW()
     RETURNING *`,
    [
      coachId,
      resolvedAlunoId,
      subscription.id,
      subscription.customer,
      subscription.externalReference,
      subscription.status || 'ACTIVE',
      subscription.value,
      subscription.billingType || 'BOLETO',
      subscription.cycle,
      subscription.nextDueDate,
      SYNC_STATUS.SYNCED,
      asaasUpdatedAt,
      deletedAt,
    ],
  );

  return result.rows[0];
}

module.exports = {
  upsertPaymentFromAsaas,
  upsertCustomerFromAsaas,
  upsertSubscriptionFromAsaas,
  resolveAlunoForPayment,
};
