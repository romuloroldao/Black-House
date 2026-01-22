// ============================================================================
// MIDDLEWARE: resolveAlunoOrFail
// ============================================================================
// VPS-BACKEND-CANONICAL-ARCH-001
// Resolve aluno canônico baseado no role do usuário
// ============================================================================

const logger = require('../utils/logger');

/**
 * Middleware para resolver aluno canônico
 * 
 * Regras:
 * - Se role == 'aluno' → resolve aluno via linked_user_id (canônico)
 * - Se role == 'coach' → exige aluno_id válido e vinculado ao coach
 * - Caso contrário → 403
 * 
 * Injeta req.aluno no request
 */
function resolveAlunoOrFail(pool) {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            
            // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Validar role explicitamente
            // resolveAlunoOrFail é apenas para alunos (ou coaches com aluno_id)
            if (userRole !== 'aluno' && userRole !== 'coach' && userRole !== 'admin') {
                return res.status(403).json({
                    error: 'Acesso negado',
                    error_code: 'ROLE_FORBIDDEN',
                    message: 'Esta rota requer role "aluno". Seu role: ' + userRole
                });
            }
            
            // Se for aluno, resolver aluno via user_id (canônico)
            // BLACKHOUSE-DOMAIN-ALUNO-COACH-004: alunos.user_id é a única fonte de verdade
            if (userRole === 'aluno') {
                const alunoResult = await pool.query(
                    `SELECT 
                        a.id,
                        a.nome,
                        a.email,
                        a.telefone,
                        a.coach_id,
                        a.user_id,
                        a.status,
                        a.created_at
                     FROM public.alunos a
                     WHERE a.user_id = $1`,
                    [userId]
                );
                
                if (alunoResult.rows.length === 0) {
                    return res.status(403).json({
                        error: 'Aluno não vinculado',
                        error_code: 'ALUNO_NOT_LINKED',
                        message: 'Seu perfil não está vinculado a um aluno. Entre em contato com seu coach.'
                    });
                }
                
                req.aluno = alunoResult.rows[0];
                return next();
            }
            
            // Se for coach, validar aluno_id se fornecido
            if (userRole === 'coach') {
                const { aluno_id } = req.body || req.query;
                
                if (aluno_id) {
                    // Validar que aluno pertence ao coach
                    const alunoResult = await pool.query(
                        `SELECT 
                            a.id,
                            a.nome,
                            a.email,
                            a.telefone,
                            a.coach_id,
                            a.user_id,
                            a.status
                         FROM public.alunos a
                         WHERE a.id = $1 AND a.coach_id = $2`,
                        [aluno_id, userId]
                    );
                    
                    if (alunoResult.rows.length === 0) {
                        return res.status(403).json({
                            error: 'Aluno não encontrado ou não pertence a este coach',
                            error_code: 'ALUNO_NOT_BELONGS_TO_COACH'
                        });
                    }
                    
                    req.aluno = alunoResult.rows[0];
                }
                
                return next();
            }
            
            // Admin pode acessar qualquer aluno (se fornecido)
            if (userRole === 'admin') {
                const { aluno_id } = req.body || req.query;
                
                if (aluno_id) {
                    const alunoResult = await pool.query(
                        'SELECT * FROM public.alunos WHERE id = $1',
                        [aluno_id]
                    );
                    
                    if (alunoResult.rows.length > 0) {
                        req.aluno = alunoResult.rows[0];
                    }
                }
                
                return next();
            }
            
            // Role inválido
            return res.status(403).json({
                error: 'Acesso negado',
                error_code: 'INVALID_ROLE'
            });
            
        } catch (error) {
            logger.error('Erro no middleware resolveAlunoOrFail', {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
                userRole: req.user?.role
            });
            
            res.status(500).json({
                error: 'Erro ao resolver aluno',
                error_code: 'ALUNO_RESOLUTION_ERROR'
            });
        }
    };
}

module.exports = resolveAlunoOrFail;
