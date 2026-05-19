// Event Reminders Job
// Envia lembretes de eventos próximos (coach + participantes alunos)

const cron = require('node-cron');

class EventRemindersJob {
    constructor(pool, notificationService) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.isRunning = false;
    }

    start() {
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

    async execute() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const dayAfter = new Date(tomorrow);
            dayAfter.setDate(dayAfter.getDate() + 1);

            const eventsResult = await this.pool.query(
                `SELECT e.id, e.titulo, e.data_inicio, e.coach_id
                 FROM public.eventos e
                 WHERE e.data_inicio >= $1
                   AND e.data_inicio < $2
                   AND COALESCE(e.reminder_sent, false) = false`,
                [tomorrow, dayAfter],
            );

            console.log(`[EventRemindersJob] Encontrados ${eventsResult.rows.length} eventos para lembrar`);

            for (const event of eventsResult.rows) {
                try {
                    await this.notificationService.notifyEventReminderForEvent(
                        event.id,
                        event.coach_id,
                    );

                    await this.pool.query(
                        'UPDATE public.eventos SET reminder_sent = true WHERE id = $1',
                        [event.id],
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
