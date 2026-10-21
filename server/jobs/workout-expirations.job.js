// Workout Expirations Job
// Notifica coach antes do vencimento do treino (ou no dia do vencimento)

const cron = require('node-cron');

class WorkoutExpirationsJob {
    constructor(pool, notificationService) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.isRunning = false;
    }

    /**
     * Inicia o job
     */
    start() {
        // Executa diariamente às 7h
        cron.schedule('0 7 * * *', async () => {
            if (this.isRunning) {
                console.log('WorkoutExpirationsJob já está em execução, pulando...');
                return;
            }

            this.isRunning = true;
            console.log('[WorkoutExpirationsJob] Iniciando execução...');

            try {
                await this.execute();
                console.log('[WorkoutExpirationsJob] Execução concluída com sucesso');
            } catch (error) {
                console.error('[WorkoutExpirationsJob] Erro na execução:', error);
            } finally {
                this.isRunning = false;
            }
        });

        console.log('[WorkoutExpirationsJob] Agendado para executar diariamente às 7h');
    }

    /**
     * Executa a lógica do job
     */
    async execute() {
        try {
            // Busca treinos activos cujo dia de lembrete é hoje:
            // data_expiracao - dias_antecedencia_notificacao == hoje
            const expiredResult = await this.pool.query(
                `SELECT
                    at.*,
                    a.nome AS aluno_nome,
                    a.coach_id,
                    t.nome AS treino_nome
                 FROM public.alunos_treinos at
                 JOIN public.alunos a ON at.aluno_id = a.id
                 LEFT JOIN public.treinos t ON t.id = at.treino_id
                 WHERE at.data_expiracao IS NOT NULL
                   AND COALESCE(at.ativo, true) = true
                   AND COALESCE(at.notificacao_expiracao_enviada, false) = false
                   AND DATE(
                        at.data_expiracao
                        - (COALESCE(at.dias_antecedencia_notificacao, 1) || ' days')::interval
                   ) = CURRENT_DATE`
            );

            console.log(`[WorkoutExpirationsJob] Encontrados ${expiredResult.rows.length} treinos para lembrete`);

            for (const workout of expiredResult.rows) {
                try {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const expirationDate = new Date(workout.data_expiracao);
                    expirationDate.setHours(0, 0, 0, 0);
                    const diffMs = expirationDate.getTime() - today.getTime();
                    const daysUntilExpiration = Math.round(diffMs / (1000 * 60 * 60 * 24));
                    await this.notificationService.notifyWorkoutExpirationReminder(
                        workout,
                        daysUntilExpiration,
                    );

                    // Marcar como notificado
                    await this.pool.query(
                        `UPDATE public.alunos_treinos
                         SET notificacao_expiracao_enviada = true,
                             expiration_notified = true
                         WHERE id = $1`,
                        [workout.id]
                    );

                    console.log(`[WorkoutExpirationsJob] Lembrete enviado para treino ${workout.id}`);
                } catch (error) {
                    console.error(`[WorkoutExpirationsJob] Erro ao processar treino ${workout.id}:`, error);
                }
            }
        } catch (error) {
            console.error('[WorkoutExpirationsJob] Erro na execução:', error);
            throw error;
        }
    }
}

module.exports = WorkoutExpirationsJob;
