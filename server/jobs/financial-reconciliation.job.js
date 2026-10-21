const cron = require('node-cron');
const { reconcileAllCoaches } = require('../financial/sync/reconciler');

class FinancialReconciliationJob {
  constructor(pool, notificationService) {
    this.pool = pool;
    this.notificationService = notificationService;
    this.isRunning = false;
  }

  start() {
    cron.schedule('0 */6 * * *', async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        const count = await reconcileAllCoaches(this.pool, this.notificationService);
        console.log(`[FinancialReconciliationJob] ${count} coaches reconciliados`);
      } catch (err) {
        console.error('[FinancialReconciliationJob]', err.message);
      } finally {
        this.isRunning = false;
      }
    });
    console.log('[FinancialReconciliationJob] Agendado a cada 6 horas');
  }
}

module.exports = FinancialReconciliationJob;
