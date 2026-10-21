// ============================================================================
// MIDDLEWARE: resolveCoachOrFail
// ============================================================================
// DOMAIN-RESOLUTION-ALUNO-COACH-003
// Resolve coach canônico baseado no role do usuário
// ============================================================================

const logger = require('../utils/logger');
const { resolveCoachOrFail: resolveCoachOrFailUtil } = require('../utils/identity-resolver');

/**
 * Middleware para resolver coach canônico
 * 
 * Regras:
 * - Se role == 'coach' → resolve coach via user_id
 * - Caso contrário → 403
 * 
 * Injeta req.coach no request
 */
function resolveCoachOrFail(pool) {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            
            // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Validar role explicitamente
            // resolveCoachOrFail é apenas para coaches (ou admin)
            if (userRole !== 'coach' && userRole !== 'admin') {
                return res.status(403).json({
                    error: 'Acesso negado',
                    error_code: 'ROLE_FORBIDDEN',
                    message: 'Esta rota requer role "coach". Seu role: ' + userRole
                });
            }
            
            // Se for coach, resolver coach via user_id
            if (userRole === 'coach' || userRole === 'admin') {
                try {
                    const coach = await resolveCoachOrFailUtil(pool, userId);
                    req.coach = coach;
                    req.coach_id = userId; // Para compatibilidade
                    return next();
                } catch (error) {
                    if (error.code === 'NOT_A_COACH' || error.code === 'USER_NOT_FOUND') {
                        return res.status(403).json({
                            error: 'Coach não encontrado',
                            error_code: error.code,
                            message: 'Seu perfil não está vinculado a um coach.'
                        });
                    }
                    throw error;
                }
            }
            
            // Role inválido
            return res.status(403).json({
                error: 'Acesso negado',
                error_code: 'INVALID_ROLE',
                message: 'Esta rota é apenas para coaches.'
            });
            
        } catch (error) {
            logger.error('Erro no middleware resolveCoachOrFail', {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
                userRole: req.user?.role
            });
            
            res.status(500).json({
                error: 'Erro ao resolver coach',
                error_code: 'COACH_RESOLUTION_ERROR'
            });
        }
    };
}

module.exports = resolveCoachOrFail;
