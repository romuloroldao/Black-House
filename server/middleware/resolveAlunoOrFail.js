// ============================================================================
// MIDDLEWARE: resolveAlunoOrFail
// ============================================================================

const logger = require('../utils/logger');
const { queryAlunoRowsFullForUser } = require('../utils/aluno-resolve-by-user');
const {
    operacionalBlockPayload,
    financialBlockPayload,
    normalizeAcesso,
} = require('../utils/aluno-platform-access');

/**
 * Middleware para resolver aluno canônico
 *
 * Regras:
 * - Se role == 'aluno' → resolve aluno via linked_user_id (canônico)
 * - Se role == 'coach' → exige aluno_id válido e vinculado ao coach
 * - Caso contrário → 403
 *
 * Opções:
 * - checkPayment: se true, bloqueia aluno inadimplente (OVERDUE / PENDING_AFTER_DUE_DATE)
 *
 * Injeta req.aluno no request
 */
function resolveAlunoOrFail(pool, options = {}) {
    const checkPayment = options.checkPayment === true;

    function withCanonicalUserId(row) {
        if (!row) return row;
        const link = row.linked_user_id != null ? row.linked_user_id : row.user_id;
        return { ...row, user_id: link };
    }

    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;

            if (userRole !== 'aluno' && userRole !== 'coach' && userRole !== 'admin') {
                return res.status(403).json({
                    error: 'Acesso negado',
                    error_code: 'ROLE_FORBIDDEN',
                    message: 'Esta rota requer role "aluno". Seu role: ' + userRole,
                });
            }

            if (userRole === 'aluno') {
                const rows = await queryAlunoRowsFullForUser(pool, userId);

                if (rows.length === 0) {
                    return res.status(403).json({
                        error: 'Aluno não vinculado',
                        error_code: 'ALUNO_NOT_LINKED',
                        message:
                            'Seu perfil não está vinculado a um aluno. Entre em contato com seu coach.',
                    });
                }

                const aluno = withCanonicalUserId(rows[0]);
                const acesso = normalizeAcesso(aluno.acesso_operacional);
                req.user.acesso_operacional = acesso;
                req.user.acesso_operacional_em = aluno.acesso_operacional_em ?? null;

                const opBlock = operacionalBlockPayload(acesso);
                if (opBlock) {
                    logger.warn('access.denied.operacional', {
                        userId,
                        acesso,
                        path: req.path,
                        error_code: opBlock.error_code,
                    });
                    return res.status(403).json({
                        ...opBlock,
                        acesso_operacional: acesso,
                    });
                }

                if (checkPayment) {
                    const finBlock = financialBlockPayload(req.user.payment_status);
                    if (finBlock) {
                        logger.warn('access.denied.financial', {
                            userId,
                            payment_status: req.user.payment_status,
                            path: req.path,
                        });
                        return res.status(403).json(finBlock);
                    }
                }

                req.aluno = aluno;
                return next();
            }

            if (userRole === 'coach') {
                const { aluno_id } = req.body || req.query;

                if (aluno_id) {
                    const alunoResult = await pool.query(
                        `SELECT a.* FROM public.alunos a WHERE a.id = $1 AND a.coach_id = $2`,
                        [aluno_id, userId],
                    );

                    if (alunoResult.rows.length === 0) {
                        return res.status(403).json({
                            error: 'Aluno não encontrado ou não pertence a este coach',
                            error_code: 'ALUNO_NOT_BELONGS_TO_COACH',
                        });
                    }

                    req.aluno = withCanonicalUserId(alunoResult.rows[0]);
                }

                return next();
            }

            if (userRole === 'admin') {
                const { aluno_id } = req.body || req.query;

                if (aluno_id) {
                    const alunoResult = await pool.query(
                        'SELECT * FROM public.alunos WHERE id = $1',
                        [aluno_id],
                    );

                    if (alunoResult.rows.length > 0) {
                        req.aluno = withCanonicalUserId(alunoResult.rows[0]);
                    }
                }

                return next();
            }

            return res.status(403).json({
                error: 'Acesso negado',
                error_code: 'INVALID_ROLE',
            });
        } catch (error) {
            logger.error('Erro no middleware resolveAlunoOrFail', {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
                userRole: req.user?.role,
            });

            res.status(500).json({
                error: 'Erro ao resolver aluno',
                error_code: 'ALUNO_RESOLUTION_ERROR',
            });
        }
    };
}

module.exports = resolveAlunoOrFail;
