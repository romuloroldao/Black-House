/**
 * Email Queue Job — processa a fila de e-mails a cada 30 segundos.
 */

const cron = require('node-cron');
const { processEmailQueue, cleanupOldEmails, getQueueStats } = require('../utils/email-queue');

class EmailQueueJob {
  constructor(pool) {
    this.pool = pool;
    this.task = null;
    this.cleanupTask = null;
  }

  start() {
    // Processar fila a cada 30 segundos
    this.task = cron.schedule('*/30 * * * * *', async () => {
      try {
        const result = await processEmailQueue(this.pool);
        if (result.processed > 0) {
          console.log(`[EmailQueueJob] Processados: ${result.processed}, Enviados: ${result.sent}, Falharam: ${result.failed}`);
        }
      } catch (err) {
        console.error('[EmailQueueJob] Erro ao processar fila:', err.message);
      }
    });

    // Cleanup de e-mails antigos às 4h
    this.cleanupTask = cron.schedule('0 4 * * *', async () => {
      try {
        const deleted = await cleanupOldEmails(this.pool);
        if (deleted > 0) {
          console.log(`[EmailQueueJob] Cleanup: ${deleted} e-mails antigos removidos`);
        }
      } catch (err) {
        console.error('[EmailQueueJob] Erro no cleanup:', err.message);
      }
    });

    // Log stats ao iniciar
    this.logStats();

    console.log('[EmailQueueJob] Job de fila de e-mails iniciado (intervalo: 30s)');
  }

  async logStats() {
    try {
      const stats = await getQueueStats(this.pool);
      if (stats.length > 0) {
        console.log('[EmailQueueJob] Estado da fila:', 
          stats.map(s => `${s.status}=${s.count}`).join(', ')
        );
      }
    } catch (err) {
      // Ignora erros de stats no startup
    }
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask = null;
    }
  }
}

module.exports = EmailQueueJob;
