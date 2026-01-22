// Database Guards
// Helpers para validação fail-fast de objetos queryable

const logger = require('../utils/logger');

/**
 * Valida se um objeto é queryable (tem método .query)
 * Lança erro claro com nome do repository, método e stack trace
 * 
 * @param {any} obj - Objeto a validar
 * @param {string} repositoryName - Nome do repository (ex: 'StudentRepository.db')
 * @param {string} methodName - Nome do método onde está sendo validado (ex: 'constructor', 'create', 'update', 'find')
 * @throws {Error} Se obj for null/undefined ou não tiver método query
 */
function assertQueryable(obj, repositoryName, methodName) {
    // Capturar stack trace atual (removendo esta função e a chamada)
    const stack = new Error().stack;
    const stackLines = stack ? stack.split('\n').slice(3).join('\n') : 'Stack trace não disponível';
    
    if (obj === null || obj === undefined) {
        const error = new Error(
            `STEP-15: ${repositoryName} é ${obj === null ? 'null' : 'undefined'} no ${methodName}()`
        );
        error.stack = `Error: ${error.message}\n${stackLines}`;
        
        logger.error(error.message, {
            repositoryName,
            methodName,
            objType: typeof obj,
            objIsNull: obj === null,
            objIsUndefined: obj === undefined,
            stack: stackLines
        });
        
        throw error;
    }
    
    if (typeof obj.query !== 'function') {
        const error = new Error(
            `STEP-15: ${repositoryName}.query não é função no ${methodName}()`
        );
        error.stack = `Error: ${error.message}\n${stackLines}`;
        
        logger.error(error.message, {
            repositoryName,
            methodName,
            objType: typeof obj,
            hasQuery: typeof obj.query,
            objKeys: Object.keys(obj).slice(0, 10),
            stack: stackLines
        });
        
        throw error;
    }
    
    logger.debug(`STEP-15: ${repositoryName} validado no ${methodName}()`, {
        repositoryName,
        methodName,
        objType: typeof obj,
        hasQuery: true
    });
}

module.exports = {
    assertQueryable
};
