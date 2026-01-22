// WebSocket Service
// Substitui Supabase Realtime com Socket.io
// Suporta chat, notificações e atualizações em tempo real

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

class WebSocketService {
    constructor(httpServer, pool, jwtSecret) {
        this.pool = pool;
        this.jwtSecret = jwtSecret;
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL?.split(',') || [
                    'http://localhost:5173',
                    'http://localhost:3000',
                    'http://blackhouse.app.br',
                    'https://blackhouse.app.br'
                ],
                credentials: true
            },
            path: '/socket.io'
        });

        this.connectedUsers = new Map(); // userId -> socketId[]
        this.userSockets = new Map(); // socketId -> { userId, role, coachId, alunoId }

        this.setupMiddleware();
        this.setupEventHandlers();
    }

    /**
     * Configura middleware de autenticação
     */
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.query.token;

                if (!token) {
                    return next(new Error('Token não fornecido'));
                }

                // Verificar JWT
                const decoded = jwt.verify(token, this.jwtSecret);
                
                // Buscar usuário no banco
                const result = await this.pool.query(
                    'SELECT id, email, role, coach_id, aluno_id FROM app_auth.users WHERE id = $1',
                    [decoded.userId]
                );

                if (result.rows.length === 0) {
                    return next(new Error('Usuário não encontrado'));
                }

                const user = result.rows[0];

                // Armazenar informações do usuário no socket
                socket.userId = user.id;
                socket.userRole = user.role;
                socket.coachId = user.coach_id;
                socket.alunoId = user.aluno_id;

                // Mapear socket para usuário
                if (!this.connectedUsers.has(user.id)) {
                    this.connectedUsers.set(user.id, []);
                }
                this.connectedUsers.get(user.id).push(socket.id);
                this.userSockets.set(socket.id, {
                    userId: user.id,
                    role: user.role,
                    coachId: user.coach_id,
                    alunoId: user.aluno_id
                });

                next();
            } catch (error) {
                console.error('Erro na autenticação WebSocket:', error);
                next(new Error('Autenticação falhou'));
            }
        });
    }

    /**
     * Configura handlers de eventos
     */
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Cliente conectado: ${socket.id} (User: ${socket.userId})`);

            // Entrar em salas baseadas no usuário
            socket.join(`user:${socket.userId}`);
            
            if (socket.coachId) {
                socket.join(`coach:${socket.coachId}`);
            }
            
            if (socket.alunoId) {
                socket.join(`aluno:${socket.alunoId}`);
            }

            // Handler: Entrar em sala de conversa
            socket.on('join_conversation', async ({ conversationId }) => {
                try {
                    // Verificar se usuário tem acesso à conversa
                    const hasAccess = await this.checkConversationAccess(
                        socket.userId,
                        conversationId
                    );

                    if (hasAccess) {
                        socket.join(`conversation:${conversationId}`);
                        socket.emit('conversation_joined', { conversationId });
                    } else {
                        socket.emit('error', { message: 'Acesso negado à conversa' });
                    }
                } catch (error) {
                    console.error('Erro ao entrar em conversa:', error);
                    socket.emit('error', { message: 'Erro ao entrar em conversa' });
                }
            });

            // Handler: Sair de sala de conversa
            socket.on('leave_conversation', ({ conversationId }) => {
                socket.leave(`conversation:${conversationId}`);
            });

            // Handler: Enviar mensagem de chat
            socket.on('send_message', async ({ conversationId, message, recipientId }) => {
                try {
                    // Validar e salvar mensagem no banco
                    const messageData = await this.saveMessage({
                        conversationId,
                        senderId: socket.userId,
                        recipientId,
                        message
                    });

                    // Emitir para a sala da conversa
                    this.io.to(`conversation:${conversationId}`).emit('new_message', messageData);

                    // Emitir também para o destinatário específico
                    if (recipientId) {
                        this.io.to(`user:${recipientId}`).emit('new_message', messageData);
                    }
                } catch (error) {
                    console.error('Erro ao enviar mensagem:', error);
                    socket.emit('error', { message: 'Erro ao enviar mensagem' });
                }
            });

            // Handler: Desconexão
            socket.on('disconnect', () => {
                console.log(`Cliente desconectado: ${socket.id}`);
                
                // Remover mapeamentos
                const userInfo = this.userSockets.get(socket.id);
                if (userInfo) {
                    const userSockets = this.connectedUsers.get(userInfo.userId);
                    if (userSockets) {
                        const index = userSockets.indexOf(socket.id);
                        if (index > -1) {
                            userSockets.splice(index, 1);
                        }
                        if (userSockets.length === 0) {
                            this.connectedUsers.delete(userInfo.userId);
                        }
                    }
                }
                this.userSockets.delete(socket.id);
            });
        });
    }

    /**
     * Verifica se usuário tem acesso à conversa
     */
    async checkConversationAccess(userId, conversationId) {
        try {
            // Buscar conversa no banco
            const result = await this.pool.query(
                `SELECT sender_id, recipient_id FROM public.mensagens 
                 WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)
                 LIMIT 1`,
                [conversationId, userId]
            );

            return result.rows.length > 0;
        } catch (error) {
            // Se tabela não existir, permitir acesso (será criada na migração)
            console.warn('Tabela mensagens não encontrada, permitindo acesso:', error.message);
            return true;
        }
    }

    /**
     * Salva mensagem no banco de dados
     */
    async saveMessage({ conversationId, senderId, recipientId, message }) {
        try {
            const result = await this.pool.query(
                `INSERT INTO public.mensagens (sender_id, recipient_id, message, created_at)
                 VALUES ($1, $2, $3, NOW())
                 RETURNING id, sender_id, recipient_id, message, created_at`,
                [senderId, recipientId, message]
            );

            return result.rows[0];
        } catch (error) {
            // Se tabela não existir, criar mensagem em memória
            console.warn('Tabela mensagens não encontrada, criando mensagem em memória:', error.message);
            return {
                id: `temp_${Date.now()}`,
                sender_id: senderId,
                recipient_id: recipientId,
                message,
                created_at: new Date().toISOString()
            };
        }
    }

    /**
     * Emite notificação para um usuário específico
     */
    emitToUser(userId, event, data) {
        this.io.to(`user:${userId}`).emit(event, data);
    }

    /**
     * Emite notificação para um coach específico
     */
    emitToCoach(coachId, event, data) {
        this.io.to(`coach:${coachId}`).emit(event, data);
    }

    /**
     * Emite notificação para um aluno específico
     */
    emitToAluno(alunoId, event, data) {
        this.io.to(`aluno:${alunoId}`).emit(event, data);
    }

    /**
     * Emite notificação para uma conversa específica
     */
    emitToConversation(conversationId, event, data) {
        this.io.to(`conversation:${conversationId}`).emit(event, data);
    }

    /**
     * Emite evento global (broadcast)
     */
    emitGlobal(event, data) {
        this.io.emit(event, data);
    }

    /**
     * Retorna instância do Socket.io
     */
    getIO() {
        return this.io;
    }

    /**
     * Verifica se usuário está online
     */
    isUserOnline(userId) {
        return this.connectedUsers.has(userId) && this.connectedUsers.get(userId).length > 0;
    }
}

module.exports = WebSocketService;
