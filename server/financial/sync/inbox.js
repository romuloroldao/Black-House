const { INBOX_STATUS, MAX_INBOX_ATTEMPTS } = require('../constants');
const { logFinancialAudit, hashPayload } = require('../audit/audit-logger');

function extractEventId(payload) {
  if (payload?.id) return String(payload.id);
  const entity = payload?.payment || payload?.customer || payload?.subscription;
  if (entity?.id && payload?.event) {
    return `${payload.event}_${entity.id}_${entity.dateUpdated || entity.updatedAt || ''}`;
  }
  return `${payload?.event || 'unknown'}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function inferEntityType(eventType, payload) {
  if (payload?.payment || String(eventType || '').startsWith('PAYMENT_')) return 'payment';
  if (payload?.customer || String(eventType || '').startsWith('CUSTOMER_')) return 'customer';
  if (payload?.subscription || String(eventType || '').startsWith('SUBSCRIPTION_')) return 'subscription';
  return null;
}

function inferEntityAsaasId(eventType, payload) {
  if (payload?.payment?.id) return payload.payment.id;
  if (payload?.customer?.id) return payload.customer.id;
  if (payload?.subscription?.id) return payload.subscription.id;
  return null;
}

async function enqueueFinancialEvent(pool, {
  coachId,
  source,
  eventType,
  payload,
  eventId = null,
}) {
  const resolvedEventId = eventId || extractEventId(payload);
  const entityType = inferEntityType(eventType, payload);
  const entityAsaasId = inferEntityAsaasId(eventType, payload);

  const result = await pool.query(
    `INSERT INTO public.financial_sync_inbox
      (coach_id, source, event_id, event_type, entity_type, entity_asaas_id, payload, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (coach_id, event_id) DO NOTHING
     RETURNING *`,
    [
      coachId,
      source,
      resolvedEventId,
      eventType,
      entityType,
      entityAsaasId,
      JSON.stringify(payload),
      INBOX_STATUS.RECEIVED,
    ],
  );

  if (result.rows[0]) {
    await logFinancialAudit(pool, {
      coachId,
      entityType: 'inbox',
      entityId: result.rows[0].id,
      action: 'webhook_enqueued',
      metadata: { eventType, eventId: resolvedEventId, payloadHash: hashPayload(payload) },
    });
  }

  return result.rows[0] || null;
}

async function claimInboxBatch(pool, limit = 25) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query(
      `SELECT * FROM public.financial_sync_inbox
       WHERE status IN ($1, $2)
         AND attempts < $3
       ORDER BY received_at ASC
       LIMIT $4
       FOR UPDATE SKIP LOCKED`,
      [INBOX_STATUS.RECEIVED, INBOX_STATUS.FAILED, MAX_INBOX_ATTEMPTS, limit],
    );

    if (claimed.rows.length === 0) {
      await client.query('COMMIT');
      return [];
    }

    const ids = claimed.rows.map((r) => r.id);
    await client.query(
      `UPDATE public.financial_sync_inbox
       SET status = $1, attempts = attempts + 1
       WHERE id = ANY($2::uuid[])`,
      [INBOX_STATUS.PROCESSING, ids],
    );
    await client.query('COMMIT');
    return claimed.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markInboxProcessed(pool, inboxId) {
  await pool.query(
    `UPDATE public.financial_sync_inbox
     SET status = $1, processed_at = NOW(), error_message = NULL
     WHERE id = $2`,
    [INBOX_STATUS.PROCESSED, inboxId],
  );
}

async function markInboxFailed(pool, inboxId, errorMessage, attempts) {
  const status = attempts >= MAX_INBOX_ATTEMPTS ? INBOX_STATUS.DEAD_LETTER : INBOX_STATUS.FAILED;
  await pool.query(
    `UPDATE public.financial_sync_inbox
     SET status = $1, error_message = $2
     WHERE id = $3`,
    [status, errorMessage, inboxId],
  );
}

module.exports = {
  enqueueFinancialEvent,
  claimInboxBatch,
  markInboxProcessed,
  markInboxFailed,
  extractEventId,
};
