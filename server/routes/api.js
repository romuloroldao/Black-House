// ============================================================================
// ROTAS DA API REST (/api/*)
// ============================================================================
// Design: Remoção completa do Supabase - 100% VPS PostgreSQL
// Todas as rotas antigas /rest/v1/* devem migrar para /api/*
// ============================================================================

const express = require('express');
const router = express.Router();
const { resolveAlunoOrFail, resolveCoachByAluno, validateAlunoBelongsToCoach } = require('../utils/identity-resolver');
const { validateUUIDParam } = require('../utils/uuid-validator');
const resolveAlunoOrFailMiddleware = require('../middleware/resolveAlunoOrFail');
const resolveCoachOrFailMiddleware = require('../middleware/resolveCoachOrFail');
const validateRole = require('../middleware/validateRole');

// ============================================================================
// MIDDLEWARES
// ============================================================================

module.exports = function(pool, authenticate, domainSchemaGuard) {
    
    // ============================================================================
    // MIDDLEWARES DE RESOLUÇÃO DE DOMÍNIO
    // ============================================================================
    const resolveAlunoOrFail = resolveAlunoOrFailMiddleware(pool);
    const resolveCoachOrFail = resolveCoachOrFailMiddleware(pool);
    
    // ============================================================================
    // ROTAS: ALUNOS
    // ============================================================================
    // IMPORTANTE: Rotas semânticas DEVEM vir ANTES de rotas paramétricas
    // ============================================================================
    
    // GET /api/alunos/me - Retorna o aluno canônico do usuário autenticado
    // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
    router.get('/alunos/me', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
        try {
            // req.aluno já está anexado pelo middleware resolveAlunoOrFail
            res.json(req.aluno);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // POST /api/alunos/link-user - Vincula usuário existente a aluno importado
    // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para coaches
    // DESIGN-LINK-ALUNO-USER-001: Rota semântica para vínculo aluno ↔ user
    router.post('/alunos/link-user', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, async (req, res) => {
        try {
            const { importedAlunoId, userIdToLink } = req.body;
            
            // Validações de entrada
            if (!importedAlunoId || !userIdToLink) {
                return res.status(400).json({
                    error: 'importedAlunoId e userIdToLink são obrigatórios',
                    error_code: 'MISSING_PARAMETERS'
                });
            }
            
            // Validar UUIDs
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(importedAlunoId) || !uuidRegex.test(userIdToLink)) {
                return res.status(400).json({
                    error: 'importedAlunoId e userIdToLink devem ser UUIDs válidos',
                    error_code: 'INVALID_UUID'
                });
            }
            
            const coachId = req.user.id;
            
            // DESIGN-LINK-ALUNO-USER-001: Validação 1 - Aluno existe e pertence ao coach
            const alunoResult = await pool.query(
                'SELECT id, coach_id, user_id FROM public.alunos WHERE id = $1',
                [importedAlunoId]
            );
            
            if (alunoResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Aluno importado não encontrado',
                    error_code: 'ALUNO_NOT_FOUND'
                });
            }
            
            const aluno = alunoResult.rows[0];
            
            // DESIGN-LINK-ALUNO-USER-001: Validação 2 - Coach autorizado
            if (aluno.coach_id !== coachId) {
                return res.status(403).json({
                    error: 'Coach não autorizado a vincular este aluno',
                    error_code: 'FORBIDDEN'
                });
            }
            
            // DESIGN-LINK-ALUNO-USER-001: Validação 3 - Aluno ainda não vinculado
            if (aluno.user_id) {
                return res.status(409).json({
                    error: 'Aluno já está vinculado a um usuário',
                    error_code: 'ALUNO_ALREADY_LINKED',
                    linked_user_id: aluno.user_id
                });
            }
            
            // DESIGN-LINK-ALUNO-USER-001: Validação 4 - User existe
            const userResult = await pool.query(
                'SELECT id, email FROM public.users WHERE id = $1',
                [userIdToLink]
            );
            
            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Usuário não encontrado',
                    error_code: 'USER_NOT_FOUND'
                });
            }
            
            // DESIGN-LINK-ALUNO-USER-001: Validação 5 - User não está vinculado a outro aluno
            const existingLink = await pool.query(
                'SELECT id, nome FROM public.alunos WHERE user_id = $1',
                [userIdToLink]
            );
            
            if (existingLink.rows.length > 0) {
                return res.status(409).json({
                    error: 'Usuário já está vinculado a outro aluno',
                    error_code: 'USER_ALREADY_LINKED',
                    linked_aluno_id: existingLink.rows[0].id,
                    linked_aluno_nome: existingLink.rows[0].nome
                });
            }
            
            // DESIGN-LINK-ALUNO-USER-001: Realizar vínculo
            const updateResult = await pool.query(
                `UPDATE public.alunos 
                 SET user_id = $1, updated_at = now()
                 WHERE id = $2
                 RETURNING id, user_id, coach_id, nome, email`,
                [userIdToLink, importedAlunoId]
            );
            
            res.status(200).json({
                success: true,
                message: 'Aluno vinculado ao usuário com sucesso',
                aluno: updateResult.rows[0]
            });
            
        } catch (error) {
            console.error('Erro ao vincular aluno ao usuário:', error);
            res.status(500).json({
                error: 'Erro ao vincular aluno ao usuário',
                error_code: 'LINK_ERROR'
            });
        }
    });
    
    // PATCH /api/alunos/me - Atualiza dados do aluno canônico
    // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
    // DESIGN-LINK-ALUNO-USER-001: NÃO permite alterar user_id (vínculo deve ser via /api/alunos/link-user)
    router.patch('/alunos/me', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
        try {
            const aluno = req.aluno; // Já resolvido pelo middleware
            
            // API-CONTRACT-001: Frontend NUNCA envia aluno_id ou user_id
            // DESIGN-LINK-ALUNO-USER-001: user_id NÃO pode ser alterado via update
            const { aluno_id, user_id, coach_id, ...updateData } = req.body;
            
            // DESIGN-LINK-ALUNO-USER-001: Rejeitar explicitamente tentativa de alterar user_id
            if (user_id !== undefined) {
                return res.status(403).json({
                    error: 'user_id não pode ser alterado via esta rota. Use POST /api/alunos/link-user para vincular.',
                    error_code: 'USER_ID_UPDATE_FORBIDDEN'
                });
            }
            
            // Campos permitidos para atualização
            const allowedFields = ['nome', 'email', 'telefone', 'cpf_cnpj', 'data_nascimento', 'peso', 'objetivo', 'plano', 'status'];
            
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex}`);
                    queryParams.push(updateData[field]);
                    paramIndex++;
                }
            }
            
            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }
            
            queryParams.push(aluno.id);
            const query = `
                UPDATE public.alunos 
                SET ${updateFields.join(', ')}, updated_at = now()
                WHERE id = $${paramIndex}
                RETURNING *
            `;
            
            const result = await pool.query(query, queryParams);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // GET /api/alunos/by-coach - Lista alunos do coach autenticado
    // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para coaches
    router.get('/alunos/by-coach', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, async (req, res) => {
        try {
            const query = `
                SELECT * FROM public.alunos 
                WHERE coach_id = $1
                ORDER BY created_at DESC
            `;
            
            const result = await pool.query(query, [req.user.id]);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // GET /api/alunos - Listar alunos
    router.get('/alunos', authenticate, domainSchemaGuard, async (req, res) => {
        try {
            const { coach_id, user_id, email } = req.query;
            const whereConditions = [];
            const queryParams = [];
            let paramIndex = 1;
            
            // Filtro por coach_id (coaches só veem seus próprios alunos)
            if (req.user.role === 'coach') {
                whereConditions.push(`coach_id = $${paramIndex}`);
                queryParams.push(req.user.id);
                paramIndex++;
            } else if (coach_id) {
                whereConditions.push(`coach_id = $${paramIndex}`);
                queryParams.push(coach_id);
                paramIndex++;
            }
            
            // Filtro por user_id (BLACKHOUSE-DOMAIN-ALUNO-COACH-004)
            if (user_id) {
                whereConditions.push(`user_id = $${paramIndex}`);
                queryParams.push(user_id);
                paramIndex++;
            }
            
            // Filtro por email
            if (email) {
                whereConditions.push(`email = $${paramIndex}`);
                queryParams.push(email);
                paramIndex++;
            }
            
            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            
            const query = `
                SELECT * FROM public.alunos 
                ${whereClause}
                ORDER BY created_at DESC
            `;
            
            const result = await pool.query(query, queryParams);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // API-CONTRACT-001: /api/alunos/:id é PROIBIDA
    // Use /api/alunos/me para alunos ou /api/alunos/by-coach para coaches
    // Esta rota foi removida conforme especificação
    
    // POST /api/alunos - Criar aluno
    router.post('/alunos', authenticate, domainSchemaGuard, async (req, res) => {
        try {
            const {
                nome,
                email,
                telefone,
                cpf_cnpj,
                data_nascimento,
                peso,
                objetivo,
                plano,
                user_id
            } = req.body;
            
            // Coaches só podem criar alunos para si mesmos
            const coach_id = req.user.role === 'coach' ? req.user.id : req.body.coach_id;
            
            // BLACKHOUSE-DOMAIN-ALUNO-COACH-004: user_id é obrigatório
            if (!user_id) {
                return res.status(400).json({ 
                    error: 'user_id é obrigatório',
                    error_code: 'USER_ID_REQUIRED'
                });
            }
            
            const query = `
                INSERT INTO public.alunos (
                    coach_id,
                    user_id,
                    nome,
                    email,
                    telefone,
                    cpf_cnpj,
                    data_nascimento,
                    peso,
                    objetivo,
                    plano
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;
            
            const result = await pool.query(query, [
                coach_id,
                user_id,
                nome || null,
                email || '',
                telefone || null,
                cpf_cnpj || null,
                data_nascimento || null,
                peso || null,
                objetivo || null,
                plano || null
            ]);
            
            // BLACKHOUSE-DOMAIN-ALUNO-COACH-004: user_id sempre é fornecido (obrigatório)
            
            res.status(201).json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // API-CONTRACT-001: PATCH /api/alunos/:id é PROIBIDA
    // Use PATCH /api/alunos/me ao invés
    // Rota removida conforme especificação
    
    // API-CONTRACT-001: DELETE /api/alunos/:id é PROIBIDA
    // Rota removida conforme especificação
    
    // API-CONTRACT-001: GET /api/alunos/:id/link-history é PROIBIDA
    // Rota removida conforme especificação
    
    // ============================================================================
    // ROTAS: PAYMENT_PLANS
    // ============================================================================
    
    // GET /api/payment-plans - Listar planos de pagamento
    router.get('/payment-plans', authenticate, domainSchemaGuard, async (req, res) => {
        try {
            const whereConditions = [];
            const queryParams = [];
            let paramIndex = 1;
            
            // Coaches só veem seus próprios planos
            if (req.user.role === 'coach') {
                whereConditions.push(`coach_id = $${paramIndex}`);
                queryParams.push(req.user.id);
                paramIndex++;
            } else if (req.query.coach_id) {
                whereConditions.push(`coach_id = $${paramIndex}`);
                queryParams.push(req.query.coach_id);
                paramIndex++;
            }
            
            // Filtro por ativo
            if (req.query.ativo !== undefined) {
                whereConditions.push(`ativo = $${paramIndex}`);
                queryParams.push(req.query.ativo === 'true');
                paramIndex++;
            }
            
            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            
            const query = `
                SELECT * FROM public.payment_plans 
                ${whereClause}
                ORDER BY created_at DESC
            `;
            
            const result = await pool.query(query, queryParams);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
            // GET /api/payment-plans/:id - Buscar plano por ID
    router.get('/payment-plans/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
        try {
            const { id } = req.params;
            
            const query = `
                SELECT * FROM public.payment_plans 
                WHERE id = $1
            `;
            
            const result = await pool.query(query, [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Plano não encontrado' });
            }
            
            // Verificar permissão
            if (req.user.role === 'coach' && result.rows[0].coach_id !== req.user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // POST /api/payment-plans - Criar plano de pagamento
    router.post('/payment-plans', authenticate, domainSchemaGuard, async (req, res) => {
        try {
            const {
                nome,
                descricao,
                valor,
                frequencia,
                dia_vencimento,
                ativo
            } = req.body;
            
            // Apenas coaches podem criar planos
            if (req.user.role !== 'coach' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Apenas coaches podem criar planos' });
            }
            
            const coach_id = req.user.id;
            
            const query = `
                INSERT INTO public.payment_plans (
                    coach_id,
                    nome,
                    descricao,
                    valor,
                    frequencia,
                    dia_vencimento,
                    ativo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            
            const result = await pool.query(query, [
                coach_id,
                nome,
                descricao || null,
                valor,
                frequencia,
                dia_vencimento,
                ativo !== undefined ? ativo : true
            ]);
            
            res.status(201).json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
            // PATCH /api/payment-plans/:id - Atualizar plano
    router.patch('/payment-plans/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
        try {
            const { id } = req.params;
            
            // Verificar permissão
            const planoCheck = await pool.query('SELECT coach_id FROM public.payment_plans WHERE id = $1', [id]);
            
            if (planoCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Plano não encontrado' });
            }
            
            if (req.user.role === 'coach' && planoCheck.rows[0].coach_id !== req.user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            
            const allowedFields = ['nome', 'descricao', 'valor', 'frequencia', 'dia_vencimento', 'ativo'];
            
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex}`);
                    queryParams.push(req.body[field]);
                    paramIndex++;
                }
            }
            
            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }
            
            queryParams.push(id);
            const query = `
                UPDATE public.payment_plans 
                SET ${updateFields.join(', ')}, updated_at = now()
                WHERE id = $${paramIndex}
                RETURNING *
            `;
            
            const result = await pool.query(query, queryParams);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
            // DELETE /api/payment-plans/:id - Deletar plano
    router.delete('/payment-plans/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
        try {
            const { id } = req.params;
            
            // Verificar permissão
            const planoCheck = await pool.query('SELECT coach_id FROM public.payment_plans WHERE id = $1', [id]);
            
            if (planoCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Plano não encontrado' });
            }
            
            if (req.user.role === 'coach' && planoCheck.rows[0].coach_id !== req.user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            
            await pool.query('DELETE FROM public.payment_plans WHERE id = $1', [id]);
            
            res.json({ message: 'Plano deletado com sucesso' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // ============================================================================
    // ROTAS: NOTIFICAÇÕES
    // ============================================================================
    
    // GET /api/notificacoes - Notificações do aluno autenticado
    // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
    router.get('/notificacoes', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
        try {
            const aluno = req.aluno; // Já resolvido pelo middleware
            
            // Query explícita - sem sintaxe PostgREST
            let query = `
                SELECT 
                    id,
                    aluno_id,
                    coach_id,
                    titulo,
                    mensagem,
                    tipo,
                    link,
                    lida,
                    created_at,
                    updated_at
                FROM public.notificacoes
                WHERE aluno_id = $1
            `;
            const queryParams = [aluno.id];
            let paramIndex = 2;
            
            // Filtros opcionais (sem sintaxe PostgREST)
            if (req.query.lida !== undefined) {
                query += ` AND lida = $${paramIndex}`;
                queryParams.push(req.query.lida === 'true');
                paramIndex++;
            }
            
            if (req.query.tipo) {
                query += ` AND tipo = $${paramIndex}`;
                queryParams.push(req.query.tipo);
                paramIndex++;
            }
            
            query += ` ORDER BY created_at DESC`;
            
            if (req.query.limit) {
                query += ` LIMIT $${paramIndex}`;
                queryParams.push(parseInt(req.query.limit));
            } else {
                query += ` LIMIT 100`;
            }
            
            const result = await pool.query(query, queryParams);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
            // GET /api/notificacoes/:id - Buscar notificação por ID
    router.get('/notificacoes/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
        try {
            const { id } = req.params;
            
            const query = `
                SELECT * FROM public.notificacoes 
                WHERE id = $1
            `;
            
            const result = await pool.query(query, [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Notificação não encontrada' });
            }
            
            // Verificar permissão
            const notificacao = result.rows[0];
            if (req.user.role === 'coach' && notificacao.coach_id !== req.user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            
            if (req.user.role === 'aluno' && notificacao.aluno_id) {
                const alunoResult = await pool.query(
                    'SELECT id FROM public.alunos WHERE user_id = $1',
                    [req.user.id]
                );
                
                if (alunoResult.rows.length === 0 || alunoResult.rows[0].id !== notificacao.aluno_id) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }
            
            res.json(notificacao);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // POST /api/notificacoes - Criar notificação
    router.post('/notificacoes', authenticate, domainSchemaGuard, async (req, res) => {
        try {
            const {
                aluno_id,
                titulo,
                mensagem,
                tipo,
                link
            } = req.body;
            
            // Apenas coaches podem criar notificações
            if (req.user.role !== 'coach' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Apenas coaches podem criar notificações' });
            }
            
            const coach_id = req.user.id;
            
            const query = `
                INSERT INTO public.notificacoes (
                    coach_id,
                    aluno_id,
                    titulo,
                    mensagem,
                    tipo,
                    link
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;
            
            const result = await pool.query(query, [
                coach_id,
                aluno_id || null,
                titulo,
                mensagem,
                tipo || 'info',
                link || null
            ]);
            
            res.status(201).json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
            // PATCH /api/notificacoes/:id - Atualizar notificação
    router.patch('/notificacoes/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
        try {
            const { id } = req.params;
            
            // Verificar permissão
            const notificacaoCheck = await pool.query(
                'SELECT coach_id, aluno_id FROM public.notificacoes WHERE id = $1',
                [id]
            );
            
            if (notificacaoCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Notificação não encontrada' });
            }
            
            const notificacao = notificacaoCheck.rows[0];
            
            // Coaches podem atualizar suas próprias notificações
            // Alunos podem apenas marcar como lida
            if (req.user.role === 'coach' && notificacao.coach_id !== req.user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            
            if (req.user.role === 'aluno') {
                // Alunos só podem atualizar o campo 'lida'
                if (Object.keys(req.body).length > 1 || req.body.lida === undefined) {
                    return res.status(403).json({ error: 'Alunos só podem marcar notificações como lida' });
                }
                
                const alunoResult = await pool.query(
                    'SELECT id FROM public.alunos WHERE user_id = $1',
                    [req.user.id]
                );
                
                if (alunoResult.rows.length === 0 || alunoResult.rows[0].id !== notificacao.aluno_id) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }
            
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            
            const allowedFields = req.user.role === 'aluno' 
                ? ['lida'] 
                : ['titulo', 'mensagem', 'tipo', 'link', 'lida'];
            
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex}`);
                    queryParams.push(req.body[field]);
                    paramIndex++;
                }
            }
            
            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }
            
            queryParams.push(id);
            const query = `
                UPDATE public.notificacoes 
                SET ${updateFields.join(', ')}, updated_at = now()
                WHERE id = $${paramIndex}
                RETURNING *
            `;
            
            const result = await pool.query(query, queryParams);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
            // DELETE /api/notificacoes/:id - Deletar notificação
    router.delete('/notificacoes/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
        try {
            const { id } = req.params;
            
            // Verificar permissão
            const notificacaoCheck = await pool.query(
                'SELECT coach_id FROM public.notificacoes WHERE id = $1',
                [id]
            );
            
            if (notificacaoCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Notificação não encontrada' });
            }
            
            // Apenas coaches podem deletar notificações
            if (req.user.role !== 'coach' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Apenas coaches podem deletar notificações' });
            }
            
            if (notificacaoCheck.rows[0].coach_id !== req.user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            
            await pool.query('DELETE FROM public.notificacoes WHERE id = $1', [id]);
            
            res.json({ message: 'Notificação deletada com sucesso' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // ============================================================================
    // ENDPOINTS REST CANÔNICOS - BLACKHOUSE-BACKEND-SOVEREIGN-ARCH-004
    // ============================================================================
    // Endpoints REST clássicos (sem padrões PostgREST)
    // Nunca usar select=, eq=, order= nas URLs
    // ============================================================================
    
    // GET /api/notificacoes - Notificações do usuário autenticado
    router.get('/notificacoes', authenticate, domainSchemaGuard, async (req, res) => {
        try {
            const { lida, tipo, limit } = req.query;
            
            let query;
            let queryParams = [];
            let paramIndex = 1;
            
            if (req.user.role === 'coach') {
                // Coach vê suas próprias notificações
                query = 'SELECT * FROM public.notificacoes WHERE coach_id = $1';
                queryParams.push(req.user.id);
                paramIndex++;
            } else if (req.user.role === 'aluno') {
                // Aluno vê suas próprias notificações (via linked_user_id)
                try {
                    const aluno = await resolveAlunoOrFail(pool, req.user.id);
                    query = 'SELECT * FROM public.notificacoes WHERE aluno_id = $1';
                    queryParams.push(aluno.id);
                    paramIndex++;
                } catch (error) {
                    if (error.code === 'ALUNO_NOT_LINKED') {
                        // Aluno não vinculado - retornar lista vazia ao invés de erro
                        return res.json([]);
                    }
                    throw error;
                }
            } else {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            
            // Filtros opcionais
            if (lida !== undefined) {
                query += ` AND lida = $${paramIndex}`;
                queryParams.push(lida === 'true');
                paramIndex++;
            }
            
            if (tipo) {
                query += ` AND tipo = $${paramIndex}`;
                queryParams.push(tipo);
                paramIndex++;
            }
            
            query += ' ORDER BY created_at DESC';
            
            if (limit) {
                query += ` LIMIT $${paramIndex}`;
                queryParams.push(parseInt(limit));
            }
            
            const result = await pool.query(query, queryParams);
            res.json(result.rows);
        } catch (error) {
            if (error.code === 'ALUNO_NOT_LINKED') {
                return res.status(403).json({ 
                    error: 'Aluno não vinculado',
                    error_code: 'ALUNO_NOT_LINKED'
                });
            }
            res.status(500).json({ error: error.message });
        }
    });
    
    // GET /api/profiles/me - Perfil do usuário logado
    router.get('/profiles/me', authenticate, async (req, res) => {
        try {
            const userId = req.user.id;
            
            const query = `
                SELECT 
                    p.id,
                    p.avatar_url,
                    p.created_at,
                    p.updated_at,
                    u.email,
                    u.created_at as user_created_at,
                    COALESCE(ur.role, 'aluno') as role
                FROM public.profiles p
                RIGHT JOIN app_auth.users u ON u.id = p.id
                LEFT JOIN public.user_roles ur ON ur.user_id = u.id
                WHERE u.id = $1
            `;
            
            const result = await pool.query(query, [userId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Perfil não encontrado' });
            }
            
            // Se for aluno, incluir dados do aluno
            if (req.user.role === 'aluno') {
                try {
                    const aluno = await resolveAlunoOrFail(pool, userId);
                    result.rows[0].aluno = aluno;
                } catch (error) {
                    if (error.code === 'ALUNO_NOT_LINKED') {
                        // Aluno não vinculado - retornar perfil sem aluno
                        result.rows[0].aluno = null;
                        result.rows[0].aluno_linked = false;
                    } else {
                        throw error;
                    }
                }
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // ============================================================================
    // ROTA: /api/me - Buscar identidade do usuário/aluno atual
    // ============================================================================
    // DESIGN-VPS-ONLY-CANONICAL-DATA-AND-STORAGE-002
    // Frontend deve usar este endpoint para buscar identidade do aluno
    // ============================================================================
    
    router.get('/me', authenticate, async (req, res) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            
            // Buscar dados do usuário
            const userResult = await pool.query(
                'SELECT id, email, created_at FROM app_auth.users WHERE id = $1',
                [userId]
            );
            
            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            
            const userData = {
                ...userResult.rows[0],
                role: userRole,
                payment_status: req.user.payment_status || 'CURRENT'
            };
            
            // Se for aluno, buscar dados do aluno também
            // VPS-NATIVE-ARCH-ALUNOS-COACH-001: Usar resolveAlunoOrFail para garantir aluno canônico
            if (userRole === 'aluno') {
                try {
                    const aluno = await resolveAlunoOrFail(pool, userId);
                    userData.aluno = aluno;
                } catch (error) {
                    if (error.code === 'ALUNO_NOT_LINKED') {
                        // Aluno não vinculado - retornar erro explícito
                        userData.aluno = null;
                        userData.aluno_linked = false;
                    } else {
                        throw error;
                    }
                }
            }
            
            res.json(userData);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // ============================================================================
    // ROTA: /api/checkins - Validar e criar check-in semanal
    // ============================================================================
    // VPS-NATIVE-ARCH-ALUNOS-COACH-001
    // Resolve aluno canônico via resolveAlunoOrFail
    // Coach_id é inferido via aluno (aluno sempre pertence a um coach)
    // ============================================================================
    
    // POST /api/checkins - Criar check-in semanal
    // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
    router.post('/checkins', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
        try {
            const aluno = req.aluno; // Já resolvido pelo middleware resolveAlunoOrFail
            const userId = req.user.id;
            
            // Validar se aluno_id fornecido (se houver) corresponde ao aluno do usuário
            // Frontend nunca deve enviar aluno_id - backend sempre resolve via linked_user_id
            if (req.body.aluno_id && req.body.aluno_id !== aluno.id) {
                return res.status(403).json({ 
                    error: 'Aluno inválido',
                    error_code: 'ALUNO_MISMATCH',
                    message: 'O aluno_id fornecido não corresponde ao seu perfil.'
                });
            }
            
            // Coach_id é inferido via aluno (aluno sempre pertence a um coach)
            if (!aluno.coach_id) {
                return res.status(400).json({ 
                    error: 'Aluno sem coach vinculado',
                    error_code: 'COACH_NOT_FOUND',
                    message: 'Seu aluno não tem um coach vinculado.'
                });
            }
            
            // Criar check-in com aluno_id correto
            const checkinData = {
                aluno_id: aluno.id,
                ...req.body
            };
            
            // Remover campos que não pertencem à tabela weekly_checkins
            const allowedFields = [
                'peso', 'nivel_energia', 'qualidade_sono', 'nivel_estresse',
                'adesao_dieta', 'adesao_treino', 'observacoes', 'escala_bristol',
                'data_checkin'
            ];
            
            const insertData = {};
            for (const field of allowedFields) {
                if (checkinData[field] !== undefined) {
                    insertData[field] = checkinData[field];
                }
            }
            
            // Mapear campos do formulário para campos do banco
            const fieldMapping = {
                'beliscou_fora_plano': null, // Não mapeia diretamente
                'seguiu_plano_nota': 'adesao_dieta',
                'apetite': null,
                'treinou_todas_sessoes': null,
                'desafiou_treinos': null,
                'fez_cardio': null,
                'seguiu_suplementacao': null,
                'recursos_hormonais': null,
                'ingeriu_agua_minima': null,
                'exposicao_sol': null,
                'pressao_arterial': null,
                'glicemia': null,
                'media_horas_sono': 'qualidade_sono',
                'dificuldade_adormecer': null,
                'acordou_noite': null,
                'estresse_semana': 'nivel_estresse',
                'lida_desafios': null,
                'convivio_familiar': null,
                'convivio_trabalho': null,
                'postura_problemas': null,
                'higiene_sono': null,
                'autoestima': 'nivel_energia',
                'media_evacuacoes': null,
                'formato_fezes': 'escala_bristol',
                'nao_cumpriu_porque': 'observacoes'
            };
            
            // Aplicar mapeamento
            for (const [formField, dbField] of Object.entries(fieldMapping)) {
                if (req.body[formField] !== undefined && dbField) {
                    insertData[dbField] = req.body[formField];
                }
            }
            
            // Inserir check-in
            const columns = Object.keys(insertData);
            const values = Object.values(insertData);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            
            const query = `
                INSERT INTO public.weekly_checkins (aluno_id, ${columns.join(', ')})
                VALUES ($1, ${placeholders})
                RETURNING *
            `;
            
            const result = await pool.query(query, [aluno.id, ...values]);
            
            res.status(201).json({
                success: true,
                checkin: result.rows[0],
                aluno: {
                    id: aluno.id,
                    nome: aluno.nome
                }
            });
        } catch (error) {
            console.error('Erro ao criar check-in:', error);
            res.status(500).json({ 
                error: error.message || 'Erro ao criar check-in',
                error_code: 'CHECKIN_CREATE_ERROR'
            });
        }
    });
    
    // ============================================================================
    // ROTAS: MENSAGENS (/api/messages)
    // ============================================================================
    // VPS-NATIVE-ARCH-ALUNOS-COACH-001
    // Regras:
    // - Aluno só fala com seu coach (coach_id inferido via aluno)
    // - Coach só responde seus alunos (valida aluno pertence ao coach)
    // - sender nunca vem do client sem validação
    // ============================================================================
    
    // POST /api/mensagens - Aluno envia mensagem ao coach
    // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
    router.post('/mensagens', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
        try {
            // API-CONTRACT-001: Frontend NUNCA envia aluno_id ou user_id
            const { aluno_id, user_id, conversa_id, conteudo } = req.body;
            
            if (!conteudo || !conteudo.trim()) {
                return res.status(400).json({ 
                    error: 'Conteúdo da mensagem é obrigatório',
                    error_code: 'CONTENT_REQUIRED'
                });
            }
            
            const aluno = req.aluno; // Já resolvido pelo middleware
            const userId = req.user.id;
            
            // Validar que aluno tem coach
            if (!aluno.coach_id) {
                return res.status(400).json({ 
                    error: 'Aluno sem coach vinculado',
                    error_code: 'COACH_NOT_FOUND'
                });
            }
            
            // Resolver ou criar conversa
            let conversa;
            if (conversa_id) {
                // Validar UUID
                if (!conversa_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                    return res.status(400).json({ 
                        error: 'conversa_id inválido',
                        error_code: 'INVALID_UUID'
                    });
                }
                
                const conversaResult = await pool.query(
                    'SELECT * FROM public.conversas WHERE id = $1 AND aluno_id = $2',
                    [conversa_id, aluno.id]
                );
                
                if (conversaResult.rows.length === 0) {
                    return res.status(404).json({ 
                        error: 'Conversa não encontrada',
                        error_code: 'CONVERSA_NOT_FOUND'
                    });
                }
                
                conversa = conversaResult.rows[0];
            } else {
                // Buscar ou criar conversa usando função helper
                const conversaResult = await pool.query(
                    'SELECT * FROM public.get_or_create_conversa($1, $2)',
                    [aluno.id, aluno.coach_id]
                );
                
                if (conversaResult.rows.length === 0) {
                    // Se função não retornar, criar manualmente
                    let existingConversa = await pool.query(
                        'SELECT * FROM public.conversas WHERE aluno_id = $1 AND coach_id = $2',
                        [aluno.id, aluno.coach_id]
                    );
                    
                    if (existingConversa.rows.length === 0) {
                        const novaConversa = await pool.query(
                            'INSERT INTO public.conversas (aluno_id, coach_id) VALUES ($1, $2) RETURNING *',
                            [aluno.id, aluno.coach_id]
                        );
                        conversa = novaConversa.rows[0];
                    } else {
                        conversa = existingConversa.rows[0];
                    }
                } else {
                    conversa = { id: conversaResult.rows[0].get_or_create_conversa };
                }
            }
            
            // Destinatário é sempre o coach do aluno
            const destinatarioId = aluno.coach_id;
            
            // Inserir mensagem (remetente_id e destinatario_id sempre do backend)
            const mensagemResult = await pool.query(
                `INSERT INTO public.mensagens (conversa_id, remetente_id, destinatario_id, conteudo, lida)
                 VALUES ($1, $2, $3, $4, false)
                 RETURNING *`,
                [conversa.id, userId, destinatarioId, conteudo.trim()]
            );
            
            // Atualizar última mensagem da conversa
            await pool.query(
                'UPDATE public.conversas SET ultima_mensagem = $1, ultima_mensagem_em = now() WHERE id = $2',
                [conteudo.trim(), conversa.id]
            );
            
            res.status(201).json(mensagemResult.rows[0]);
        } catch (error) {
            if (error.code === 'ALUNO_NOT_LINKED') {
                return res.status(403).json({ 
                    error: 'Aluno não vinculado',
                    error_code: 'ALUNO_NOT_LINKED',
                    message: 'Seu perfil não está vinculado a um aluno.'
                });
            }
            
            console.error('Erro ao enviar mensagem:', error);
            res.status(500).json({ 
                error: error.message || 'Erro ao enviar mensagem',
                error_code: 'MESSAGE_SEND_ERROR'
            });
        }
    });
    
    // GET /api/mensagens - Lista mensagens do aluno autenticado
    // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
    router.get('/mensagens', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
        try {
            const { conversaId, status } = req.query; // API-CONTRACT-001: query params semânticos
            const userId = req.user.id;
            const aluno = req.aluno; // Já resolvido pelo middleware
            
            // API-CONTRACT-001: Buscar conversa do aluno
            const conversaResult = await pool.query(
                'SELECT * FROM public.conversas WHERE aluno_id = $1 LIMIT 1',
                [aluno.id]
            );
            
            if (conversaResult.rows.length === 0) {
                // Aluno sem conversa - retornar lista vazia
                return res.json([]);
            }
            
            const conversa = conversaResult.rows[0];
            
            // Construir query base
            let query = `
                SELECT 
                    m.id,
                    m.conversa_id,
                    m.remetente_id,
                    m.destinatario_id,
                    m.conteudo,
                    m.lida,
                    m.created_at
                FROM public.mensagens m
                WHERE m.conversa_id = $1
            `;
            const queryParams = [conversa.id];
            let paramIndex = 2;
            
            // Filtro por conversaId (se fornecido)
            if (conversaId && conversaId !== conversa.id) {
                return res.status(403).json({ 
                    error: 'Conversa não pertence ao aluno',
                    error_code: 'CONVERSA_MISMATCH'
                });
            }
            
            // Filtro por status (lida/não lida)
            if (status === 'lida' || status === 'true') {
                query += ` AND m.lida = $${paramIndex}`;
                queryParams.push(true);
                paramIndex++;
            } else if (status === 'nao_lida' || status === 'false') {
                query += ` AND m.lida = $${paramIndex}`;
                queryParams.push(false);
                paramIndex++;
            }
            
            query += ` ORDER BY m.created_at ASC`;
            
            const mensagensResult = await pool.query(query, queryParams);
            res.json(mensagensResult.rows);
        } catch (error) {
            if (error.code === 'ALUNO_NOT_LINKED') {
                return res.status(403).json({ 
                    error: 'Aluno não vinculado',
                    error_code: 'ALUNO_NOT_LINKED'
                });
            }
            
            console.error('Erro ao listar mensagens:', error);
            res.status(500).json({ 
                error: error.message || 'Erro ao listar mensagens',
                error_code: 'MESSAGES_LIST_ERROR'
            });
        }
    });
    
    // ============================================================================
    // ROTAS GENÉRICAS (/api/:table) - API-CONTRACT-001: PROIBIDAS
    // ============================================================================
    // Sintaxe PostgREST (select=, eq=, neq=, etc) é FORBIDDEN conforme especificação
    // Todas as rotas genéricas foram removidas completamente
    // Use rotas semânticas específicas ao invés:
    // - GET /api/alunos/me (para alunos)
    // - GET /api/alunos/by-coach (para coaches)
    // - GET /api/mensagens (para mensagens)
    // - GET /api/notificacoes (para notificações)
    // ============================================================================
    
    return router;
};
