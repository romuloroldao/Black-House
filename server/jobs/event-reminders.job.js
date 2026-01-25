// Event Reminders Job
// Envia lembretes de eventos próximos

const cron = require('node-cron');

class EventRemindersJob {
    constructor(pool, notificationService) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.isRunning = false;
    }

    /**
     * Inicia o job
     */
    start() {
        // Executa diariamente às 8h
        cron.schedule('0 8 * * *', async () => {
            if (this.isRunning) {
                console.log('EventRemindersJob já está em execução, pulando...');
                return;
            }

            this.isRunning = true;
            console.log('[EventRemindersJob] Iniciando execução...');

            try {
                await this.execute();
                console.log('[EventRemindersJob] Execução concluída com sucesso');
            } catch (error) {
                console.error('[EventRemindersJob] Erro na execução:', error);
            } finally {
                this.isRunning = false;
            }
        });

        console.log('[EventRemindersJob] Agendado para executar diariamente às 8h');
    }

    /**
     * Executa a lógica do job
     */
    async execute() {
        try {
            // Buscar eventos que acontecem em 24 horas
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const dayAfter = new Date(tomorrow);
            dayAfter.setDate(dayAfter.getDate() + 1);

            const eventsResult = await this.pool.query(
                `SELECT e.id, e.titulo, e.data_evento, e.coach_id, e.aluno_id
                 FROM public.eventos e
                 WHERE e.data_evento >= $1 
                   AND e.data_evento < $2
                   AND e.reminder_sent = false`,
                [tomorrow, dayAfter]
            );

            console.log(`[EventRemindersJob] Encontrados ${eventsResult.rows.length} eventos para lembrar`);

            for (const event of eventsResult.rows) {
                try {
                    // Notificar coach
                    if (event.coach_id) {
                        await this.notificationService.notifyEventReminder(
                            event.id,
                            event.coach_id
                        );
                    }

                    // Notificar aluno se houver
                    if (event.aluno_id) {
                        // Buscar coach_id do aluno
                        const alunoResult = await this.pool.query(
                            'SELECT coach_id FROM public.alunos WHERE id = $1',
                            [event.aluno_id]
                        );

                        if (alunoResult.rows.length > 0 && alunoResult.rows[0].coach_id) {
                            await this.notificationService.notifyEventReminder(
                                event.id,
                                alunoResult.rows[0].coach_id
                            );
                        }
                    }

                    // Marcar como lembrete enviado
                    await this.pool.query(
                        'UPDATE public.eventos SET reminder_sent = true WHERE id = $1',
                        [event.id]
                    );

                    console.log(`[EventRemindersJob] Lembrete enviado para evento ${event.id}`);
                } catch (error) {
                    console.error(`[EventRemindersJob] Erro ao processar evento ${event.id}:`, error);
                }
            }
        } catch (error) {
            console.error('[EventRemindersJob] Erro na execução:', error);
            throw error;
        }
    }
}

module.exports = EventRemindersJob;
