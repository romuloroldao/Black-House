// Lembretes de retorno de dieta e treino (-2, -1, 0 dias) com preferência in-app / email

const cron = require('node-cron');
const logger = require('../utils/logger');
const {
  MILESTONES,
  fetchCandidates,
  registerDispatch,
  updateDispatchEmailStatus,
} = require('../services/return-reminder.service');

class ReturnRemindersJob {
  constructor(pool, notificationService) {
    this.pool = pool;
    this.notificationService = notificationService;
    this.isRunning = false;
  }

  start() {
    cron.schedule('0 8 * * *', async () => {
      if (this.isRunning) {
        console.log('[ReturnRemindersJob] Já em execução, pulando...');
        return;
      }
      this.isRunning = true;
      try {
        await this.execute();
      } catch (error) {
        console.error('[ReturnRemindersJob] Erro:', error);
      } finally {
        this.isRunning = false;
      }
    });
    console.log('[ReturnRemindersJob] Agendado diariamente às 8h');
  }

  async execute() {
    const start = Date.now();
    let sent = 0;
    let skipped = 0;

    for (const domain of ['diet', 'workout']) {
      for (const m of MILESTONES) {
        const rows = await fetchCandidates(this.pool, domain, m.key, m.daysBefore);
        logger.logJob('ReturnRemindersJob', 'running', {
          domain,
          milestone: m.key,
          candidates: rows.length,
        });

        for (const row of rows) {
          const dispatch = await registerDispatch(this.pool, {
            domain,
            entityId: row.entity_id,
            alunoId: row.aluno_id,
            coachId: row.coach_id,
            scheduleCycleId: row.schedule_cycle_id,
            milestone: m.key,
            returnDate: row.return_date,
            notificationChannel: row.notification_channel,
            emailStatus: 'pending',
          });

          if (!dispatch) {
            skipped++;
            continue;
          }

          try {
            const emailResult = await this.notificationService.notifyReturnReminder({
              domain,
              milestone: m.key,
              entityId: row.entity_id,
              alunoId: row.aluno_id,
              coachId: row.coach_id,
              alunoNome: row.aluno_nome,
              coachNome: row.coach_nome,
              planoNome: row.plano_nome,
              returnDate: row.return_date,
              notificationChannel: row.notification_channel,
            });

            await updateDispatchEmailStatus(this.pool, dispatch.id, emailResult.emailStatus, {
              provider: emailResult.emailProvider,
              error: emailResult.emailError,
            });
            sent++;
          } catch (error) {
            await updateDispatchEmailStatus(this.pool, dispatch.id, 'failed', {
              error: error.message,
            });
            logger.logJob('ReturnRemindersJob', 'error', {
              domain,
              entityId: row.entity_id,
              milestone: m.key,
              error: error.message,
            });
          }
        }
      }
    }

    logger.logJob('ReturnRemindersJob', 'completed', {
      sent,
      skipped,
      durationMs: Date.now() - start,
    });
  }
}

module.exports = ReturnRemindersJob;
