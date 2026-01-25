// Workout Expirations Job
// Verifica e notifica sobre treinos expirados

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
            // Buscar treinos que expiraram hoje
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expiredResult = await this.pool.query(
                `SELECT at.*, a.nome as aluno_nome, a.coach_id
                 FROM public.alunos_treinos at
                 JOIN public.alunos a ON at.aluno_id = a.id
                 WHERE at.data_fim IS NOT NULL
                   AND DATE(at.data_fim) = DATE($1)
                   AND at.expiration_notified = false`,
                [today]
            );

            console.log(`[WorkoutExpirationsJob] Encontrados ${expiredResult.rows.length} treinos expirados`);

            for (const workout of expiredResult.rows) {
                try {
                    // Notificar coach
                    await this.notificationService.notifyUser(
                        workout.coach_id,
                        'workout_expired',
                        'Treino Expirado',
                        `O treino de ${workout.aluno_nome} expirou hoje`,
                        { 
                            workoutId: workout.id,
                            alunoId: workout.aluno_id,
                            alunoNome: workout.aluno_nome,
                            dataFim: workout.data_fim
                        }
                    );

                    // Marcar como notificado
                    await this.pool.query(
                        'UPDATE public.alunos_treinos SET expiration_notified = true WHERE id = $1',
                        [workout.id]
                    );

                    console.log(`[WorkoutExpirationsJob] Notificação enviada para treino ${workout.id}`);
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
