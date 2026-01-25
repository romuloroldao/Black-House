// ============================================================================
// MIDDLEWARE: validateRole
// ============================================================================
// DESIGN-GUARD-RAILS-ROLE-ACCESS-003
// Valida explicitamente que o role do usuário é permitido para a rota
// ============================================================================

const logger = require('../utils/logger');

/**
 * Middleware para validar role explicitamente
 * 
 * @param {string[]} allowedRoles - Array de roles permitidos (ex: ['aluno'], ['coach'], ['aluno', 'coach'])
 * @returns {Function} Middleware Express
 * 
 * Regras:
 * - Valida que req.user.role está em allowedRoles
 * - Retorna 403 com ROLE_FORBIDDEN se role não permitido
 * - Frontend incorreto não quebra backend
 */
function validateRole(allowedRoles) {
    return (req, res, next) => {
        try {
            const userRole = req.user?.role;
            
            if (!userRole) {
                return res.status(401).json({
                    error: 'Não autenticado',
                    error_code: 'UNAUTHENTICATED',
                    message: 'Token de autenticação inválido ou ausente.'
                });
            }
            
            if (!allowedRoles.includes(userRole)) {
                logger.warn('DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Role não permitido', {
                    user_id: req.user?.id,
                    user_role: userRole,
                    allowed_roles: allowedRoles,
                    path: req.path,
                    method: req.method
                });
                
                return res.status(403).json({
                    error: 'Acesso negado',
                    error_code: 'ROLE_FORBIDDEN',
                    message: `Esta rota é apenas para: ${allowedRoles.join(', ')}. Seu role: ${userRole}`,
                    allowed_roles: allowedRoles,
                    your_role: userRole
                });
            }
            
            next();
        } catch (error) {
            logger.error('Erro no middleware validateRole', {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
                userRole: req.user?.role
            });
            
            res.status(500).json({
                error: 'Erro ao validar role',
                error_code: 'ROLE_VALIDATION_ERROR'
            });
        }
    };
}

module.exports = validateRole;
