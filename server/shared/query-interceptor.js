// Query Interceptor
// RUNTIME-01: Intercepta TODAS as chamadas .query para debug

const logger = require('../utils/logger');
const util = require('util');

// Contador global para rastrear chamadas
let queryCallCount = 0;

/**
 * Cria um wrapper para pool.query ou client.query
 * Intercepta e loga todas as chamadas antes da execução
 */
function wrapQuery(originalQuery, context) {
    return async function interceptedQuery(...args) {
        queryCallCount++;
        const callId = `QUERY-${Date.now()}-${queryCallCount}`;
        
        // Capturar stack trace
        const stack = new Error().stack;
        const stackLines = stack ? stack.split('\n').slice(3, 15).join('\n') : 'Stack não disponível';
        
        // Identificar contexto
        const contextType = context?.constructor?.name || typeof context;
        const contextKeys = context ? Object.keys(context).slice(0, 10) : [];
        
        // Logar antes da execução
        logger.error(`RUNTIME-01: [${callId}] Interceptando chamada .query`, {
            callId,
            contextType,
            contextKeys,
            contextHasQuery: typeof context?.query === 'function',
            contextHasConnect: typeof context?.connect === 'function',
            contextHasRelease: typeof context?.release === 'function',
            queryArgs: args.length > 0 ? args[0]?.substring?.(0, 100) || args[0] : 'sem args',
            stack: stackLines,
            thisType: typeof this,
            thisConstructor: this?.constructor?.name,
            timestamp: new Date().toISOString()
        });
        
        try {
            // Executar query original
            const result = await originalQuery.apply(context, args);
            
            // Logar sucesso
            logger.debug(`RUNTIME-01: [${callId}] Query executada com sucesso`, {
                callId,
                rowCount: result?.rowCount || 0
            });
            
            return result;
        } catch (error) {
            // Logar erro com detalhes completos
            logger.error(`RUNTIME-01: [${callId}] ERRO na execução do query`, {
                callId,
                errorMessage: error.message,
                errorStack: error.stack,
                contextType,
                contextInspect: util.inspect(context, { depth: 3, maxArrayLength: 5 })
            });
            
            throw error;
        }
    };
}

/**
 * Instrumenta um objeto pool ou client
 */
function instrumentQueryable(obj, label) {
    if (!obj || typeof obj.query !== 'function') {
        logger.error(`RUNTIME-01: Tentativa de instrumentar objeto inválido: ${label}`, {
            label,
            objType: typeof obj,
            objIsNull: obj === null,
            objIsUndefined: obj === undefined,
            hasQuery: typeof obj?.query
        });
        return obj;
    }
    
    // Salvar query original
    const originalQuery = obj.query.bind(obj);
    
    // Substituir por wrapper
    obj.query = wrapQuery(originalQuery, obj);
    
    logger.info(`RUNTIME-01: Objeto instrumentado: ${label}`, {
        label,
        objType: typeof obj,
        constructorName: obj.constructor?.name,
        hasConnect: typeof obj.connect === 'function',
        hasRelease: typeof obj.release === 'function'
    });
    
    return obj;
}

module.exports = {
    instrumentQueryable,
    wrapQuery
};
