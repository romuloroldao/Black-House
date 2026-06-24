const express = require('express');
const { enqueueFinancialEvent } = require('../financial/sync/inbox');
const {
  timingSafeEqualToken,
  getCoachWebhookToken,
} = require('../financial/sync/webhook-registration');
const { resolveCoachIdFromAsaasPayload } = require('../financial/coach-asaas');
const { logFinancialAudit } = require('../financial/audit/audit-logger');
const logger = require('../utils/logger');

async function handleFinancialWebhook(pool, inboundProcessor, coachId, req, res) {
  try {
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    if (contentLength > 1024 * 1024) {
      return res.status(413).json({ error: 'Payload muito grande' });
    }

    const expectedToken = await getCoachWebhookToken(pool, coachId);
    const providedToken =
      req.headers['asaas-access-token'] || req.body?.token || null;

    const legacyToken = process.env.ASAAS_WEBHOOK_TOKEN;
    const tokenValid =
      (expectedToken && timingSafeEqualToken(providedToken, expectedToken)) ||
      (legacyToken && timingSafeEqualToken(providedToken, legacyToken));

    if (!tokenValid) {
      logger.warn('financial.webhook.unauthorized', { coachId });
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const payload = req.body;
    const eventType = payload?.event;
    if (!eventType) {
      return res.status(400).json({ error: 'Evento inválido' });
    }

    const inboxRow = await enqueueFinancialEvent(pool, {
      coachId,
      source: 'webhook',
      eventType,
      payload,
    });

    await logFinancialAudit(pool, {
      coachId,
      action: 'webhook_received',
      metadata: { eventType, inboxId: inboxRow?.id || null },
    });

    if (inboundProcessor) {
      setImmediate(() => {
        inboundProcessor.processBatch().catch((err) => {
          logger.error('financial.webhook.async_process_failed', { error: err.message });
        });
      });
    }

    return res.status(200).json({ success: true, received: true });
  } catch (error) {
    logger.error('financial.webhook.handler_error', { coachId, error: error.message });
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}

function createFinancialWebhookRouter(pool, inboundProcessor) {
  const router = express.Router();

  router.post('/asaas/shared', async (req, res) => {
    const coachId = await resolveCoachIdFromAsaasPayload(pool, req.body);
    if (!coachId) {
      logger.warn('financial.webhook.shared_unresolved_coach', {
        event: req.body?.event,
      });
      return res.status(422).json({ error: 'Coach não identificado para este evento' });
    }

    logger.info('financial.webhook.shared_routed', {
      coachId,
      event: req.body?.event,
    });

    return handleFinancialWebhook(pool, inboundProcessor, coachId, req, res);
  });

  router.post('/asaas/:coachId', async (req, res) => {
    const { coachId } = req.params;
    return handleFinancialWebhook(pool, inboundProcessor, coachId, req, res);
  });

  return router;
}

module.exports = createFinancialWebhookRouter;
