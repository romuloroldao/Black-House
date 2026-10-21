// Daily Adherence Job — marca missed meal/workout do dia anterior (Phase 5)

const cron = require('node-cron');
const logger = require('../utils/logger');
const behavioral = require('../services/behavioral-insight.service');

class DailyAdherenceJob {
  constructor(pool) {
    this.pool = pool;
    this.isRunning = false;
  }

  start() {
    // 23:10 todos os dias — fecha o dia corrente; job usa dataRef=hoje ao correr tarde
    // e também processa ontem na primeira passagem da madrugada via flag.
    cron.schedule('10 23 * * *', async () => {
      await this.runSafe('today');
    });
    // Backup 00:20 — garante missed do dia civil anterior
    cron.schedule('20 0 * * *', async () => {
      await this.runSafe('yesterday');
    });
    console.log('[DailyAdherenceJob] Agendado 23:10 e 00:20');
  }

  async runSafe(mode) {
    if (this.isRunning) {
      console.log('[DailyAdherenceJob] Já em execução, pulando...');
      return;
    }
    this.isRunning = true;
    try {
      await this.execute(mode);
    } catch (error) {
      console.error('[DailyAdherenceJob] Erro:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async execute(mode = 'yesterday') {
    const start = Date.now();
    const dataRef =
      mode === 'today'
        ? behavioral.todayIso()
        : behavioral.addDaysIso(behavioral.todayIso(), -1);
    const stats = await behavioral.recordDailyMisses(this.pool, { dataRef });
    logger.logJob('DailyAdherenceJob', 'completed', {
      mode,
      ...stats,
      durationMs: Date.now() - start,
    });
    return stats;
  }
}

module.exports = DailyAdherenceJob;
