// ============================================================================
// CORS ASSERT - CORS-SINGLE-SOURCE-OF-TRUTH-001
// ============================================================================
// Assert automático de CORS no boot
// Garante que CORS está configurado corretamente
// ============================================================================

const logger = require('./logger');

/**
 * Assert que CORS está configurado corretamente
 * @param {Express} app - Aplicação Express
 * @returns {boolean} true se CORS está correto
 */
function assertCORSConfig(app) {
    try {
        // Verificar se cors está configurado
        const middleware = app._router?.stack || [];
        const corsMiddleware = middleware.find(m => 
            m.name === 'cors' || 
            (m.handle && m.handle.name === 'cors') ||
            (m.handle && m.handle.toString().includes('Access-Control-Allow-Origin'))
        );
        
        if (!corsMiddleware) {
            logger.warn('CORS-ASSERT: Middleware CORS não encontrado');
            return false;
        }
        
        logger.info('CORS-ASSERT: CORS middleware encontrado', {
            position: middleware.indexOf(corsMiddleware),
            total_middlewares: middleware.length
        });
        
        // Verificar que não há múltiplos middlewares CORS
        const corsMiddlewares = middleware.filter(m => 
            m.name === 'cors' || 
            (m.handle && m.handle.name === 'cors')
        );
        
        if (corsMiddlewares.length > 1) {
            logger.error('CORS-ASSERT: Múltiplos middlewares CORS encontrados', {
                count: corsMiddlewares.length
            });
            return false;
        }
        
        logger.info('CORS-ASSERT: CORS configurado corretamente', {
            single_middleware: true,
            position: middleware.indexOf(corsMiddleware)
        });
        
        return true;
    } catch (error) {
        logger.error('CORS-ASSERT: Erro ao verificar CORS', {
            error: error.message,
            stack: error.stack
        });
        return false;
    }
}

/**
 * Validar configuração de CORS
 * @param {Object} corsConfig - Configuração de CORS
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateCORSConfig(corsConfig) {
    const errors = [];
    
    if (!corsConfig) {
        errors.push('CORS config não definido');
        return { valid: false, errors };
    }
    
    // Verificar que credentials não está com wildcard
    if (corsConfig.credentials === true) {
        if (corsConfig.origin === '*' || (typeof corsConfig.origin === 'function' && corsConfig.origin.toString().includes('*'))) {
            errors.push('Wildcard origin não permitido com credentials=true');
        }
    }
    
    // Verificar methods
    if (!Array.isArray(corsConfig.methods)) {
        errors.push('Methods deve ser um array');
    }
    
    // Verificar allowedHeaders
    if (!Array.isArray(corsConfig.allowedHeaders)) {
        errors.push('allowedHeaders deve ser um array');
    }
    
    // Verificar optionsSuccessStatus
    if (corsConfig.optionsSuccessStatus !== 204) {
        errors.push('optionsSuccessStatus deve ser 204');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    assertCORSConfig,
    validateCORSConfig
};
