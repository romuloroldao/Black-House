// Lembrete de check-in no dia da turma, 9h America/Sao_Paulo.
// Um aviso por semana para quem ainda não enviou o check-in.

const cron = require('node-cron');
const logger = require('../utils/logger');
const { partsInTimeZone, startOfWeekInTimeZone } = require('../utils/zoned-time');

const TZ = 'America/Sao_Paulo';

function isoWeekday(date = new Date(), timeZone = TZ) {
  const parts = partsInTimeZone(date, timeZone);
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[parts.weekday] || null;
}

class TurmaCheckinRemindersJob {
  constructor(pool, notificationService) {
    this.pool = pool;
    this.notificationService = notificationService;
    this.isRunning = false;
  }

  start() {
    cron.schedule('0 9 * * *', async () => {
      if (this.isRunning) {
        console.log('[TurmaCheckinRemindersJob] Já em execução, pulando...');
        return;
      }
      this.isRunning = true;
      try {
        await this.execute();
      } catch (error) {
        console.error('[TurmaCheckinRemindersJob] Erro:', error);
      } finally {
        this.isRunning = false;
      }
    }, { timezone: TZ });
    console.log('[TurmaCheckinRemindersJob] Agendado diariamente às 9h (America/Sao_Paulo)');
  }

  async execute(now = new Date()) {
    const weekday = isoWeekday(now, TZ);
    if (!weekday) return { sent: 0, skipped: 0 };
    const weekStart = startOfWeekInTimeZone(now, TZ);

    const rows = await this.pool.query(
      `SELECT DISTINCT a.id AS aluno_id, a.coach_id
       FROM public.alunos a
       INNER JOIN public.turmas_alunos ta ON ta.aluno_id = a.id
       INNER JOIN public.turmas t ON t.id = ta.turma_id
       WHERE COALESCE(t.ativo, true) = true
         AND t.dia_semana = $1
         AND a.coach_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.weekly_checkins wc
           WHERE wc.aluno_id = a.id
             AND wc.created_at >= $2::timestamptz
         )`,
      [weekday, weekStart.toISOString()],
    );

    let sent = 0;
    let skipped = 0;
    for (const row of rows.rows) {
      try {
        const result = await this.notificationService.notifyTurmaCheckinWindow({
          alunoId: row.aluno_id,
          coachId: row.coach_id,
        });
        if (result?.sent) sent += 1;
        else skipped += 1;
      } catch (error) {
        skipped += 1;
        logger.logJob('TurmaCheckinRemindersJob', 'error', {
          alunoId: row.aluno_id,
          error: error.message,
        });
      }
    }

    logger.logJob('TurmaCheckinRemindersJob', 'completed', {
      weekday,
      candidates: rows.rows.length,
      sent,
      skipped,
    });
    return { sent, skipped, weekday };
  }
}

module.exports = TurmaCheckinRemindersJob;
module.exports.isoWeekday = isoWeekday;
