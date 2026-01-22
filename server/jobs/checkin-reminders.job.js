// Check-in Reminders Job
// Envia lembretes para alunos fazerem check-in semanal

const cron = require('node-cron');

class CheckinRemindersJob {
    constructor(pool, notificationService) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.isRunning = false;
    }

    /**
     * Inicia o job
     */
    start() {
        // Executa toda segunda-feira às 10h
        cron.schedule('0 10 * * 1', async () => {
            if (this.isRunning) {
                console.log('CheckinRemindersJob já está em execução, pulando...');
                return;
            }

            this.isRunning = true;
            console.log('[CheckinRemindersJob] Iniciando execução...');

            try {
                await this.execute();
                console.log('[CheckinRemindersJob] Execução concluída com sucesso');
            } catch (error) {
                console.error('[CheckinRemindersJob] Erro na execução:', error);
            } finally {
                this.isRunning = false;
            }
        });

        console.log('[CheckinRemindersJob] Agendado para executar toda segunda-feira às 10h');
    }

    /**
     * Executa a lógica do job
     */
    async execute() {
        try {
            // Buscar alunos que não fizeram check-in na última semana
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const alunosResult = await this.pool.query(
                `SELECT DISTINCT a.id, a.nome, a.coach_id
                 FROM public.alunos a
                 LEFT JOIN public.feedbacks_alunos f 
                   ON f.aluno_id = a.id 
                   AND f.created_at >= $1
                 WHERE f.id IS NULL
                   AND a.coach_id IS NOT NULL`,
                [oneWeekAgo]
            );

            console.log(`[CheckinRemindersJob] Encontrados ${alunosResult.rows.length} alunos sem check-in`);

            for (const aluno of alunosResult.rows) {
                try {
                    await this.notificationService.notifyCheckinReminder(
                        aluno.id,
                        aluno.coach_id
                    );

                    console.log(`[CheckinRemindersJob] Lembrete enviado para aluno ${aluno.id}`);
                } catch (error) {
                    console.error(`[CheckinRemindersJob] Erro ao processar aluno ${aluno.id}:`, error);
                }
            }
        } catch (error) {
            console.error('[CheckinRemindersJob] Erro na execução:', error);
            throw error;
        }
    }
}

module.exports = CheckinRemindersJob;
