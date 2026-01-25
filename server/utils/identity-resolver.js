// ============================================================================
// IDENTITY RESOLVER - VPS-NATIVE-ARCH-ALUNOS-COACH-001
// ============================================================================
// Resolução canônica de identidade para alunos e coaches
// PostgreSQL é a única fonte de verdade
// ============================================================================

const logger = require('./logger');

/**
 * Resolve aluno pelo linked_user_id ou falha
 * Regra: alunos sempre resolvem via linked_user_id (obrigatório)
 * 
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {string} userId - ID do usuário autenticado (req.user.id)
 * @returns {Promise<Object>} Dados do aluno
 * @throws {Error} ALUNO_NOT_LINKED se aluno não encontrado
 */
async function resolveAlunoOrFail(pool, userId) {
    const query = `
        SELECT 
            a.id,
            a.nome,
            a.email,
            a.telefone,
            a.coach_id,
            a.user_id,
            a.avatar_url,
            a.created_at,
            u.email as user_email,
            u.created_at as user_created_at
        FROM public.alunos a
        INNER JOIN public.users u ON u.id = a.user_id
        WHERE a.user_id = $1
    `;
    
    try {
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            const error = new Error('Aluno não vinculado a esta conta');
            error.code = 'ALUNO_NOT_LINKED';
            error.http_status = 403;
            throw error;
        }
        
        return result.rows[0];
    } catch (error) {
        // Se já tem código de erro, re-lançar
        if (error.code === 'ALUNO_NOT_LINKED') {
            throw error;
        }
        
        // Logar erro inesperado
        logger.error('Erro ao resolver aluno', {
            userId,
            error: error.message,
            stack: error.stack
        });
        
        throw error;
    }
}

/**
 * Resolve coach do aluno ou falha
 * Regra: aluno sempre pertence a um coach
 * 
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {string} alunoId - ID do aluno
 * @returns {Promise<Object>} Dados do coach
 * @throws {Error} COACH_NOT_FOUND se coach não encontrado
 */
async function resolveCoachByAluno(pool, alunoId) {
    const query = `
        SELECT 
            c.id as coach_id,
            u.id as user_id,
            u.email,
            cp.nome_completo,
            cp.avatar_url,
            cp.bio
        FROM public.alunos a
        INNER JOIN app_auth.users u ON u.id = a.coach_id
        LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
        WHERE a.id = $1
    `;
    
    try {
        const result = await pool.query(query, [alunoId]);
        
        if (result.rows.length === 0) {
            const error = new Error('Coach não encontrado para este aluno');
            error.code = 'COACH_NOT_FOUND';
            error.http_status = 404;
            throw error;
        }
        
        return result.rows[0];
    } catch (error) {
        if (error.code === 'COACH_NOT_FOUND') {
            throw error;
        }
        
        logger.error('Erro ao resolver coach', {
            alunoId,
            error: error.message
        });
        
        throw error;
    }
}

/**
 * Valida que aluno pertence ao coach especificado
 * Regra: aluno só pode interagir com seu próprio coach
 * 
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {string} alunoId - ID do aluno
 * @param {string} coachId - ID do coach a validar
 * @returns {Promise<boolean>} true se pertencer, false caso contrário
 */
async function validateAlunoBelongsToCoach(pool, alunoId, coachId) {
    const query = `
        SELECT 1 
        FROM public.alunos 
        WHERE id = $1 AND coach_id = $2
    `;
    
    try {
        const result = await pool.query(query, [alunoId, coachId]);
        return result.rows.length > 0;
    } catch (error) {
        logger.error('Erro ao validar vínculo aluno-coach', {
            alunoId,
            coachId,
            error: error.message
        });
        return false;
    }
}

/**
 * Resolve coach pelo user_id ou falha
 * 
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {string} userId - ID do usuário autenticado (req.user.id)
 * @returns {Promise<Object>} Dados do coach
 * @throws {Error} COACH_NOT_FOUND se coach não encontrado
 */
async function resolveCoachOrFail(pool, userId) {
    const query = `
        SELECT 
            u.id as user_id,
            u.email,
            cp.id as profile_id,
            cp.nome_completo,
            cp.avatar_url,
            cp.bio,
            cp.especialidades,
            cp.anos_experiencia
        FROM app_auth.users u
        LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
        WHERE u.id = $1
    `;
    
    try {
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            const error = new Error('Usuário não encontrado');
            error.code = 'USER_NOT_FOUND';
            error.http_status = 404;
            throw error;
        }
        
        // Verificar se é coach
        const roleResult = await pool.query(
            'SELECT role FROM public.user_roles WHERE user_id = $1',
            [userId]
        );
        
        const role = roleResult.rows.length > 0 ? roleResult.rows[0].role : 'aluno';
        
        if (role !== 'coach' && role !== 'admin') {
            const error = new Error('Usuário não é um coach');
            error.code = 'NOT_A_COACH';
            error.http_status = 403;
            throw error;
        }
        
        return {
            ...result.rows[0],
            role
        };
    } catch (error) {
        if (error.code) {
            throw error;
        }
        
        logger.error('Erro ao resolver coach', {
            userId,
            error: error.message
        });
        
        throw error;
    }
}

module.exports = {
    resolveAlunoOrFail,
    resolveCoachByAluno,
    validateAlunoBelongsToCoach,
    resolveCoachOrFail
};
