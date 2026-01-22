// Recurring Charges Job
// Gera cobranças recorrentes automaticamente

const cron = require('node-cron');

class RecurringChargesJob {
    constructor(pool, asaasService) {
        this.pool = pool;
        this.asaasService = asaasService;
        this.isRunning = false;
    }

    /**
     * Inicia o job
     */
    start() {
        // Executa no primeiro dia de cada mês às 6h
        cron.schedule('0 6 1 * *', async () => {
            if (this.isRunning) {
                console.log('RecurringChargesJob já está em execução, pulando...');
                return;
            }

            this.isRunning = true;
            console.log('[RecurringChargesJob] Iniciando execução...');

            try {
                await this.execute();
                console.log('[RecurringChargesJob] Execução concluída com sucesso');
            } catch (error) {
                console.error('[RecurringChargesJob] Erro na execução:', error);
            } finally {
                this.isRunning = false;
            }
        });

        console.log('[RecurringChargesJob] Agendado para executar no primeiro dia de cada mês às 6h');
    }

    /**
     * Executa a lógica do job
     */
    async execute() {
        try {
            // Buscar configurações de cobrança recorrente ativas
            const recurringResult = await this.pool.query(
                `SELECT rc.*, a.coach_id, a.nome as aluno_nome
                 FROM public.recurring_charges rc
                 JOIN public.alunos a ON rc.aluno_id = a.id
                 WHERE rc.active = true
                   AND rc.last_charge_date IS NULL 
                    OR DATE(rc.last_charge_date) < DATE_TRUNC('month', CURRENT_DATE)`,
                []
            );

            console.log(`[RecurringChargesJob] Encontradas ${recurringResult.rows.length} cobranças recorrentes`);

            for (const recurring of recurringResult.rows) {
                try {
                    // Calcular data de vencimento (dia do mês configurado)
                    const dueDate = new Date();
                    dueDate.setDate(recurring.due_day || 10); // Default: dia 10
                    if (dueDate < new Date()) {
                        dueDate.setMonth(dueDate.getMonth() + 1);
                    }

                    // Criar pagamento via Asaas
                    const payment = await this.asaasService.createPayment({
                        alunoId: recurring.aluno_id,
                        value: recurring.value,
                        billingType: recurring.billing_type || 'BOLETO',
                        dueDate: dueDate.toISOString().split('T')[0],
                        description: recurring.description || `Cobrança recorrente - ${recurring.aluno_nome}`
                    });

                    // Atualizar última data de cobrança
                    await this.pool.query(
                        `UPDATE public.recurring_charges 
                         SET last_charge_date = CURRENT_DATE 
                         WHERE id = $1`,
                        [recurring.id]
                    );

                    console.log(`[RecurringChargesJob] Cobrança criada para aluno ${recurring.aluno_id}`);
                } catch (error) {
                    console.error(`[RecurringChargesJob] Erro ao processar cobrança ${recurring.id}:`, error);
                }
            }
        } catch (error) {
            console.error('[RecurringChargesJob] Erro na execução:', error);
            throw error;
        }
    }
}

module.exports = RecurringChargesJob;
