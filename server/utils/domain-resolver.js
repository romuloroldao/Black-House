// DOMAIN-SCHEMA-ISOLATION-005: Resolvedor de domínios para schema guards
// Identifica o domínio funcional de uma rota para validar apenas o schema necessário

/**
 * Mapeamento de rotas para domínios funcionais
 */
const DOMAIN_ROUTES = {
    'alunos': [
        '/rest/v1/alunos',
        '/rest/v1/alunos/link',
        '/rest/v1/alunos/unlink',
        '/rest/v1/dietas', // Dietas dependem de alunos
        '/rest/v1/treinos', // Treinos dependem de alunos
    ],
    'profiles': [
        '/rest/v1/profiles',
        '/rest/v1/user_profiles',
    ],
    'payment_plans': [
        '/rest/v1/payment_plans',
        '/rest/v1/planos',
    ],
    'notificacoes': [
        '/rest/v1/notificacoes',
        '/rest/v1/notifications',
    ],
    'videos': [
        '/rest/v1/videos',
    ],
    'feedbacks': [
        '/rest/v1/feedbacks_alunos',
    ],
    'asaas': [
        '/rest/v1/asaas_payments',
        '/api/payments',
    ],
};

/**
 * Mapeamento de tabelas para domínios (para validação de schema)
 */
const TABLE_DOMAIN_MAP = {
    'alunos': 'alunos',
    'dietas': 'alunos', // Dietas dependem de alunos
    'treinos': 'alunos', // Treinos dependem de alunos
    'profiles': 'profiles',
    'user_profiles': 'profiles',
    'payment_plans': 'payment_plans',
    'planos': 'payment_plans',
    'notificacoes': 'notificacoes',
    'notifications': 'notificacoes',
    'videos': 'videos',
    'feedbacks_alunos': 'feedbacks',
    'asaas_payments': 'asaas',
};

/**
 * Resolve o domínio funcional de uma rota HTTP
 * @param {string} path - Caminho da requisição (ex: '/rest/v1/alunos')
 * @param {string} method - Método HTTP (GET, POST, PATCH, DELETE)
 * @returns {string|null} Nome do domínio ou null se não identificado
 */
function resolveDomainFromRoute(path, method) {
    // Normalizar path (remover query string, trailing slash)
    const normalizedPath = path.split('?')[0].replace(/\/$/, '');
    
    // Verificar rotas específicas primeiro
    for (const [domain, routes] of Object.entries(DOMAIN_ROUTES)) {
        for (const route of routes) {
            if (normalizedPath.startsWith(route) || normalizedPath === route) {
                return domain;
            }
        }
    }
    
    // Verificar padrão /rest/v1/:table
    const tableMatch = normalizedPath.match(/^\/rest\/v1\/([^\/]+)/);
    if (tableMatch) {
        const table = tableMatch[1];
        return TABLE_DOMAIN_MAP[table] || null;
    }
    
    // Verificar padrão /api/:domain
    const apiMatch = normalizedPath.match(/^\/api\/([^\/]+)/);
    if (apiMatch) {
        const apiPath = apiMatch[1];
        // Mapear caminhos de API para domínios
        if (apiPath.startsWith('payments')) return 'asaas';
        return apiPath;
    }
    
    return null;
}

/**
 * Resolve o domínio funcional de uma tabela
 * @param {string} table - Nome da tabela (ex: 'alunos')
 * @returns {string|null} Nome do domínio ou null se não identificado
 */
function resolveDomainFromTable(table) {
    return TABLE_DOMAIN_MAP[table] || null;
}

/**
 * Verifica se um domínio é crítico (requer schema válido para funcionar)
 * @param {string} domain - Nome do domínio
 * @returns {boolean} True se domínio é crítico
 */
function isCriticalDomain(domain) {
    const CRITICAL_DOMAINS = ['alunos']; // Pode ser expandido
    return CRITICAL_DOMAINS.includes(domain);
}

/**
 * Retorna todas as tabelas relacionadas a um domínio
 * @param {string} domain - Nome do domínio
 * @returns {string[]} Array de nomes de tabelas
 */
function getDomainTables(domain) {
    const tables = [];
    for (const [table, tableDomain] of Object.entries(TABLE_DOMAIN_MAP)) {
        if (tableDomain === domain) {
            tables.push(table);
        }
    }
    return tables;
}

module.exports = {
    resolveDomainFromRoute,
    resolveDomainFromTable,
    isCriticalDomain,
    getDomainTables,
    DOMAIN_ROUTES,
    TABLE_DOMAIN_MAP
};
