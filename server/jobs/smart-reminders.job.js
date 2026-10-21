// Smart Reminders Job — processa lembretes condicionais a cada 15 minutos

const cron = require('node-cron');
const logger = require('../utils/logger');
const smartReminderEngine = require('../services/smart-reminder/engine');

class SmartRemindersJob {
  constructor(pool, notificationService) {
    this.pool = pool;
    this.notificationService = notificationService;
    this.isRunning = false;
  }

  start() {
    cron.schedule('*/15 * * * *', async () => {
      if (this.isRunning) {
        console.log('[SmartRemindersJob] Já em execução, pulando...');
        return;
      }
      this.isRunning = true;
      try {
        await this.execute();
      } catch (error) {
        console.error('[SmartRemindersJob] Erro:', error);
      } finally {
        this.isRunning = false;
      }
    });
    console.log('[SmartRemindersJob] Agendado a cada 15 minutos');
  }

  async execute() {
    const start = Date.now();
    const stats = await smartReminderEngine.processAll(this.pool, this.notificationService);
    logger.logJob('SmartRemindersJob', 'completed', {
      ...stats,
      durationMs: Date.now() - start,
    });
    return stats;
  }
}

module.exports = SmartRemindersJob;
