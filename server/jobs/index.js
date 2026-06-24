// Jobs Runner
// Inicializa e gerencia todos os background jobs

const PaymentRemindersJob = require('./payment-reminders.job');
const CheckinRemindersJob = require('./checkin-reminders.job');
const EventRemindersJob = require('./event-reminders.job');
const ReturnRemindersJob = require('./return-reminders.job');
const AgendaCoachRemindersJob = require('./agenda-coach-reminders.job');
const FinancialSyncWorkerJob = require('./financial-sync-worker.job');
const FinancialReconciliationJob = require('./financial-reconciliation.job');
const FinancialWebhookHealthJob = require('./financial-webhook-health.job');
const ProfileCompletenessRemindersJob = require('./profile-completeness-reminders.job');
const SmartRemindersJob = require('./smart-reminders.job');

class JobsRunner {
    constructor(pool, notificationService, financialSync = null) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.financialSync = financialSync;
        this.jobs = [];
    }

    /**
     * Inicia todos os jobs
     */
    start() {
        console.log('[JobsRunner] Iniciando background jobs...');

        // Payment Reminders
        const paymentReminders = new PaymentRemindersJob(this.pool, this.notificationService);
        paymentReminders.start();
        this.jobs.push(paymentReminders);

        // Check-in Reminders
        const checkinReminders = new CheckinRemindersJob(this.pool, this.notificationService);
        checkinReminders.start();
        this.jobs.push(checkinReminders);

        // Event Reminders
        const eventReminders = new EventRemindersJob(this.pool, this.notificationService);
        eventReminders.start();
        this.jobs.push(eventReminders);

        // Recorrência legada desactivada — usar assinaturas Asaas (financial sync)
        console.warn('[JobsRunner] RecurringChargesJob desactivado — recorrência via Asaas Subscriptions');

        if (this.financialSync?.inboundProcessor) {
            const financialSyncWorker = new FinancialSyncWorkerJob(this.financialSync.inboundProcessor);
            financialSyncWorker.start();
            this.jobs.push(financialSyncWorker);

            const financialReconciliation = new FinancialReconciliationJob(this.pool, this.notificationService);
            financialReconciliation.start();
            this.jobs.push(financialReconciliation);

            const webhookHealth = new FinancialWebhookHealthJob(this.pool);
            webhookHealth.start();
            this.jobs.push(webhookHealth);
        }

        // Retorno dieta + treino (substitui lembrete único de vencimento)
        const returnReminders = new ReturnRemindersJob(this.pool, this.notificationService);
        returnReminders.start();
        this.jobs.push(returnReminders);

        const agendaCoachReminders = new AgendaCoachRemindersJob(this.pool, this.notificationService);
        agendaCoachReminders.start();
        this.jobs.push(agendaCoachReminders);

        const profileReminders = new ProfileCompletenessRemindersJob(this.pool, this.notificationService);
        profileReminders.start();
        this.jobs.push(profileReminders);

        const smartReminders = new SmartRemindersJob(this.pool, this.notificationService);
        smartReminders.start();
        this.jobs.push(smartReminders);

        console.log(`[JobsRunner] ${this.jobs.length} jobs iniciados com sucesso`);
    }

    /**
     * Para todos os jobs
     */
    stop() {
        console.log('[JobsRunner] Parando todos os jobs...');
        // node-cron não tem método stop direto, mas podemos marcar como parado
        this.jobs = [];
    }
}

module.exports = JobsRunner;
