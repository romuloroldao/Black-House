// Notification Service
// Serviço compartilhado para emitir notificações via WebSocket
// Usado por Background Jobs e Webhooks

class NotificationService {
    constructor(websocketService, pool) {
        this.ws = websocketService;
        this.pool = pool;
    }

    /**
     * Emite notificação de pagamento
     */
    async notifyPaymentStatus(paymentId, userId, status, data = {}) {
        try {
            // Buscar dados do pagamento
            const paymentResult = await this.pool.query(
                `SELECT p.*, a.nome as aluno_nome 
                 FROM public.asaas_payments p
                 JOIN public.alunos a ON p.aluno_id = a.id
                 WHERE p.id = $1`,
                [paymentId]
            );

            if (paymentResult.rows.length === 0) {
                console.warn(`Pagamento ${paymentId} não encontrado`);
                return;
            }

            const payment = paymentResult.rows[0];

            // Emitir para o usuário
            this.ws.emitToUser(userId, 'payment_status_update', {
                paymentId: payment.id,
                alunoId: payment.aluno_id,
                alunoNome: payment.aluno_nome,
                status,
                value: payment.value,
                dueDate: payment.due_date,
                ...data
            });

            // Salvar notificação no banco
            await this.saveNotification({
                userId,
                type: 'payment_status',
                title: `Pagamento ${this.getStatusLabel(status)}`,
                message: `Pagamento de ${payment.aluno_nome}: ${this.getStatusLabel(status)}`,
                data: { paymentId, status, ...data }
            });
        } catch (error) {
            console.error('Erro ao notificar status de pagamento:', error);
        }
    }

    /**
     * Emite notificação de lembrete de pagamento
     */
    async notifyPaymentReminder(paymentId, userId, daysUntilDue) {
        try {
            const paymentResult = await this.pool.query(
                `SELECT p.*, a.nome as aluno_nome 
                 FROM public.asaas_payments p
                 JOIN public.alunos a ON p.aluno_id = a.id
                 WHERE p.id = $1`,
                [paymentId]
            );

            if (paymentResult.rows.length === 0) return;

            const payment = paymentResult.rows[0];

            this.ws.emitToUser(userId, 'payment_reminder', {
                paymentId: payment.id,
                alunoId: payment.aluno_id,
                alunoNome: payment.aluno_nome,
                value: payment.value,
                dueDate: payment.due_date,
                daysUntilDue
            });

            await this.saveNotification({
                userId,
                type: 'payment_reminder',
                title: 'Lembrete de Pagamento',
                message: `Pagamento de ${payment.aluno_nome} vence em ${daysUntilDue} dia(s)`,
                data: { paymentId, daysUntilDue }
            });
        } catch (error) {
            console.error('Erro ao notificar lembrete de pagamento:', error);
        }
    }

    /**
     * Emite notificação de lembrete de check-in
     */
    async notifyCheckinReminder(alunoId, coachId) {
        try {
            const alunoResult = await this.pool.query(
                'SELECT id, nome FROM public.alunos WHERE id = $1',
                [alunoId]
            );

            if (alunoResult.rows.length === 0) return;

            const aluno = alunoResult.rows[0];

            // Notificar coach
            this.ws.emitToCoach(coachId, 'checkin_reminder', {
                alunoId: aluno.id,
                alunoNome: aluno.nome
            });

            await this.saveNotification({
                userId: coachId,
                type: 'checkin_reminder',
                title: 'Lembrete de Check-in',
                message: `${aluno.nome} precisa fazer check-in semanal`,
                data: { alunoId: aluno.id }
            });
        } catch (error) {
            console.error('Erro ao notificar lembrete de check-in:', error);
        }
    }

    /**
     * Emite notificação de evento próximo
     */
    async notifyEventReminder(eventId, userId) {
        try {
            const eventResult = await this.pool.query(
                'SELECT id, titulo, data_evento FROM public.eventos WHERE id = $1',
                [eventId]
            );

            if (eventResult.rows.length === 0) return;

            const event = eventResult.rows[0];

            this.ws.emitToUser(userId, 'event_reminder', {
                eventId: event.id,
                titulo: event.titulo,
                dataEvento: event.data_evento
            });

            await this.saveNotification({
                userId,
                type: 'event_reminder',
                title: 'Lembrete de Evento',
                message: `Evento "${event.titulo}" está próximo`,
                data: { eventId: event.id }
            });
        } catch (error) {
            console.error('Erro ao notificar lembrete de evento:', error);
        }
    }

    /**
     * Emite notificação genérica
     */
    async notifyUser(userId, type, title, message, data = {}) {
        try {
            this.ws.emitToUser(userId, 'notification', {
                type,
                title,
                message,
                data,
                timestamp: new Date().toISOString()
            });

            await this.saveNotification({
                userId,
                type,
                title,
                message,
                data
            });
        } catch (error) {
            console.error('Erro ao notificar usuário:', error);
        }
    }

    /**
     * Salva notificação no banco de dados
     */
    async saveNotification({ userId, type, title, message, data }) {
        try {
            await this.pool.query(
                `INSERT INTO public.notificacoes 
                 (user_id, type, title, message, data, read, created_at)
                 VALUES ($1, $2, $3, $4, $5, false, NOW())`,
                [userId, type, title, message, JSON.stringify(data)]
            );
        } catch (error) {
            console.error('Erro ao salvar notificação:', error);
        }
    }

    /**
     * Retorna label do status de pagamento
     */
    getStatusLabel(status) {
        const labels = {
            'PENDING': 'Pendente',
            'CONFIRMED': 'Confirmado',
            'RECEIVED': 'Recebido',
            'OVERDUE': 'Vencido',
            'CANCELLED': 'Cancelado'
        };
        return labels[status] || status;
    }
}

module.exports = NotificationService;
