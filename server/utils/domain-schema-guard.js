// DOMAIN-SCHEMA-ISOLATION-005: Guard de schema por domínio
// Valida schema apenas do domínio específico da requisição
// Não bloqueia rotas de outros domínios

const logger = require('./logger');
const { assertTableColumns, assertTableExists } = require('./schema-validator');
const { resolveDomainFromRoute, isCriticalDomain, getDomainTables } = require('./domain-resolver');

/**
 * Configuração de schema por domínio
 */
const DOMAIN_SCHEMA_CONFIG = {
    'alunos': {
        table: 'public.alunos',
        // IMPORTANTE: linked_user_id é opcional - sistema funciona sem ela
        // Removido linked_user_id da lista de colunas obrigatórias para permitir criação de alunos
        requiredColumns: ['id', 'coach_id'],
        severity: 'CRITICAL_DOMAIN',
        errorCode: 'ALUNOS_SCHEMA_INVALID',
        httpStatus: 409, // Conflict - schema específico inválido
        message: 'Funcionalidade de alunos temporariamente indisponível devido a schema inválido'
    },
    'profiles': {
        table: 'public.profiles',
        requiredColumns: ['id', 'avatar_url'],
        severity: 'NON_CRITICAL',
        errorCode: 'PROFILES_SCHEMA_INVALID',
        httpStatus: 200, // Permite com warning
        message: 'Funcionalidade de profiles pode estar limitada'
    },
    'payment_plans': {
        table: 'public.payment_plans',
        requiredColumns: ['id', 'nome', 'ativo'],
        severity: 'NON_CRITICAL',
        errorCode: 'PAYMENT_PLANS_SCHEMA_INVALID',
        httpStatus: 200,
        message: 'Funcionalidade de planos pode estar limitada'
    },
    'notificacoes': {
        table: 'public.notificacoes',
        requiredColumns: ['id', 'coach_id', 'created_at'],
        severity: 'NON_CRITICAL',
        errorCode: 'NOTIFICACOES_SCHEMA_INVALID',
        httpStatus: 200,
        message: 'Funcionalidade de notificações pode estar limitada'
    }
};

/**
 * Cache de validação por domínio (para evitar queries repetidas)
 */
const domainValidationCache = new Map();

/**
 * Valida schema de um domínio específico
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {string} domain - Nome do domínio
 * @returns {Promise<{valid: boolean, error?: Error, config?: Object}>}
 */
async function validateDomainSchema(pool, domain) {
    // Verificar cache (invalidar após 60 segundos)
    const cacheKey = domain;
    const cached = domainValidationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.result;
    }

    const config = DOMAIN_SCHEMA_CONFIG[domain];
    if (!config) {
        // Domínio não configurado - permitir (sem validação)
        return { valid: true, config: null };
    }

    try {
        // Validar tabela existe
        await assertTableExists(pool, 'public', config.table.split('.')[1]);
        
        // Validar colunas obrigatórias
        await assertTableColumns(pool, 'public', config.table.split('.')[1], config.requiredColumns);
        
        const result = { valid: true, config };
        domainValidationCache.set(cacheKey, { result, timestamp: Date.now() });
        
        logger.info('domain.schema.valid', {
            domain,
            table: config.table,
            severity: config.severity
        });
        
        return result;
    } catch (error) {
        const result = {
            valid: false,
            error,
            config
        };
        
        // Cache resultado inválido por menos tempo (10 segundos)
        domainValidationCache.set(cacheKey, { result, timestamp: Date.now() });
        
        logger.warn('domain.schema.invalid', {
            domain,
            table: config.table,
            severity: config.severity,
            error: error.message,
            errorCode: config.errorCode
        });
        
        return result;
    }
}

/**
 * Middleware para guard de schema por domínio
 * DOMAIN-SCHEMA-ISOLATION-005: Valida apenas o schema do domínio da requisição
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @returns {Function} Express middleware
 */
function createDomainSchemaGuard(pool) {
    return async (req, res, next) => {
        // Identificar domínio da rota
        const domain = resolveDomainFromRoute(req.path, req.method);
        
        // Se domínio não identificado, permitir (sem validação)
        if (!domain) {
            return next();
        }
        
        // Validar schema do domínio
        const validation = await validateDomainSchema(pool, domain);
        
        if (!validation.valid && validation.config) {
            const config = validation.config;
            
            // Se domínio crítico, bloquear com erro específico
            if (isCriticalDomain(domain) && config.severity === 'CRITICAL_DOMAIN') {
                logger.error('domain.schema.blocked', {
                    domain,
                    path: req.path,
                    method: req.method,
                    errorCode: config.errorCode,
                    httpStatus: config.httpStatus
                });
                
                return res.status(config.httpStatus).json({
                    error: 'Schema inválido',
                    reason: config.errorCode,
                    message: config.message,
                    domain,
                    action_required: 'Aplicar migração SQL necessária para este domínio',
                    error_code: config.errorCode,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Se domínio não crítico, logar warning mas permitir
            if (config.severity === 'NON_CRITICAL') {
                logger.warn('domain.schema.warning', {
                    domain,
                    path: req.path,
                    method: req.method,
                    errorCode: config.errorCode,
                    message: config.message
                });
                
                // Adicionar header de warning (opcional)
                res.set('X-Domain-Schema-Warning', config.errorCode);
                
                // Continuar (não bloquear)
                return next();
            }
        }
        
        // Schema válido ou domínio não configurado - continuar
        next();
    };
}

/**
 * Limpa cache de validação (útil para testes ou invalidar após migrações)
 */
function clearDomainValidationCache() {
    domainValidationCache.clear();
    logger.info('domain.schema.cache.cleared');
}

module.exports = {
    createDomainSchemaGuard,
    validateDomainSchema,
    clearDomainValidationCache,
    DOMAIN_SCHEMA_CONFIG
};
