// Payment Reminders Job
// Envia lembretes de pagamentos próximos ao vencimento

const cron = require('node-cron');

class PaymentRemindersJob {
    constructor(pool, notificationService) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.isRunning = false;
    }

    /**
     * Inicia o job
     */
    start() {
        // Executa diariamente às 9h
        cron.schedule('0 9 * * *', async () => {
            if (this.isRunning) {
                console.log('PaymentRemindersJob já está em execução, pulando...');
                return;
            }

            this.isRunning = true;
            console.log('[PaymentRemindersJob] Iniciando execução...');

            try {
                await this.execute();
                console.log('[PaymentRemindersJob] Execução concluída com sucesso');
            } catch (error) {
                console.error('[PaymentRemindersJob] Erro na execução:', error);
            } finally {
                this.isRunning = false;
            }
        });

        console.log('[PaymentRemindersJob] Agendado para executar diariamente às 9h');
    }

    /**
     * Executa a lógica do job
     * Idempotente: pode ser executado múltiplas vezes sem efeitos colaterais
     */
    async execute() {
        const logger = require('../utils/logger');
        const startTime = Date.now();
        
        try {
            // Buscar pagamentos que vencem em 3 dias
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            threeDaysFromNow.setHours(0, 0, 0, 0);

            const paymentsResult = await this.pool.query(
                `SELECT p.*, a.coach_id
                 FROM public.asaas_payments p
                 JOIN public.alunos a ON p.aluno_id = a.id
                 WHERE p.status = 'PENDING'
                   AND DATE(p.due_date) = DATE($1)
                   AND p.reminder_sent = false`,
                [threeDaysFromNow]
            );

            logger.logJob('PaymentRemindersJob', 'running', {
                paymentsFound: paymentsResult.rows.length,
                type: 'reminders'
            });

            for (const payment of paymentsResult.rows) {
                try {
                    await this.notificationService.notifyPaymentReminder(
                        payment.id,
                        payment.coach_id,
                        3
                    );

                    // Marcar como lembrete enviado
                    await this.pool.query(
                        'UPDATE public.asaas_payments SET reminder_sent = true WHERE id = $1',
                        [payment.id]
                    );

                    logger.logJob('PaymentRemindersJob', 'success', {
                        paymentId: payment.id,
                        action: 'reminder_sent'
                    });
                } catch (error) {
                    logger.logJob('PaymentRemindersJob', 'error', {
                        paymentId: payment.id,
                        error: error.message
                    });
                }
            }

            // Buscar pagamentos vencidos (não pagos)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const overdueResult = await this.pool.query(
                `SELECT p.*, a.coach_id
                 FROM public.asaas_payments p
                 JOIN public.alunos a ON p.aluno_id = a.id
                 WHERE p.status = 'PENDING'
                   AND DATE(p.due_date) < DATE($1)
                   AND p.overdue_notification_sent = false`,
                [today]
            );

            logger.logJob('PaymentRemindersJob', 'running', {
                overdueFound: overdueResult.rows.length,
                type: 'overdue'
            });

            for (const payment of overdueResult.rows) {
                try {
                    await this.notificationService.notifyPaymentStatus(
                        payment.id,
                        payment.coach_id,
                        'OVERDUE',
                        { overdue: true }
                    );

                    // Atualizar status no banco
                    await this.pool.query(
                        `UPDATE public.asaas_payments 
                         SET status = 'OVERDUE', overdue_notification_sent = true 
                         WHERE id = $1`,
                        [payment.id]
                    );

                    logger.logJob('PaymentRemindersJob', 'success', {
                        paymentId: payment.id,
                        action: 'overdue_notification_sent'
                    });
                } catch (error) {
                    logger.logJob('PaymentRemindersJob', 'error', {
                        paymentId: payment.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.logJob('PaymentRemindersJob', 'error', {
                error: error.message,
                duration: `${duration}ms`
            });
            throw error;
        } finally {
            const duration = Date.now() - startTime;
            logger.logJob('PaymentRemindersJob', 'completed', {
                duration: `${duration}ms`
            });
        }
    }
}

module.exports = PaymentRemindersJob;
