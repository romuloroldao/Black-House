// Lembretes automáticos para coach com base em public.agenda_eventos

const cron = require('node-cron');
const logger = require('../utils/logger');
const { MILESTONES } = require('../services/agenda-coach-reminder-copy');
const {
  fetchMilestoneCandidates,
  fetchOverdueCandidates,
  registerDispatch,
  updateDispatchEmailStatus,
  MAX_OVERDUE_EMAILS_PER_COACH_PER_DAY,
} = require('../services/agenda-coach-reminder.service');

class AgendaCoachRemindersJob {
  constructor(pool, notificationService) {
    this.pool = pool;
    this.notificationService = notificationService;
    this.isRunning = false;
  }

  start() {
    cron.schedule('30 7 * * *', async () => {
      if (this.isRunning) {
        console.log('[AgendaCoachRemindersJob] Já em execução, pulando...');
        return;
      }
      this.isRunning = true;
      try {
        await this.execute();
      } catch (error) {
        console.error('[AgendaCoachRemindersJob] Erro:', error);
      } finally {
        this.isRunning = false;
      }
    });
    console.log('[AgendaCoachRemindersJob] Agendado diariamente às 7h30');
  }

  async execute() {
    const start = Date.now();
    let sent = 0;
    let skipped = 0;
    const overdueEmailCount = new Map();

    for (const m of MILESTONES) {
      const rows = await fetchMilestoneCandidates(this.pool, m.key, m.daysBefore);
      logger.logJob('AgendaCoachRemindersJob', 'running', {
        milestone: m.key,
        candidates: rows.length,
      });

      for (const row of rows) {
        const dispatch = await registerDispatch(this.pool, row, m.key);
        if (!dispatch) {
          skipped++;
          continue;
        }
        try {
          const result = await this.notificationService.notifyAgendaCoachReminder({
            agendaEventoId: row.agenda_evento_id,
            coachUserId: row.coach_id,
            alunoId: row.aluno_id,
            alunoNome: row.aluno_nome,
            tipo: row.event_tipo,
            milestone: m.key,
            eventDate: row.event_date,
            titulo: row.titulo,
            prioridade: row.prioridade,
            notificationChannel: row.notification_channel,
          });
          await updateDispatchEmailStatus(this.pool, dispatch.id, result.emailStatus, {
            provider: result.emailProvider,
            error: result.emailError,
          });
          sent++;
        } catch (error) {
          await updateDispatchEmailStatus(this.pool, dispatch.id, 'failed', {
            error: error.message,
          });
          logger.logJob('AgendaCoachRemindersJob', 'error', {
            agendaEventoId: row.agenda_evento_id,
            milestone: m.key,
            error: error.message,
          });
        }
      }
    }

    const overdueRows = await fetchOverdueCandidates(this.pool);
    for (const row of overdueRows) {
      const coachCount = overdueEmailCount.get(row.coach_id) || 0;
      const dispatch = await registerDispatch(this.pool, row, 'OVERDUE_DAILY');
      if (!dispatch) {
        skipped++;
        continue;
      }
      try {
        const skipEmailForCap = coachCount >= MAX_OVERDUE_EMAILS_PER_COACH_PER_DAY;
        const result = await this.notificationService.notifyAgendaCoachReminder({
          agendaEventoId: row.agenda_evento_id,
          coachUserId: row.coach_id,
          alunoId: row.aluno_id,
          alunoNome: row.aluno_nome,
          tipo: row.event_tipo,
          milestone: 'OVERDUE_DAILY',
          eventDate: row.event_date,
          titulo: row.titulo,
          prioridade: row.prioridade,
          notificationChannel: row.notification_channel,
          forceInAppOnly: skipEmailForCap,
        });
        if (result.emailStatus === 'sent') {
          overdueEmailCount.set(row.coach_id, coachCount + 1);
        }
        await updateDispatchEmailStatus(this.pool, dispatch.id, result.emailStatus, {
          provider: result.emailProvider,
          error: result.emailError,
        });
        sent++;
      } catch (error) {
        await updateDispatchEmailStatus(this.pool, dispatch.id, 'failed', {
          error: error.message,
        });
      }
    }

    logger.logJob('AgendaCoachRemindersJob', 'completed', {
      sent,
      skipped,
      overdue: overdueRows.length,
      durationMs: Date.now() - start,
    });
  }
}

module.exports = AgendaCoachRemindersJob;
