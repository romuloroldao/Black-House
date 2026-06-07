// Notification Service
// Serviço compartilhado para emitir notificações via WebSocket e public.notificacoes

const logger = require('../utils/logger');
const { getAlunoRecordForAuthUser } = require('../utils/aluno-auth-user');
const { getAuthUserIdForAluno } = require('../utils/aluno-auth-user');
const { getCopy } = require('./return-reminder-copy');
const { buildCoachAgendaCopy } = require('./agenda-coach-reminder-copy');
const {
  shouldSendEmail,
  CHANNEL_IN_APP_ONLY,
} = require('./return-reminder.service');
const {
  shouldSendCoachEmail,
  CHANNEL_IN_APP_ONLY: COACH_CHANNEL_IN_APP_ONLY,
} = require('./agenda-coach-reminder.service');
const { startOfCalendarWeek } = require('../utils/checkin-week');

class NotificationService {
    constructor(websocketService, pool) {
        this.ws = websocketService;
        this.pool = pool;
    }

    /**
     * E-mail transacional para aluno (não bloqueia o fluxo principal).
     */
    async sendStudentEmail(authUserId, templateType, context = {}) {
        if (!authUserId || !templateType) return;

        try {
            const roleResult = await this.pool.query(
                `SELECT role FROM public.user_roles WHERE user_id = $1 LIMIT 1`,
                [authUserId],
            );
            if (roleResult.rows[0]?.role !== 'aluno') return;

            const userResult = await this.pool.query(
                `SELECT email FROM app_auth.users WHERE id = $1 LIMIT 1`,
                [authUserId],
            );
            const email = userResult.rows[0]?.email;
            if (!email || !String(email).includes('@')) return;

            let alunoNome = context.alunoNome ? String(context.alunoNome) : '';
            if (!alunoNome) {
                const alunoRow = await getAlunoRecordForAuthUser(this.pool, authUserId);
                if (alunoRow?.id) {
                    const nomeR = await this.pool.query(
                        'SELECT nome FROM public.alunos WHERE id = $1 LIMIT 1',
                        [alunoRow.id],
                    );
                    alunoNome = nomeR.rows[0]?.nome || '';
                }
            }

            const { sendStudentNotificationEmail } = require('../utils/send-student-notification-email');
            await sendStudentNotificationEmail({
                to: email,
                type: templateType,
                context: { ...context, alunoNome },
            });
        } catch (error) {
            logger.warn('student_notification.email_failed', {
                authUserId,
                templateType,
                error: error.message,
            });
        }
    }

    /**
     * Emite notificação de pagamento (coach + aluno quando vinculado)
     */
    async notifyPaymentStatus(paymentId, coachUserId, status, data = {}) {
        try {
            const paymentResult = await this.pool.query(
                `SELECT p.*, a.nome AS aluno_nome, a.id AS aluno_id
                 FROM public.asaas_payments p
                 JOIN public.alunos a ON p.aluno_id = a.id
                 WHERE p.id = $1`,
                [paymentId],
            );

            if (paymentResult.rows.length === 0) {
                console.warn(`Pagamento ${paymentId} não encontrado`);
                return;
            }

            const payment = paymentResult.rows[0];
            const statusLabel = this.getStatusLabel(status);

            if (coachUserId) {
                this.ws.emitToUser(coachUserId, 'payment_status_update', {
                    paymentId: payment.id,
                    alunoId: payment.aluno_id,
                    alunoNome: payment.aluno_nome,
                    status,
                    value: payment.value,
                    dueDate: payment.due_date,
                    ...data,
                });

                await this.saveNotification({
                    userId: coachUserId,
                    type: 'payment_status',
                    title: `Pagamento ${statusLabel}`,
                    message: `Pagamento de ${payment.aluno_nome}: ${statusLabel}`,
                    data: { paymentId, status, alunoId: payment.aluno_id, ...data },
                });
            }

            const studentUserId = await getAuthUserIdForAluno(this.pool, payment.aluno_id);
            if (!studentUserId) return;

            const studentMessages = {
                RECEIVED: {
                    title: 'Pagamento confirmado',
                    message: 'Recebemos a confirmação do seu pagamento. Obrigado!',
                },
                CONFIRMED: {
                    title: 'Pagamento confirmado',
                    message: 'Seu pagamento foi confirmado.',
                },
                OVERDUE: {
                    title: 'Pagamento em atraso',
                    message:
                        'Sua mensalidade está vencida. Regularize em Financeiro para restaurar o acesso.',
                },
                PENDING: {
                    title: 'Cobrança pendente',
                    message: 'Você tem uma cobrança pendente. Confira em Financeiro.',
                },
                CANCELLED: {
                    title: 'Cobrança cancelada',
                    message: 'Uma cobrança foi cancelada. Veja os detalhes em Financeiro.',
                },
            };

            const copy = studentMessages[status] || {
                title: `Pagamento ${statusLabel}`,
                message: `Status da sua cobrança: ${statusLabel}.`,
            };

            this.ws.emitToUser(studentUserId, 'payment_status_update', {
                paymentId: payment.id,
                alunoId: payment.aluno_id,
                status,
                value: payment.value,
                dueDate: payment.due_date,
                ...data,
            });

            await this.saveNotification({
                userId: studentUserId,
                type: 'payment_status',
                title: copy.title,
                message: copy.message,
                data: {
                    paymentId,
                    status,
                    link: 'financial',
                    ...data,
                },
            });

            const emailStatuses = new Set(['OVERDUE', 'RECEIVED', 'CONFIRMED']);
            if (emailStatuses.has(String(status).toUpperCase())) {
                await this.sendStudentEmail(studentUserId, 'payment_status', {
                    status,
                    dueDate: payment.due_date,
                    value: payment.value,
                    alunoNome: payment.aluno_nome,
                });
            }
        } catch (error) {
            console.error('Erro ao notificar status de pagamento:', error);
        }
    }

    /**
     * Lembrete de pagamento — coach e aluno
     */
    async notifyPaymentReminder(paymentId, coachUserId, daysUntilDue) {
        try {
            const paymentResult = await this.pool.query(
                `SELECT p.*, a.nome AS aluno_nome, a.id AS aluno_id
                 FROM public.asaas_payments p
                 JOIN public.alunos a ON p.aluno_id = a.id
                 WHERE p.id = $1`,
                [paymentId],
            );

            if (paymentResult.rows.length === 0) return;

            const payment = paymentResult.rows[0];

            if (coachUserId) {
                this.ws.emitToUser(coachUserId, 'payment_reminder', {
                    paymentId: payment.id,
                    alunoId: payment.aluno_id,
                    alunoNome: payment.aluno_nome,
                    value: payment.value,
                    dueDate: payment.due_date,
                    daysUntilDue,
                });

                await this.saveNotification({
                    userId: coachUserId,
                    type: 'payment_reminder',
                    title: 'Lembrete de Pagamento',
                    message: `Pagamento de ${payment.aluno_nome} vence em ${daysUntilDue} dia(s)`,
                    data: { paymentId, daysUntilDue, alunoId: payment.aluno_id },
                });
            }

            const studentUserId = await getAuthUserIdForAluno(this.pool, payment.aluno_id);
            if (!studentUserId) return;

            const dueStr = payment.due_date
                ? new Date(payment.due_date).toLocaleDateString('pt-BR')
                : 'em breve';

            this.ws.emitToUser(studentUserId, 'payment_reminder', {
                paymentId: payment.id,
                daysUntilDue,
                dueDate: payment.due_date,
                value: payment.value,
            });

            await this.saveNotification({
                userId: studentUserId,
                type: 'payment_reminder',
                title: 'Lembrete de pagamento',
                message: `Sua mensalidade vence em ${daysUntilDue} dia(s) (${dueStr}). Acesse Financeiro para pagar.`,
                data: { paymentId, daysUntilDue, link: 'financial' },
            });

            await this.sendStudentEmail(studentUserId, 'payment_reminder', {
                daysUntilDue,
                dueDate: payment.due_date,
                value: payment.value,
                alunoNome: payment.aluno_nome,
            });
        } catch (error) {
            console.error('Erro ao notificar lembrete de pagamento:', error);
        }
    }

    _buildWeeklyCheckinNotifySummary(checkin = {}) {
        const parts = [];
        const adesao = checkin.seguiu_plano_nota;
        if (adesao != null && !Number.isNaN(Number(adesao))) {
            parts.push(`Adesão ${adesao}/5`);
        }
        if (checkin.estresse_semana === true || checkin.estresse_semana === 'sim') {
            parts.push('Estresse');
        }
        const relato = checkin.nao_cumpriu_porque?.trim?.() || '';
        if (relato) {
            parts.push(relato.length > 100 ? `${relato.slice(0, 100)}…` : relato);
        }
        return parts.join(' · ') || 'Confira as respostas completas na plataforma.';
    }

    async _hasWeeklyCheckinThisWeek(alunoId) {
        const weekStart = startOfCalendarWeek();
        const result = await this.pool.query(
            `SELECT id FROM public.weekly_checkins
             WHERE aluno_id = $1 AND created_at >= $2::timestamptz
             LIMIT 1`,
            [alunoId, weekStart.toISOString()],
        );
        return result.rows.length > 0;
    }

    /**
     * Marca como lidos os lembretes de check-in pendentes após envio bem-sucedido.
     */
    async dismissCheckinRemindersForAluno(alunoId) {
        if (!alunoId) return;

        try {
            const weekStart = startOfCalendarWeek();
            await this.pool.query(
                `UPDATE public.notificacoes
                 SET lida = true, updated_at = NOW()
                 WHERE aluno_id = $1
                   AND tipo = 'checkin_reminder'
                   AND lida = false
                   AND created_at >= $2::timestamptz`,
                [alunoId, weekStart.toISOString()],
            );
        } catch (error) {
            logger.warn('checkin.dismiss_reminders_failed', {
                alunoId,
                error: error.message,
            });
        }
    }

    /**
     * BH-CHECKIN-010: aluno enviou check-in semanal — coach (in-app + e-mail opcional)
     */
    async notifyNewWeeklyCheckin({ checkinId, alunoId, alunoNome, coachUserId, checkin }) {
        if (!coachUserId || !alunoId) return;

        await this.dismissCheckinRemindersForAluno(alunoId);

        const nome = (alunoNome && String(alunoNome).trim()) || 'Aluno';
        const summary = this._buildWeeklyCheckinNotifySummary(checkin || {});
        const title = 'Novo check-in semanal';
        const message = `${nome} enviou o check-in da semana. ${summary}`;

        try {
            await this.notifyUser(coachUserId, 'new_weekly_checkin', title, message, {
                checkinId,
                alunoId,
                alunoNome: nome,
                link: 'check-ins',
            });

            const wantsEmail = await shouldSendCoachEmail(this.pool, coachUserId);
            if (!wantsEmail) return;

            const userR = await this.pool.query(
                `SELECT email FROM app_auth.users WHERE id = $1 LIMIT 1`,
                [coachUserId],
            );
            const to = userR.rows[0]?.email;
            if (!to) return;

            const profileR = await this.pool.query(
                `SELECT nome_completo FROM public.coach_profiles WHERE user_id = $1 LIMIT 1`,
                [coachUserId],
            );
            const coachNome = profileR.rows[0]?.nome_completo || '';

            const { sendCoachNotificationEmail } = require('../utils/send-coach-notification-email');
            await sendCoachNotificationEmail({
                to,
                type: 'new_weekly_checkin',
                context: {
                    coachNome,
                    alunoNome: nome,
                    message,
                    summary,
                },
            });
        } catch (error) {
            logger.warn('checkin.new_weekly_notify_failed', {
                checkinId,
                alunoId,
                coachUserId,
                error: error.message,
            });
        }
    }

    /**
     * Lembrete de check-in semanal — coach e aluno
     */
    async notifyCheckinReminder(alunoId, coachId) {
        try {
            const alunoResult = await this.pool.query(
                'SELECT id, nome FROM public.alunos WHERE id = $1',
                [alunoId],
            );

            if (alunoResult.rows.length === 0) return;

            if (await this._hasWeeklyCheckinThisWeek(alunoId)) {
                await this.dismissCheckinRemindersForAluno(alunoId);
                return;
            }

            const weekStart = startOfCalendarWeek();
            const duplicate = await this.pool.query(
                `SELECT id FROM public.notificacoes
                 WHERE aluno_id = $1
                   AND tipo = 'checkin_reminder'
                   AND created_at >= $2::timestamptz
                 LIMIT 1`,
                [alunoId, weekStart.toISOString()],
            );
            if (duplicate.rows.length > 0) return;

            const aluno = alunoResult.rows[0];

            if (coachId) {
                this.ws.emitToCoach(coachId, 'checkin_reminder', {
                    alunoId: aluno.id,
                    alunoNome: aluno.nome,
                });

                await this.saveNotification({
                    userId: coachId,
                    type: 'checkin_reminder',
                    title: 'Lembrete de Check-in',
                    message: `${aluno.nome} precisa fazer check-in semanal`,
                    data: { alunoId: aluno.id },
                });
            }

            const studentUserId = await getAuthUserIdForAluno(this.pool, aluno.id);
            if (!studentUserId) return;

            this.ws.emitToUser(studentUserId, 'checkin_reminder', {
                alunoId: aluno.id,
            });

            await this.saveNotification({
                userId: studentUserId,
                type: 'checkin_reminder',
                title: 'Check-in semanal',
                message:
                    'Você ainda não preencheu o check-in desta semana. Reserve alguns minutos para atualizar seu progresso.',
                data: { alunoId: aluno.id, link: 'checkin' },
            });

            await this.sendStudentEmail(studentUserId, 'checkin_reminder', {
                alunoNome: aluno.nome,
            });
        } catch (error) {
            console.error('Erro ao notificar lembrete de check-in:', error);
        }
    }

    /**
     * Lembrete de evento próximo (um destinatário auth user)
     */
    async notifyEventReminder(eventId, userId, options = {}) {
        try {
            const eventResult = await this.pool.query(
                `SELECT id, titulo, data_inicio
                 FROM public.eventos
                 WHERE id = $1`,
                [eventId],
            );

            if (eventResult.rows.length === 0) return;

            const event = eventResult.rows[0];
            const dataLabel = event.data_inicio
                ? new Date(event.data_inicio).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                  })
                : 'em breve';

            const isStudent = options.audience === 'student';
            const title = isStudent ? 'Evento amanhã' : 'Lembrete de Evento';
            const message = isStudent
                ? `O evento "${event.titulo}" acontece amanhã (${dataLabel}).`
                : `Evento "${event.titulo}" está próximo (${dataLabel}).`;

            this.ws.emitToUser(userId, 'event_reminder', {
                eventId: event.id,
                titulo: event.titulo,
                dataEvento: event.data_inicio,
            });

            await this.saveNotification({
                userId,
                type: 'event_reminder',
                title,
                message,
                data: {
                    eventId: event.id,
                    link: isStudent ? 'calendar' : undefined,
                },
            });

            if (isStudent) {
                await this.sendStudentEmail(userId, 'event_reminder', {
                    eventTitle: event.titulo,
                    eventDate: event.data_inicio,
                });
            }
        } catch (error) {
            console.error('Erro ao notificar lembrete de evento:', error);
        }
    }

    /**
     * Notifica coach e todos os participantes de um evento (24h antes)
     */
    async notifyEventReminderForEvent(eventId, coachId) {
        if (coachId) {
            await this.notifyEventReminder(eventId, coachId, { audience: 'coach' });
        }

        const participants = await this.pool.query(
            `SELECT DISTINCT aluno_id
             FROM public.eventos_participantes
             WHERE evento_id = $1 AND aluno_id IS NOT NULL`,
            [eventId],
        );

        for (const row of participants.rows) {
            const studentUserId = await getAuthUserIdForAluno(this.pool, row.aluno_id);
            if (studentUserId) {
                await this.notifyEventReminder(eventId, studentUserId, { audience: 'student' });
            }
        }
    }

    /**
     * Lembrete de retorno de dieta ou treino (marco D-2, D-1, D0).
     * Respeita preferência do aluno: in_app_only | in_app_and_email.
     */
    async notifyReturnReminder({
        domain,
        milestone,
        entityId,
        alunoId,
        coachId,
        alunoNome,
        coachNome,
        planoNome,
        returnDate,
        notificationChannel,
    }) {
        const copy = getCopy(domain, milestone);
        if (!copy) {
            return { emailStatus: 'skipped', emailProvider: null, emailError: null };
        }

        const type = domain === 'diet' ? 'diet_return_reminder' : 'workout_return_reminder';
        const link = domain === 'diet' ? 'diet' : 'workouts';

        const studentUserId = await getAuthUserIdForAluno(this.pool, alunoId);
        if (!studentUserId) {
            return { emailStatus: 'skipped_no_user', emailProvider: null, emailError: null };
        }

        await this.notifyUser(studentUserId, type, copy.title, copy.message, {
            entityId,
            alunoId,
            milestone,
            returnDate,
            planoNome,
            link,
        });

        const channel = notificationChannel || (await this._resolveChannel(alunoId));
        if (channel === CHANNEL_IN_APP_ONLY) {
            return { emailStatus: 'skipped_preference', emailProvider: null, emailError: null };
        }

        const wantsEmail = await shouldSendEmail(this.pool, alunoId);
        if (!wantsEmail) {
            return { emailStatus: 'skipped_preference', emailProvider: null, emailError: null };
        }

        try {
            const result = await this.sendStudentEmail(studentUserId, copy.emailType, {
                alunoNome,
                coachNome,
                planoNome,
                dataRetorno: returnDate,
            });
            const provider = result?.provider || 'none';
            if (provider === 'none' || result?.skipped) {
                return { emailStatus: 'skipped', emailProvider: provider, emailError: null };
            }
            return { emailStatus: 'sent', emailProvider: provider, emailError: null };
        } catch (error) {
            return {
                emailStatus: 'failed',
                emailProvider: null,
                emailError: error.message,
            };
        }
    }

    async _resolveChannel(alunoId) {
        const r = await this.pool.query(
            `SELECT notification_channel::text AS ch FROM public.alunos WHERE id = $1`,
            [alunoId],
        );
        return r.rows[0]?.ch || 'in_app_and_email';
    }

    /**
     * Lembrete de Agenda para o coach (D-2, D-1, D0, atrasado).
     */
    async notifyAgendaCoachReminder({
        agendaEventoId,
        coachUserId,
        alunoId,
        alunoNome,
        tipo,
        milestone,
        eventDate,
        titulo,
        prioridade,
        notificationChannel,
        forceInAppOnly = false,
    }) {
        const copy = buildCoachAgendaCopy(tipo, milestone, alunoNome, titulo);
        if (!copy) {
            return { emailStatus: 'skipped', emailProvider: null, emailError: null };
        }

        const notifType =
            milestone === 'OVERDUE_DAILY' ? 'agenda_coach_overdue' : 'agenda_coach_reminder';

        await this.notifyUser(coachUserId, notifType, copy.title, copy.message, {
            agendaEventoId,
            alunoId,
            milestone,
            eventDate,
            tipo,
            titulo,
            prioridade,
            link: 'calendar',
        });

        if (forceInAppOnly) {
            return { emailStatus: 'skipped_preference', emailProvider: null, emailError: null };
        }

        if (notificationChannel === COACH_CHANNEL_IN_APP_ONLY) {
            return { emailStatus: 'skipped_preference', emailProvider: null, emailError: null };
        }

        const wantsEmail = await shouldSendCoachEmail(this.pool, coachUserId);
        if (!wantsEmail) {
            return { emailStatus: 'skipped_preference', emailProvider: null, emailError: null };
        }

        try {
            const userR = await this.pool.query(
                `SELECT email FROM app_auth.users WHERE id = $1 LIMIT 1`,
                [coachUserId],
            );
            const to = userR.rows[0]?.email;
            if (!to) {
                return { emailStatus: 'skipped', emailProvider: null, emailError: null };
            }

            const profileR = await this.pool.query(
                `SELECT nome_completo FROM public.coach_profiles WHERE user_id = $1 LIMIT 1`,
                [coachUserId],
            );
            const coachNome = profileR.rows[0]?.nome_completo || '';

            const { sendCoachNotificationEmail } = require('../utils/send-coach-notification-email');
            const result = await sendCoachNotificationEmail({
                to,
                type: copy.emailType,
                context: {
                    coachNome,
                    alunoNome,
                    eventTitle: titulo,
                    eventDate,
                    message: copy.message,
                },
            });
            const provider = result?.provider || 'none';
            if (provider === 'none' || result?.skipped) {
                return { emailStatus: 'skipped', emailProvider: provider, emailError: null };
            }
            return { emailStatus: 'sent', emailProvider: provider, emailError: null };
        } catch (error) {
            return {
                emailStatus: 'failed',
                emailProvider: null,
                emailError: error.message,
            };
        }
    }

    /**
     * Vencimento de treino — coach e aluno
     * @deprecated Use notifyReturnReminder + ReturnRemindersJob
     */
    async notifyWorkoutExpirationReminder(workout, daysUntilExpiration) {
        const daysLabel =
            daysUntilExpiration <= 0
                ? 'vence hoje'
                : `vence em ${daysUntilExpiration} dia(s)`;
        const treinoNome = workout.treino_nome || 'treino';

        if (workout.coach_id) {
            await this.notifyUser(
                workout.coach_id,
                'workout_expiration_reminder',
                'Lembrete de vencimento de treino',
                `O ${treinoNome} de ${workout.aluno_nome} ${daysLabel}.`,
                {
                    workoutId: workout.id,
                    alunoId: workout.aluno_id,
                    alunoNome: workout.aluno_nome,
                    treinoNome,
                    dataExpiracao: workout.data_expiracao,
                    daysUntilExpiration,
                },
            );
        }

        const studentUserId = await getAuthUserIdForAluno(this.pool, workout.aluno_id);
        if (!studentUserId) return;

        await this.notifyUser(
            studentUserId,
            'workout_expiration_reminder',
            'Seu treino está perto do vencimento',
            `Seu treino "${treinoNome}" ${daysLabel}. Confira em Treinos.`,
            {
                workoutId: workout.id,
                alunoId: workout.aluno_id,
                treinoNome,
                daysUntilExpiration,
                link: 'workouts',
            },
        );

        await this.sendStudentEmail(studentUserId, 'workout_expiration_reminder', {
            treinoNome,
            daysUntilExpiration,
            alunoNome: workout.aluno_nome,
        });
    }

    /**
     * Emite notificação genérica (+ evento Socket.io `notification`)
     */
    async notifyUser(userId, type, title, message, data = {}) {
        try {
            const payload = {
                type,
                title,
                message,
                data,
                timestamp: new Date().toISOString(),
            };

            if (this.ws) {
                this.ws.emitToUser(userId, 'notification', payload);
                if (type === 'checkin_respondido') {
                    this.ws.emitToUser(userId, 'checkin:respondido', payload);
                }
                if (type === 'dieta_atualizada') {
                    this.ws.emitToUser(userId, 'dieta:atualizada', payload);
                }
                if (type === 'new_weekly_checkin') {
                    this.ws.emitToUser(userId, 'new_weekly_checkin', payload);
                }
            }

            await this.saveNotification({
                userId,
                type,
                title,
                message,
                data,
            });
        } catch (error) {
            console.error('Erro ao notificar usuário:', error);
        }
    }

    /** Aluno: coach respondeu check-in semanal */
    async notifyCheckinRespondido({ alunoId, checkinId, coachNome }) {
        const studentUserId = await getAuthUserIdForAluno(this.pool, alunoId);
        if (!studentUserId) return;

        const coachLabel = coachNome ? String(coachNome).trim() : 'Seu coach';
        await this.notifyUser(
            studentUserId,
            'checkin_respondido',
            'Resposta do check-in',
            `${coachLabel} respondeu seu check-in semanal.`,
            {
                checkinId,
                alunoId,
                link: 'checkin',
            },
        );
    }

    /** Aluno: coach actualizou a dieta */
    async notifyDietaAtualizada({ alunoId, dietaId, dietaNome }) {
        const studentUserId = await getAuthUserIdForAluno(this.pool, alunoId);
        if (!studentUserId) return;

        const nome = dietaNome ? `"${String(dietaNome).trim()}"` : 'sua dieta';
        await this.notifyUser(
            studentUserId,
            'dieta_atualizada',
            'Dieta atualizada',
            `Seu coach actualizou ${nome}. Confira em Minha dieta.`,
            {
                dietaId,
                alunoId,
                link: 'diet',
            },
        );
    }

    /**
     * Salva notificação no banco de dados
     */
    async saveNotification({ userId, type, title, message, data }) {
        try {
            const roleResult = await this.pool.query(
                `SELECT role FROM public.user_roles WHERE user_id = $1 LIMIT 1`,
                [userId],
            );
            const role = roleResult.rows[0]?.role || 'coach';

            let coachId = null;
            let alunoId = null;
            let link = null;

            if (data && typeof data.link === 'string') {
                link = data.link.trim() || null;
            }

            if (role === 'aluno') {
                const alunoRow = await getAlunoRecordForAuthUser(this.pool, userId);
                if (alunoRow) {
                    alunoId = alunoRow.id;
                    coachId = alunoRow.coach_id;
                }
            } else {
                coachId = userId;
                if (data && data.alunoId) {
                    const alunoCandidate = await this.pool.query(
                        'SELECT id FROM public.alunos WHERE id = $1 LIMIT 1',
                        [data.alunoId],
                    );
                    if (alunoCandidate.rows.length > 0) {
                        alunoId = data.alunoId;
                    }
                }
            }

            if (!coachId) {
                return;
            }

            await this.pool.query(
                `INSERT INTO public.notificacoes 
                 (coach_id, aluno_id, tipo, titulo, mensagem, lida, link, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, false, $6, NOW(), NOW())`,
                [coachId, alunoId, type, title, message, link],
            );
        } catch (error) {
            console.error('Erro ao salvar notificação:', error);
        }
    }

    getStatusLabel(status) {
        const labels = {
            PENDING: 'Pendente',
            CONFIRMED: 'Confirmado',
            RECEIVED: 'Recebido',
            OVERDUE: 'Vencido',
            CANCELLED: 'Cancelado',
        };
        return labels[status] || status;
    }
}

module.exports = NotificationService;
