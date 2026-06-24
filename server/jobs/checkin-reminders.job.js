// Check-in Reminders Job
// Delega ao motor de lembretes inteligentes (domínio checkin_weekly)

const cron = require('node-cron');
const smartReminderEngine = require('../services/smart-reminder/engine');

class CheckinRemindersJob {
    constructor(pool, notificationService) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.isRunning = false;
    }

    start() {
        cron.schedule('0 10 * * 1', async () => {
            if (this.isRunning) {
                console.log('CheckinRemindersJob já está em execução, pulando...');
                return;
            }

            this.isRunning = true;
            console.log('[CheckinRemindersJob] Iniciando execução (smart engine)...');

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

    async execute() {
        return smartReminderEngine.processAll(this.pool, this.notificationService);
    }
}

module.exports = CheckinRemindersJob;
