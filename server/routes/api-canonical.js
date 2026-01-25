// ============================================================================
// ROTAS CANÔNICAS DA API (/api/*)
// ============================================================================
// VPS-BACKEND-CANONICAL-ARCH-001
// Endpoints canônicos sem dependências externas
// ============================================================================

const express = require('express');
const router = express.Router();
const resolveAlunoOrFailMiddleware = require('../middleware/resolveAlunoOrFail');

module.exports = function(pool, authenticate) {
    
    // ============================================================================
    // MIDDLEWARE: resolveAlunoOrFail
    // ============================================================================
    const resolveAlunoOrFail = resolveAlunoOrFailMiddleware(pool);
    
    // ============================================================================
    // ENDPOINT: /api/mensagens
    // ============================================================================
    // GET /api/mensagens - Listar mensagens
    // POST /api/mensagens - Enviar mensagem
    // ============================================================================
    
    // GET /api/mensagens - Listar mensagens
    router.get('/mensagens', authenticate, resolveAlunoOrFail, async (req, res) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            const aluno = req.aluno; // Injetado pelo middleware
            
            if (!aluno) {
                return res.status(403).json({
                    error: 'Aluno não encontrado',
                    error_code: 'ALUNO_NOT_FOUND'
                });
            }
            
            // Buscar mensagens do aluno
            const mensagensResult = await pool.query(
                `SELECT 
                    m.id,
                    m.aluno_id,
                    m.sender_role,
                    m.sender_user_id,
                    m.conteudo,
                    m.lida,
                    m.created_at,
                    u.email as sender_email
                 FROM public.mensagens m
                 LEFT JOIN public.users u ON m.sender_user_id = u.id
                 WHERE m.aluno_id = $1
                 ORDER BY m.created_at ASC`,
                [aluno.id]
            );
            
            res.json(mensagensResult.rows);
        } catch (error) {
            console.error('Erro ao listar mensagens:', error);
            res.status(500).json({
                error: 'Erro ao listar mensagens',
                error_code: 'MESSAGES_LIST_ERROR'
            });
        }
    });
    
    // POST /api/mensagens - Enviar mensagem
    router.post('/mensagens', authenticate, resolveAlunoOrFail, async (req, res) => {
        try {
            const { conteudo } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            const aluno = req.aluno; // Injetado pelo middleware
            
            if (!conteudo || !conteudo.trim()) {
                return res.status(400).json({
                    error: 'Conteúdo da mensagem é obrigatório',
                    error_code: 'CONTENT_REQUIRED'
                });
            }
            
            if (!aluno) {
                return res.status(403).json({
                    error: 'Aluno não encontrado',
                    error_code: 'ALUNO_NOT_FOUND'
                });
            }
            
            // Validar permissões
            if (userRole === 'aluno') {
                // Aluno só pode enviar mensagens para seu próprio aluno_id
                // (aluno já foi resolvido pelo middleware)
            } else if (userRole === 'coach') {
                // Coach só pode enviar mensagens para alunos vinculados
                if (aluno.coach_id !== userId) {
                    return res.status(403).json({
                        error: 'Aluno não pertence a este coach',
                        error_code: 'ALUNO_NOT_BELONGS_TO_COACH'
                    });
                }
            } else {
                return res.status(403).json({
                    error: 'Acesso negado',
                    error_code: 'INVALID_ROLE'
                });
            }
            
            // Inserir mensagem
            const mensagemResult = await pool.query(
                `INSERT INTO public.mensagens (
                    aluno_id,
                    sender_role,
                    sender_user_id,
                    conteudo,
                    lida
                 ) VALUES ($1, $2, $3, $4, false)
                 RETURNING *`,
                [aluno.id, userRole, userId, conteudo.trim()]
            );
            
            res.status(201).json(mensagemResult.rows[0]);
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            res.status(500).json({
                error: 'Erro ao enviar mensagem',
                error_code: 'MESSAGE_SEND_ERROR'
            });
        }
    });
    
    // PATCH /api/mensagens/:id - Marcar mensagem como lida
    router.patch('/mensagens/:id', authenticate, resolveAlunoOrFail, async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const userRole = req.user.role;
            const aluno = req.aluno;
            
            if (!aluno) {
                return res.status(403).json({
                    error: 'Aluno não encontrado',
                    error_code: 'ALUNO_NOT_FOUND'
                });
            }
            
            // Buscar mensagem
            const mensagemResult = await pool.query(
                'SELECT * FROM public.mensagens WHERE id = $1 AND aluno_id = $2',
                [id, aluno.id]
            );
            
            if (mensagemResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Mensagem não encontrada',
                    error_code: 'MESSAGE_NOT_FOUND'
                });
            }
            
            // Validar que usuário pode marcar como lida
            // Aluno marca como lida se foi enviada pelo coach
            // Coach marca como lida se foi enviada pelo aluno
            const mensagem = mensagemResult.rows[0];
            if (mensagem.sender_role === userRole) {
                return res.status(403).json({
                    error: 'Não é possível marcar sua própria mensagem como lida',
                    error_code: 'CANNOT_MARK_OWN_MESSAGE'
                });
            }
            
            // Atualizar mensagem
            const updateResult = await pool.query(
                'UPDATE public.mensagens SET lida = true WHERE id = $1 RETURNING *',
                [id]
            );
            
            res.json(updateResult.rows[0]);
        } catch (error) {
            console.error('Erro ao marcar mensagem como lida:', error);
            res.status(500).json({
                error: 'Erro ao marcar mensagem como lida',
                error_code: 'MESSAGE_UPDATE_ERROR'
            });
        }
    });
    
    return router;
};
