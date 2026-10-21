/**
 * Job periódico — normalização de pose em fotos de check-in (background).
 */
const cron = require('node-cron');
const normalization = require('../services/foto-pose-normalization.service');

class PhotoPoseNormalizationJob {
  constructor(pool) {
    this.pool = pool;
    this.isRunning = false;
  }

  start() {
    const intervalSec = Number(process.env.POSE_JOB_INTERVAL_SEC) || 45;
    const cronExpr = intervalSec >= 60 ? `*/${Math.max(1, Math.floor(intervalSec / 60))} * * * *` : '*/1 * * * *';

    cron.schedule(cronExpr, async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        const result = await normalization.processBatch(this.pool);
        if (result.processed > 0) {
          console.log(
            `[PhotoPoseNormalizationJob] ${result.processed}/${result.total} fotos classificadas`,
          );
        }
      } catch (error) {
        console.error('[PhotoPoseNormalizationJob] Erro:', error.message);
      } finally {
        this.isRunning = false;
      }
    });

    console.log(`[PhotoPoseNormalizationJob] Agendado (batch=${normalization.BATCH_LIMIT})`);
  }
}

module.exports = PhotoPoseNormalizationJob;
