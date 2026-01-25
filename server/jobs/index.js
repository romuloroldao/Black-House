// Jobs Runner
// Inicializa e gerencia todos os background jobs

const PaymentRemindersJob = require('./payment-reminders.job');
const CheckinRemindersJob = require('./checkin-reminders.job');
const EventRemindersJob = require('./event-reminders.job');
const RecurringChargesJob = require('./recurring-charges.job');
const WorkoutExpirationsJob = require('./workout-expirations.job');

class JobsRunner {
    constructor(pool, notificationService, asaasService) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.asaasService = asaasService;
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

        // Recurring Charges (requer asaasService)
        if (this.asaasService) {
            const recurringCharges = new RecurringChargesJob(this.pool, this.asaasService);
            recurringCharges.start();
            this.jobs.push(recurringCharges);
        } else {
            console.warn('[JobsRunner] AsaasService não disponível, pulando RecurringChargesJob');
        }

        // Workout Expirations
        const workoutExpirations = new WorkoutExpirationsJob(this.pool, this.notificationService);
        workoutExpirations.start();
        this.jobs.push(workoutExpirations);

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
