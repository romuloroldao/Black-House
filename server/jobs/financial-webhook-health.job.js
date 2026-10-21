const cron = require('node-cron');
const AsaasService = require('../services/asaas.service');
const { getCoachAsaasService, usesSharedAsaasAccount } = require('../financial/coach-asaas');
const { registerCoachWebhook, registerSharedAsaasWebhook } = require('../financial/sync/webhook-registration');
const logger = require('../utils/logger');

class FinancialWebhookHealthJob {
  constructor(pool) {
    this.pool = pool;
    this.isRunning = false;
  }

  start() {
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.execute();
      } catch (err) {
        logger.error('financial.webhook_health.failed', { error: err.message });
      } finally {
        this.isRunning = false;
      }
    });
    console.log('[FinancialWebhookHealthJob] Agendado a cada hora');
  }

  async execute() {
    if (usesSharedAsaasAccount()) {
      try {
        let service = null;
        if (process.env.ASAAS_API_KEY) {
          service = new AsaasService(
            process.env.ASAAS_API_KEY,
            process.env.ASAAS_ENVIRONMENT || 'production',
          );
        } else {
          const configs = await this.pool.query(
            `SELECT coach_id FROM public.asaas_config WHERE asaas_api_key IS NOT NULL LIMIT 1`,
          );
          if (configs.rows[0]) {
            const ctx = await getCoachAsaasService(this.pool, configs.rows[0].coach_id);
            service = ctx?.service || null;
          }
        }
        if (!service) return;

        const webhooks = await service.listWebhooks();
        const items = webhooks.data || webhooks || [];
        const sharedUrlSuffix = '/api/webhooks/asaas/shared';
        const ours = items.find((w) => String(w.url || '').endsWith(sharedUrlSuffix));

        if (!ours || ours.interrupted) {
          logger.warn('financial.webhook_health.reregister_shared', {
            interrupted: ours?.interrupted,
          });
          await registerSharedAsaasWebhook(this.pool, service);
        }
      } catch (err) {
        logger.error('financial.webhook_health.shared_failed', { error: err.message });
      }
      return;
    }

    const configs = await this.pool.query(
      `SELECT coach_id, webhook_id FROM public.asaas_config
       WHERE asaas_api_key IS NOT NULL`,
    );

    for (const row of configs.rows) {
      try {
        const ctx = await getCoachAsaasService(this.pool, row.coach_id);
        if (!ctx?.service) continue;

        const webhooks = await ctx.service.listWebhooks();
        const items = webhooks.data || webhooks || [];
        const ours = items.find((w) => w.id === row.webhook_id) || items[0];

        if (!ours || ours.interrupted) {
          logger.warn('financial.webhook_health.reregister', {
            coachId: row.coach_id,
            interrupted: ours?.interrupted,
          });
          await registerCoachWebhook(this.pool, row.coach_id, ctx.service);
        }
      } catch (err) {
        logger.error('financial.webhook_health.coach_failed', {
          coachId: row.coach_id,
          error: err.message,
        });
      }
    }
  }
}

module.exports = FinancialWebhookHealthJob;
