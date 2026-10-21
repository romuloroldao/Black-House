// ============================================================================
// UUID VALIDATOR - DOMAIN-RESOLUTION-ALUNO-COACH-003
// ============================================================================
// Validação defensiva de UUIDs antes de queries SQL
// ============================================================================

/**
 * Valida se uma string é um UUID válido
 * @param {string} uuid - String a validar
 * @returns {boolean} true se for UUID válido
 */
function isValidUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') {
        return false;
    }
    
    // Regex para UUID v4
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Middleware para validar UUID em parâmetros de rota
 * @param {string} paramName - Nome do parâmetro a validar (ex: 'id')
 * @returns {Function} Middleware Express
 */
function validateUUIDParam(paramName = 'id') {
    return (req, res, next) => {
        const uuid = req.params[paramName];
        
        if (uuid && !isValidUUID(uuid)) {
            return res.status(400).json({
                error: 'ID inválido',
                error_code: 'INVALID_UUID',
                message: `O parâmetro ${paramName} deve ser um UUID válido.`
            });
        }
        
        next();
    };
}

/**
 * Valida UUID e retorna erro se inválido
 * @param {string} uuid - UUID a validar
 * @param {string} fieldName - Nome do campo (para mensagem de erro)
 * @throws {Error} Se UUID for inválido
 */
function assertValidUUID(uuid, fieldName = 'ID') {
    if (!isValidUUID(uuid)) {
        const error = new Error(`${fieldName} inválido`);
        error.code = 'INVALID_UUID';
        error.http_status = 400;
        throw error;
    }
}

module.exports = {
    isValidUUID,
    validateUUIDParam,
    assertValidUUID
};
