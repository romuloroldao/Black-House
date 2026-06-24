const { INBOX_WORKER_INTERVAL_MS } = require('../financial/constants');

class FinancialSyncWorkerJob {
  constructor(inboundProcessor) {
    this.inboundProcessor = inboundProcessor;
    this.isRunning = false;
    this.timer = null;
  }

  start() {
    if (!this.inboundProcessor) return;
    this.timer = setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.inboundProcessor.processBatch();
      } catch (err) {
        console.error('[FinancialSyncWorkerJob]', err.message);
      } finally {
        this.isRunning = false;
      }
    }, INBOX_WORKER_INTERVAL_MS);
    if (this.timer.unref) this.timer.unref();
    console.log('[FinancialSyncWorkerJob] Worker de inbox financeiro iniciado');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

module.exports = FinancialSyncWorkerJob;
