const InboundProcessor = require('./sync/inbound-processor');
const { INBOX_WORKER_INTERVAL_MS } = require('./constants');

function createFinancialSync(pool, notificationService) {
  const inboundProcessor = new InboundProcessor(pool, notificationService);
  let workerTimer = null;

  function startWorker() {
    if (workerTimer) return;
    workerTimer = setInterval(() => {
      inboundProcessor.processBatch().catch((err) => {
        require('../utils/logger').error('financial.worker.tick_failed', { error: err.message });
      });
    }, INBOX_WORKER_INTERVAL_MS);
    if (workerTimer.unref) workerTimer.unref();
  }

  function stopWorker() {
    if (workerTimer) {
      clearInterval(workerTimer);
      workerTimer = null;
    }
  }

  return {
    inboundProcessor,
    startWorker,
    stopWorker,
  };
}

module.exports = {
  createFinancialSync,
};
