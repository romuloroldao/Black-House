/**
 * Despacha avisos de dieta/treino actualizados (plan_change_notifications) a cada 15 segundos.
 */

const cron = require('node-cron');

class PlanChangeNotificationsJob {
  /**
   * @param {import('../services/plan-change-notification.service').PlanChangeNotificationService} notifier
   */
  constructor(notifier) {
    this.notifier = notifier;
    this.task = null;
    this.running = false;
  }

  start() {
    this.task = cron.schedule('*/15 * * * * *', async () => {
      if (this.running) return;
      this.running = true;
      try {
        const stats = await this.notifier.dispatchDue();
        if (stats.processed > 0) {
          console.log(
            `[PlanChangeNotificationsJob] processados=${stats.processed} enviados=${stats.sent} ` +
              `cancelados=${stats.cancelled} reagendados=${stats.retried} falharam=${stats.failed}`,
          );
        }
      } catch (err) {
        console.error('[PlanChangeNotificationsJob] Erro:', err.message);
      } finally {
        this.running = false;
      }
    });
    console.log('[PlanChangeNotificationsJob] Avisos de dieta/treino actualizados (intervalo: 15s)');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }
}

module.exports = PlanChangeNotificationsJob;
