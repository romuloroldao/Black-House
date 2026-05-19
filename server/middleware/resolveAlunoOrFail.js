// ============================================================================
// MIDDLEWARE: resolveAlunoOrFail
// ============================================================================

const logger = require('../utils/logger');
const { queryAlunoRowsFullForUser } = require('../utils/aluno-resolve-by-user');

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
    function withCanonicalUserId(row) {
        if (!row) return row;
        const link = row.linked_user_id != null ? row.linked_user_id : row.user_id;
        return { ...row, user_id: link };
    }

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
            
            // Se for aluno: linked_user_id (canónico) ou fallback por email se a coluna não existir na BD
            if (userRole === 'aluno') {
                const rows = await queryAlunoRowsFullForUser(pool, userId);

                if (rows.length === 0) {
                    return res.status(403).json({
                        error: 'Aluno não vinculado',
                        error_code: 'ALUNO_NOT_LINKED',
                        message: 'Seu perfil não está vinculado a um aluno. Entre em contato com seu coach.'
                    });
                }

                req.aluno = withCanonicalUserId(rows[0]);
                return next();
            }
            
            // Se for coach, validar aluno_id se fornecido
            if (userRole === 'coach') {
                const { aluno_id } = req.body || req.query;
                
                if (aluno_id) {
                    const alunoResult = await pool.query(
                        `SELECT a.* FROM public.alunos a WHERE a.id = $1 AND a.coach_id = $2`,
                        [aluno_id, userId]
                    );
                    
                    if (alunoResult.rows.length === 0) {
                        return res.status(403).json({
                            error: 'Aluno não encontrado ou não pertence a este coach',
                            error_code: 'ALUNO_NOT_BELONGS_TO_COACH'
                        });
                    }
                    
                    req.aluno = withCanonicalUserId(alunoResult.rows[0]);
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
                        req.aluno = withCanonicalUserId(alunoResult.rows[0]);
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
