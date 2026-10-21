const { INBOX_BATCH_SIZE } = require('../constants');
const { claimInboxBatch, markInboxProcessed, markInboxFailed } = require('./inbox');
const {
  upsertPaymentFromAsaas,
  upsertCustomerFromAsaas,
  upsertSubscriptionFromAsaas,
} = require('./entity-upsert');
const { recalculateStudentAccess } = require('../access/access-engine');
const logger = require('../../utils/logger');

class InboundProcessor {
  constructor(pool, notificationService) {
    this.pool = pool;
    this.notificationService = notificationService;
    this.isProcessing = false;
  }

  async processEvent(row) {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    const eventType = row.event_type || payload.event;
    const coachId = row.coach_id;
    let alunoIds = new Set();

    if (payload.payment) {
      const { payment, skipped } = await upsertPaymentFromAsaas(this.pool, coachId, payload.payment, eventType);
      if (payment?.aluno_id) {
        alunoIds.add(payment.aluno_id);
        if (!skipped && this.notificationService) {
          await this.notificationService.notifyPaymentStatus(
            payment.id,
            coachId,
            payment.status,
            {
              asaasPaymentId: payment.asaas_payment_id,
              pixCopyPaste: payment.pix_copy_paste,
              invoiceUrl: payment.invoice_url,
            },
          );
        }
      }
    }

    if (payload.customer) {
      const customer = await upsertCustomerFromAsaas(this.pool, coachId, payload.customer, eventType);
      if (customer?.aluno_id) alunoIds.add(customer.aluno_id);
    }

    if (payload.subscription) {
      const sub = await upsertSubscriptionFromAsaas(this.pool, coachId, payload.subscription, eventType);
      if (sub?.aluno_id) alunoIds.add(sub.aluno_id);
    }

    for (const alunoId of alunoIds) {
      await recalculateStudentAccess(this.pool, alunoId, {
        notificationService: this.notificationService,
      });
    }
  }

  async processBatch(limit = INBOX_BATCH_SIZE) {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    let processed = 0;

    try {
      const batch = await claimInboxBatch(this.pool, limit);
      for (const row of batch) {
        try {
          await this.processEvent(row);
          await markInboxProcessed(this.pool, row.id);
          processed += 1;
        } catch (err) {
          logger.error('financial.inbound.event_failed', {
            inboxId: row.id,
            eventType: row.event_type,
            error: err.message,
          });
          await markInboxFailed(this.pool, row.id, err.message, row.attempts + 1);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return processed;
  }
}

module.exports = InboundProcessor;
