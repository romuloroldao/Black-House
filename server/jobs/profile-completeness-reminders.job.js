// Lembretes para alunos com perfil incompleto (máx. 1x/semana)

const cron = require('node-cron');
const { evaluateAlunoProfile } = require('../services/profile-completeness.service');

class ProfileCompletenessRemindersJob {
  constructor(pool, notificationService) {
    this.pool = pool;
    this.notificationService = notificationService;
    this.isRunning = false;
  }

  start() {
    cron.schedule('0 9 * * *', async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.execute();
      } catch (error) {
        console.error('[ProfileCompletenessRemindersJob] Erro:', error);
      } finally {
        this.isRunning = false;
      }
    });
    console.log('[ProfileCompletenessRemindersJob] Agendado diariamente às 09h');
  }

  async execute() {
    const r = await this.pool.query(
      `SELECT a.*
       FROM public.alunos a
       LEFT JOIN public.student_profile_state s ON s.aluno_id = a.id
       WHERE a.coach_id IS NOT NULL
         AND (s.is_complete IS NULL OR s.is_complete = false)
         AND (s.last_reminder_at IS NULL OR s.last_reminder_at < now() - interval '7 days')`,
    );

    console.log(`[ProfileCompletenessRemindersJob] ${r.rows.length} candidatos`);

    for (const aluno of r.rows) {
      const evaluation = evaluateAlunoProfile(aluno);
      if (evaluation.is_complete) continue;

      const created = new Date(aluno.created_at || 0);
      const daysSinceCreated = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated < 3) continue;

      try {
        await this.notificationService.notifyProfileIncompleteReminder(aluno.id, {
          missingFields: evaluation.missing_fields,
          completionPct: evaluation.completion_pct,
        });
      } catch (err) {
        console.error(`[ProfileCompletenessRemindersJob] aluno ${aluno.id}:`, err);
      }
    }
  }
}

module.exports = ProfileCompletenessRemindersJob;
