// INFRA-03: BOOT_ID para garantir que não há cache de require
// IMPORTANTE: Carregar dotenv ANTES de qualquer outra coisa
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BOOT_ID = `import-debug-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(2, 15)}`;
console.log(`🔥 INFRA-03: BOOT_ID=${BOOT_ID}`);
console.log(`🔥 INFRA-04: process.cwd()=${process.cwd()}`);
console.log(`🔥 INFRA-04: __filename=${__filename}`);
console.log(`🔥 INFRA-04: __dirname=${__dirname}`);
console.log(`🔥 DOTENV: AI_PROVIDER=${process.env.AI_PROVIDER || 'não configurado'}`);

const express = require('express');
const http = require('http');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const multer = require('multer');
const fs = require('fs');
const { parseStudentPDF } = require('./parse-pdf-local');
const ImportController = require('./controllers/import.controller');
const WebSocketService = require('./services/websocket.service');
const NotificationService = require('./services/notification.service');
const AsaasService = require('./services/asaas.service');
const JobsRunner = require('./jobs');
const createWebhookRouter = require('./routes/webhooks');
const createHealthRouter = require('./routes/health');
const { authLimiter, apiLimiter, webhookLimiter, uploadLimiter } = require('./middleware/rate-limiter');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const requestLogger = require('./middleware/request-logger');
const logger = require('./utils/logger');
const SecretsValidator = require('./utils/secrets-validator');
const GracefulShutdown = require('./utils/graceful-shutdown');
const { assertDatabaseSchema, assertGlobalSchema } = require('./utils/schema-validator');
const { extractDatabaseIdentity } = require('./utils/db-identity');
const { createDomainSchemaGuard } = require('./utils/domain-schema-guard');
const { assertCanonicalSchema } = require('./utils/canonical-schema-validator');
// dotenv já foi carregado no topo do arquivo

// INFRA-03: Logar BOOT_ID no logger também
logger.info('🔥 INFRA-03: Servidor iniciando', {
    BOOT_ID,
    processCwd: process.cwd(),
    __filename,
    __dirname,
    nodeVersion: process.version,
    pid: process.pid
});

const app = express();
const httpServer = http.createServer(app);

// Validar secrets na inicialização
try {
    SecretsValidator.validate();
} catch (error) {
    console.error('❌ Erro na validação de secrets:', error.message);
    process.exit(1);
}

// Verificar configuração de IA (não bloqueia inicialização se desabilitada)
const aiProviderManager = require('./services/ai');
try {
    const aiInfo = aiProviderManager.getProviderInfo();
    if (aiInfo.enabled) {
        logger.info('✅ AI Provider configurado', {
            provider: aiInfo.provider,
            model: aiInfo.model
        });
    } else {
        logger.warn('⚠️ AI Provider não configurado - importação de PDF desabilitada');
    }
} catch (error) {
    logger.error('❌ Erro ao verificar configuração de IA', {
        error: error.message
    });
    // Não bloqueia inicialização - IA fica desabilitada
}

// Adicionar logger ao app
app.set('logger', logger);

// Middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    }
}));
// ============================================================================
// CORS MIDDLEWARE - CORS-SINGLE-SOURCE-OF-TRUTH-001
// ============================================================================
// Single source of truth para CORS
// Configuração única e centralizada
// Nunca setar CORS em múltiplas camadas
// ============================================================================
const cors = require('cors');
const corsConfig = require('./config/cors');
const { validateCORSConfig } = require('./utils/cors-assert');

// Validar configuração de CORS antes de aplicar
const corsValidation = validateCORSConfig(corsConfig);
if (!corsValidation.valid) {
    logger.error('CORS-ASSERT: Configuração de CORS inválida', {
        errors: corsValidation.errors
    });
    throw new Error(`CORS config inválido: ${corsValidation.errors.join(', ')}`);
}

// Aplicar CORS antes de qualquer rota
app.use(cors(corsConfig));

// Garantir que OPTIONS sempre responde 204
app.options('*', cors(corsConfig));

logger.info('CORS configurado', {
    origin: 'https://blackhouse.app.br',
    methods: corsConfig.methods,
    credentials: corsConfig.credentials,
    optionsSuccessStatus: corsConfig.optionsSuccessStatus
});

// ============================================================================
// MIDDLEWARES GLOBAIS
// ============================================================================
app.use(express.json({ limit: '10mb' })); // Limitar tamanho do JSON
app.use(requestLogger); // Log de requisições

// Pool de conexão PostgreSQL com configuração explícita
// STEP-01: Log de configuração do banco antes de criar Pool
// DB-IDENTITY-001: Extrair identidade do banco (sem password) para validação
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'blackhouse_db',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD
};

const dbIdentity = extractDatabaseIdentity(dbConfig);
logger.info('STEP-01: Configurando Pool PostgreSQL', {
    ...dbIdentity,
    note: 'Identidade do banco configurada (password não logado por segurança)'
});

const pool = new Pool({
    ...dbConfig,
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000, // 30 segundos
    query_timeout: 30000
});

// RUNTIME-01: Instrumentar pool para interceptar todas as chamadas .query
const { instrumentQueryable } = require('./shared/query-interceptor');
instrumentQueryable(pool, 'pool');
logger.info('RUNTIME-01: Pool instrumentado para interceptar .query');

// STEP-02: Validar Pool após criação
if (!pool || typeof pool.query !== 'function') {
    logger.error('STEP-02: Pool não inicializado corretamente', {
        poolType: typeof pool,
        hasQuery: typeof pool?.query
    });
    process.exit(1);
}

logger.info('STEP-02: Pool inicializado com sucesso', {
    poolType: typeof pool,
    hasQuery: typeof pool.query === 'function',
    hasConnect: typeof pool.connect === 'function'
});

// SCHEMA-03: Validação de schema no boot
// DOMAIN-SCHEMA-ISOLATION-005: Separar validação global (auth) de validação de domínio (alunos)
// Schema global: necessário para sistema funcionar (auth)
// Schema de domínio: validado em runtime por domainSchemaGuard

let globalSchemaValid = false;
let globalSchemaError = null;
let domainSchemaValid = false;
let domainSchemaError = null;

(async () => {
    // Validação global (necessário para auth funcionar)
    try {
        logger.info('SCHEMA-03: Iniciando validação de schema global (auth)...');
        await assertGlobalSchema(pool);
        globalSchemaValid = true;
        logger.info('SCHEMA-03: Validação de schema global concluída - auth disponível');
    } catch (error) {
        globalSchemaValid = false;
        globalSchemaError = error;
        logger.error('SCHEMA-03: ERRO CRÍTICO - Schema global inválido - Auth bloqueado', {
            error: error.message,
            stack: error.stack,
            mode: 'BLOCKED'
        });
        console.error('❌ SCHEMA-03: Falha ao validar schema global (auth)');
        console.error('❌ Erro:', error.message);
        console.error('❌ Auth será bloqueado até schema global ser corrigido');
    }

    // Validação de domínio (alunos) - não bloqueia sistema
    try {
        logger.info('SCHEMA-03: Iniciando validação de schema de domínio (alunos)...');
        // DB-IDENTITY-001: Passar dbConfig para validação de identidade do banco
        await assertDatabaseSchema(pool, dbConfig);
        domainSchemaValid = true;
        logger.info('SCHEMA-03: Validação de schema de domínio concluída');
    } catch (error) {
        domainSchemaValid = false;
        domainSchemaError = error;
        logger.warn('SCHEMA-03: Schema de domínio inválido - Apenas domínio alunos afetado', {
            error: error.message,
            code: error.code,
            database: error.database,
            schema: error.schema,
            missing_column: error.missing_column,
            mode: 'DEGRADED_DOMAIN'
        });
        
        // DB-IDENTITY-001: Mensagem de erro já inclui instruções detalhadas
        if (error.code === 'SCHEMA_LINKED_USER_ID_MISSING') {
            console.warn('⚠️ SCHEMA-03: Schema de domínio "alunos" inválido');
            console.warn('⚠️ Código de erro:', error.code);
            console.warn('⚠️ Apenas funcionalidades de alunos serão afetadas');
        } else {
            console.warn('⚠️ SCHEMA-03: Schema de domínio inválido');
            console.warn('⚠️ Erro:', error.message);
        }
        console.warn('⚠️ Aplicar migração SQL: /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql');
        // NÃO bloquear sistema - apenas domínio específico será afetado
    }
    
    // ============================================================================
    // VALIDAÇÃO DE SCHEMA CANÔNICO - VPS-BACKEND-CANONICAL-ARCH-001
    // ============================================================================
    // AUTH-502-BAD-GATEWAY-FIX-001: Não bloquear servidor se schema canônico inválido
    // Schema canônico é opcional - apenas endpoints canônicos serão afetados
    // Auth deve funcionar mesmo sem schema canônico
    // ============================================================================
    let canonicalSchemaValid = false;
    let canonicalSchemaError = null;
    
    try {
        logger.info('CANONICAL-SCHEMA: Iniciando validação de schema canônico...');
        await assertCanonicalSchema(pool);
        canonicalSchemaValid = true;
        logger.info('CANONICAL-SCHEMA: Schema canônico válido');
    } catch (error) {
        canonicalSchemaValid = false;
        canonicalSchemaError = error;
        logger.warn('CANONICAL-SCHEMA: Schema canônico inválido - Apenas endpoints canônicos afetados', {
            error: error.message,
            mode: 'DEGRADED',
            note: 'Auth e outros endpoints continuam funcionando. Aplicar schema_canonico_vps.sql para habilitar endpoints canônicos.'
        });
        console.warn('⚠️ CANONICAL-SCHEMA: Schema canônico inválido');
        console.warn('⚠️ Erro:', error.message);
        console.warn('⚠️ Aplicar schema: /root/schema_canonico_vps.sql');
        console.warn('⚠️ Servidor continuará funcionando - apenas endpoints canônicos estarão desabilitados');
        // NÃO bloquear servidor - apenas endpoints canônicos serão afetados
    }
})();

// Exportar estado de schema para uso em rotas
// DOMAIN-SCHEMA-ISOLATION-005: schemaValid agora é apenas para schema global (auth)
app.set('globalSchemaValid', () => globalSchemaValid);
app.set('globalSchemaError', () => globalSchemaError);
app.set('domainSchemaValid', () => domainSchemaValid);
app.set('domainSchemaError', () => domainSchemaError);

// Compatibilidade com código existente (usar globalSchemaValid)
app.set('schemaValid', () => globalSchemaValid);
app.set('schemaError', () => globalSchemaError);

const JWT_SECRET = process.env.JWT_SECRET;

// Configurar multer para upload de PDFs (memória, sem salvar em disco)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF são aceitos'), false);
        }
    }
});

// Inicializar controller de importação
// STEP-03: Log antes de instanciar controller
logger.info('STEP-03: Instanciando ImportController', {
    poolType: typeof pool,
    poolHasQuery: typeof pool.query === 'function'
});

// RUNTIME-02: Logar antes de criar ImportController
logger.error('RUNTIME-02: Criando ImportController', {
    poolType: typeof pool,
    poolConstructor: pool?.constructor?.name,
    poolHasQuery: typeof pool?.query === 'function',
    poolKeys: Object.keys(pool || {}).slice(0, 15),
    poolInspect: require('util').inspect(pool, { depth: 2, maxArrayLength: 3 })
});

const importController = new ImportController(pool);

// RUNTIME-02: Logar após criar ImportController
logger.error('RUNTIME-02: ImportController criado', {
    importControllerType: typeof importController,
    importControllerConstructor: importController?.constructor?.name,
    importControllerHas_Db: typeof importController?._db !== 'undefined',
    importController_DbType: typeof importController?._db,
    importController_DbConstructor: importController?._db?.constructor?.name,
    importController_DbHasQuery: typeof importController?._db?.query === 'function'
});

logger.info('STEP-03: ImportController instanciado com sucesso');

// =============== WEBSOCKET ===============
let websocketService = null;
let notificationService = null;

if (process.env.ENABLE_WEBSOCKET !== 'false') {
    try {
        websocketService = new WebSocketService(httpServer, pool, JWT_SECRET);
        notificationService = new NotificationService(websocketService, pool);
        logger.info('WebSocket Service inicializado');
    } catch (error) {
        logger.error('Erro ao inicializar WebSocket', { error: error.message });
    }
} else {
    logger.info('WebSocket desabilitado via ENABLE_WEBSOCKET=false');
}

// =============== ASAAS SERVICE ===============
let asaasService = null;

if (process.env.ASAAS_API_KEY) {
    try {
        asaasService = new AsaasService(
            process.env.ASAAS_API_KEY,
            process.env.ASAAS_ENVIRONMENT || 'production'
        );
        logger.info('Asaas Service inicializado');
    } catch (error) {
        logger.error('Erro ao inicializar Asaas Service', { error: error.message });
    }
} else {
    logger.warn('ASAAS_API_KEY não configurada, funcionalidades de pagamento limitadas');
}

// =============== BACKGROUND JOBS ===============
let jobsRunner = null;

if (process.env.ENABLE_JOBS !== 'false' && notificationService) {
    try {
        jobsRunner = new JobsRunner(pool, notificationService, asaasService);
        jobsRunner.start();
        logger.info('Background Jobs inicializados', { jobsCount: jobsRunner.jobs?.length || 0 });
    } catch (error) {
        logger.error('Erro ao inicializar Background Jobs', { error: error.message });
    }
} else {
    logger.info('Background Jobs desabilitados');
}

// =============== WEBHOOKS ===============
if (process.env.ASAAS_WEBHOOK_TOKEN) {
    app.use('/api/webhooks', webhookLimiter, createWebhookRouter(
        pool,
        notificationService,
        process.env.ASAAS_WEBHOOK_TOKEN
    ));
    logger.info('Webhook routes configuradas');
} else {
    logger.warn('ASAAS_WEBHOOK_TOKEN não configurada, webhooks desabilitados');
}

// Inicializar websocketService e notificationService antes de usar
// (já inicializados acima, mas garantir ordem)

// Middleware de autenticação
// RBAC-01: Middleware de autenticação com role e payment_status
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Buscar usuário com role e payment_status
        const userResult = await pool.query(
            `SELECT 
                u.id, 
                u.email, 
                u.created_at,
                COALESCE(ur.role, 'aluno') as role
            FROM app_auth.users u
            LEFT JOIN public.user_roles ur ON ur.user_id = u.id
            WHERE u.id = $1`,
            [decoded.userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }
        
        const user = userResult.rows[0];
        
        // Buscar payment_status para alunos (OVERDUE ou PENDING_AFTER_DUE_DATE)
        let payment_status = null;
        if (user.role === 'aluno') {
            const paymentResult = await pool.query(
                `SELECT 
                    CASE 
                        WHEN status = 'OVERDUE' THEN 'OVERDUE'
                        WHEN status = 'PENDING' AND due_date < CURRENT_DATE THEN 'PENDING_AFTER_DUE_DATE'
                        ELSE 'CURRENT'
                    END as payment_status
                FROM public.asaas_payments 
                WHERE aluno_id IN (
                    SELECT id FROM public.alunos WHERE email = $1
                )
                AND (status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE))
                LIMIT 1`,
                [user.email]
            );
            
            if (paymentResult.rows.length > 0) {
                payment_status = paymentResult.rows[0].payment_status;
            } else {
                payment_status = 'CURRENT';
            }
        }
        
        // Adicionar role e payment_status ao req.user
        req.user = {
            ...user,
            role: user.role,
            payment_status: payment_status
        };
        
        next();
    } catch (error) {
        logger.error('Erro na autenticação', { error: error.message, stack: error.stack });
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// RBAC-02: Middleware de controle de acesso baseado em role
const accessGuard = (allowedRoles = ['coach', 'aluno'], checkPayment = false) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Não autenticado' });
        }
        
        const { role, payment_status } = req.user;
        
        // Verificar role
        if (!allowedRoles.includes(role)) {
            logger.warn('access.denied.role', {
                userId: req.user.id,
                role,
                allowedRoles,
                path: req.path
            });
            return res.status(403).json({ 
                error: 'Acesso negado',
                reason: 'role_not_allowed'
            });
        }
        
        // Verificar payment_status para alunos
        if (checkPayment && role === 'aluno') {
            if (payment_status === 'OVERDUE' || payment_status === 'PENDING_AFTER_DUE_DATE') {
                logger.warn('access.denied.financial', {
                    userId: req.user.id,
                    payment_status,
                    path: req.path
                });
                return res.status(403).json({
                    error: 'Acesso bloqueado',
                    reason: 'payment_overdue',
                    payment_status
                });
            }
        }
        
        logger.info('access.allowed', {
            userId: req.user.id,
            role,
            path: req.path
        });
        
        next();
    };
};

// =============== ROOT ENDPOINT ===============
// DESIGN-API-ROOT-SEMANTIC-011: Resposta semântica para root da API
app.get('/', (req, res) => {
    res.json({
        service: 'blackhouse-api',
        status: 'ok',
        version: '1.0.0',
        docs: 'https://docs.blackhouse.app.br',
        endpoints: {
            health: '/health',
            auth: {
                signup: '/auth/signup',
                login: '/auth/login',
                user: '/auth/user'
            },
            api: '/api/*'
        }
    });
});

// =============== HEALTH CHECKS ===============
// Health checks devem vir antes de rate limiting para monitoramento
// AUTH-HARDENING-001: Passar app para health router para acessar schemaValid
app.use('/health', createHealthRouter(pool, websocketService, jobsRunner, app));

// =============== ROTAS DE AUTH ===============

// Registro (com rate limiting)
app.post('/auth/signup', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // Criar usuário no app_auth
        const result = await pool.query(
            'SELECT app_auth.create_user($1, $2)',
            [email, password]
        );
        
        const userId = result.rows[0].create_user;
        
        // SECURITY-01: Criar automaticamente role "aluno" para todos os novos usuários
        // Por segurança, TODOS os usuários são criados como "aluno" por padrão
        // Se já existir um role (criado por trigger), SUBSTITUIR por 'aluno'
        let userRole = 'aluno'; // Default role
        try {
            // Verificar se já existe um role (pode ter sido criado por trigger com valor errado)
            const existingRole = await pool.query(
                'SELECT role FROM public.user_roles WHERE user_id = $1',
                [userId]
            );
            
            if (existingRole.rows.length > 0) {
                // Se já existe e não é 'aluno', SUBSTITUIR para 'aluno'
                if (existingRole.rows[0].role !== 'aluno') {
                    await pool.query(
                        'UPDATE public.user_roles SET role = $1 WHERE user_id = $2',
                        ['aluno', userId]
                    );
                    logger.warn('SECURITY-01: Role existente substituído para "aluno"', {
                        userId,
                        email,
                        roleAnterior: existingRole.rows[0].role
                    });
                } else {
                    logger.info('SECURITY-01: Role "aluno" já existe para novo usuário', {
                        userId,
                        email
                    });
                }
                userRole = existingRole.rows[0].role === 'aluno' ? 'aluno' : 'aluno';
            } else {
                // Se não existe, criar como 'aluno'
                await pool.query(
                    'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET role = $2',
                    [userId, 'aluno']
                );
                logger.info('SECURITY-01: Role "aluno" criado automaticamente para novo usuário', {
                    userId,
                    email
                });
            }
        } catch (roleError) {
            // Se falhar, tentar criar/atualizar novamente
            logger.error('SECURITY-01: Erro ao garantir role "aluno", tentando novamente', {
                userId,
                email,
                error: roleError.message
            });
            
            // Última tentativa: forçar criação/atualização
            try {
                await pool.query(
                    'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET role = $2',
                    [userId, 'aluno']
                );
                logger.info('SECURITY-01: Role "aluno" criado/atualizado com sucesso na segunda tentativa', {
                    userId,
                    email
                });
            } catch (retryError) {
                logger.error('SECURITY-01: ERRO CRÍTICO - Não foi possível garantir role "aluno"', {
                    userId,
                    email,
                    error: retryError.message
                });
                // Não falhar o signup, mas registrar o erro crítico
            }
        }
        
        // RBAC-01: JWT inclui role e payment_status (CURRENT para novo usuário)
        const token = jwt.sign({ 
            userId,
            role: userRole,
            payment_status: 'CURRENT' // Novo usuário sempre adimplente
        }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ 
            user: { id: userId, email },
            token 
        });
    } catch (error) {
        logger.error('Erro ao criar usuário', {
            email,
            error: error.message,
            code: error.code
        });
        
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// Login (com rate limiting)
// AUTH-502-BAD-GATEWAY-FIX-001: Garantir try/catch completo e retorno sempre JSON
app.post('/auth/login', authLimiter, async (req, res) => {
    // AUTH-502-BAD-GATEWAY-FIX-001: Log estruturado no início
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info('AUTH_LOGIN_REQUEST', {
        request_id: requestId,
        endpoint: '/auth/login',
        has_email: !!req.body?.email,
        timestamp: new Date().toISOString()
    });
    
    try {
        // DOMAIN-SCHEMA-ISOLATION-005: Verificar apenas schema global (auth)
        // NÃO verificar schema de domínios específicos (alunos)
        // Auth não depende de schema de alunos, portanto não deve ser bloqueado
        const isGlobalSchemaValid = app.get('globalSchemaValid')();
        if (!isGlobalSchemaValid) {
            const schemaErr = app.get('globalSchemaError')();
            logger.error('AUTH_BLOCKED_GLOBAL_SCHEMA_INVALID', {
                request_id: requestId,
                boot_id: BOOT_ID,
                error: schemaErr?.message || 'Schema global inválido',
                endpoint: '/auth/login'
            });
            
            return res.status(503).json({
                error: 'Serviço temporariamente indisponível',
                reason: 'GLOBAL_SCHEMA_INVALID',
                message: 'Sistema em manutenção. O schema global necessário para autenticação está inválido.',
                action_required: 'Aguardar aplicação de migração SQL ou contatar suporte',
                error_code: 'AUTH_BLOCKED_GLOBAL_SCHEMA_INVALID',
                timestamp: new Date().toISOString()
            });
        }
        
        // DOMAIN-SCHEMA-ISOLATION-005: Schema de domínio (alunos) não afeta auth
        // Mesmo que schema de alunos esteja inválido, auth continua funcionando

        const { email, password } = req.body;
        
        if (!email || !password) {
            logger.warn('AUTH_LOGIN_MISSING_CREDENTIALS', {
                request_id: requestId,
                has_email: !!email,
                has_password: !!password
            });
            return res.status(400).json({ 
                error: 'Email e senha são obrigatórios',
                error_code: 'MISSING_CREDENTIALS'
            });
        }
        const result = await pool.query(
            'SELECT * FROM app_auth.login($1, $2)',
            [email, password]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        const { user_id } = result.rows[0];
        
        // Buscar role do usuário
        const roleResult = await pool.query(
            'SELECT role FROM public.user_roles WHERE user_id = $1',
            [user_id]
        );
        const role = roleResult.rows.length > 0 ? roleResult.rows[0].role : 'aluno';
        
        // Buscar payment_status para alunos
        let payment_status = 'CURRENT';
        if (role === 'aluno') {
            const userEmailResult = await pool.query(
                'SELECT email FROM app_auth.users WHERE id = $1',
                [user_id]
            );
            
            if (userEmailResult.rows.length > 0) {
                const email = userEmailResult.rows[0].email;
                const paymentResult = await pool.query(
                    `SELECT 
                        CASE 
                            WHEN status = 'OVERDUE' THEN 'OVERDUE'
                            WHEN status = 'PENDING' AND due_date < CURRENT_DATE THEN 'PENDING_AFTER_DUE_DATE'
                            ELSE 'CURRENT'
                        END as payment_status
                    FROM public.asaas_payments 
                    WHERE aluno_id IN (
                        SELECT id FROM public.alunos WHERE email = $1
                    )
                    AND (status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE))
                    LIMIT 1`,
                    [email]
                );
                
                if (paymentResult.rows.length > 0) {
                    payment_status = paymentResult.rows[0].payment_status;
                }
            }
        }
        
        // RBAC-01: JWT inclui role e payment_status
        const token = jwt.sign({ 
            userId: user_id,
            role,
            payment_status
        }, JWT_SECRET, { expiresIn: '7d' });
        
        // Buscar dados do usuário
        const userResult = await pool.query(
            'SELECT id, email, created_at FROM app_auth.users WHERE id = $1',
            [user_id]
        );
        
        logger.info('AUTH_LOGIN_SUCCESS', {
            request_id: requestId,
            user_id: user_id,
            role: role
        });
        
        res.json({ 
            user: userResult.rows[0],
            token,
            role,
            payment_status
        });
    } catch (error) {
        // AUTH-502-BAD-GATEWAY-FIX-001: Sempre retornar JSON, nunca throw
        logger.error('AUTH_LOGIN_ERROR', {
            request_id: requestId,
            error: error.message,
            stack: error.stack,
            endpoint: '/auth/login'
        });
        
        // Retornar 401 para credenciais inválidas, 500 para outros erros
        const statusCode = error.message?.includes('Credenciais') || error.message?.includes('inválid') ? 401 : 500;
        res.status(statusCode).json({ 
            error: error.message || 'Erro ao fazer login',
            error_code: 'LOGIN_ERROR',
            request_id: requestId
        });
    }
});

// Obter usuário atual com role e payment_status
app.get('/auth/user', authenticate, (req, res) => {
    const { id, email, created_at, role, payment_status } = req.user;
    res.json({ 
        user: { 
            id, 
            email, 
            created_at,
            role,
            payment_status
        },
        role,
        payment_status
    });
});

// Endpoint para buscar usuário por ID (usado para vinculação)
app.get('/auth/user-by-id', authenticate, async (req, res) => {
    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return res.status(400).json({ error: 'user_id é obrigatório' });
        }

        const result = await pool.query(
            'SELECT id, email, created_at FROM app_auth.users WHERE id = $1',
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Erro ao buscar usuário por ID', {
            error: error.message,
            user_id: req.query.user_id
        });
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

// Logout (client-side - apenas invalida token no frontend)
app.post('/auth/logout', (req, res) => {
    res.json({ message: 'Logout realizado' });
});

// =============== ROTAS DA API ===============

// DOMAIN-SCHEMA-ISOLATION-005: Guard de schema por domínio
// Valida apenas o schema do domínio específico da requisição
// Não bloqueia rotas de outros domínios quando um domínio tem schema inválido
const domainSchemaGuard = createDomainSchemaGuard(pool);

// =============== ROTAS DA API REST (/api/*) - Substitui /rest/v1/* ===============
// DESIGN-VPS-ONLY-DATABASE-AND-BACKEND-001: Remoção completa do Supabase
// Todas as rotas antigas /rest/v1/* migram para /api/*
// ============================================================================
// ROTAS DA API
// ============================================================================
// VPS-BACKEND-CANONICAL-ARCH-001: Endpoints canônicos
// ============================================================================

// Rotas canônicas (novas)
const createCanonicalApiRouter = require('./routes/api-canonical');
const createCanonicalUploadsRouter = require('./routes/uploads-canonical');

// Rotas existentes (compatibilidade)
const createApiRouter = require('./routes/api');

// Aplicar rotas canônicas primeiro (prioridade)
// VPS-BACKEND-CANONICAL-ARCH-001: Endpoints canônicos
app.use('/api', createCanonicalApiRouter(pool, authenticate));
app.use('/api', createCanonicalUploadsRouter(pool, authenticate));

// Rotas existentes (compatibilidade - outras rotas /api/*)
app.use('/api', createApiRouter(pool, authenticate, domainSchemaGuard));

// ============================================================================
// ROTAS /rest/v1/* - DEPRECATED (DESIGN-SUPABASE-PURGE-GLOBAL-002)
// ============================================================================
// ⚠️ ATENÇÃO: Estas rotas estão DEPRECATED e serão removidas em versão futura
// Use rotas semânticas /api/* ao invés de /rest/v1/*
// Sintaxe PostgREST (select=, eq=, neq=) é FORBIDDEN
// ============================================================================

// Proxy para queries do banco (simplificado) - DEPRECATED
app.post('/rest/v1/rpc/:function', authenticate, domainSchemaGuard, async (req, res) => {
    console.warn('⚠️ DEPRECATED: /rest/v1/rpc/:function está deprecated. Use rotas semânticas /api/*');
    const { function: funcName } = req.params;
    const params = req.body;
    
    try {
        // Construir chamada de função
        const paramKeys = Object.keys(params);
        const paramValues = Object.values(params);
        const placeholders = paramKeys.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `SELECT * FROM public.${funcName}(${placeholders})`;
        const result = await pool.query(query, paramValues);
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Query genérica para tabelas - DEPRECATED
// DESIGN-SUPABASE-PURGE-GLOBAL-002: Sintaxe PostgREST é FORBIDDEN
app.get('/rest/v1/:table', authenticate, domainSchemaGuard, async (req, res) => {
    console.warn(`⚠️ DEPRECATED: GET /rest/v1/${req.params.table} está deprecated. Use rotas semânticas /api/*`);
    console.warn('⚠️ Sintaxe PostgREST (select=, eq=, neq=) é FORBIDDEN. Migre para rotas semânticas.');
    
    const { table } = req.params;
    const { select, order, limit, offset } = req.query;
    
    try {
        let query = `SELECT ${select || '*'} FROM public.${table}`;
        const queryParams = [];
        let paramIndex = 1;
        
        // Processar filtros (formato: campo.operador=valor)
        const filters = [];
        for (const [key, value] of Object.entries(req.query)) {
            if (key.includes('.') && !['select', 'order', 'limit', 'offset'].includes(key)) {
                const [column, operator] = key.split('.');
                
                switch (operator) {
                    case 'eq':
                        filters.push(`${column} = $${paramIndex}`);
                        queryParams.push(value);
                        paramIndex++;
                        break;
                    case 'neq':
                        filters.push(`${column} != $${paramIndex}`);
                        queryParams.push(value);
                        paramIndex++;
                        break;
                    case 'gt':
                        filters.push(`${column} > $${paramIndex}`);
                        queryParams.push(value);
                        paramIndex++;
                        break;
                    case 'gte':
                        filters.push(`${column} >= $${paramIndex}`);
                        queryParams.push(value);
                        paramIndex++;
                        break;
                    case 'lt':
                        filters.push(`${column} < $${paramIndex}`);
                        queryParams.push(value);
                        paramIndex++;
                        break;
                    case 'lte':
                        filters.push(`${column} <= $${paramIndex}`);
                        queryParams.push(value);
                        paramIndex++;
                        break;
                    case 'like':
                        filters.push(`${column} LIKE $${paramIndex}`);
                        queryParams.push(`%${value}%`);
                        paramIndex++;
                        break;
                    case 'ilike':
                        filters.push(`${column} ILIKE $${paramIndex}`);
                        queryParams.push(`%${value}%`);
                        paramIndex++;
                        break;
                    case 'in':
                        const values = value.split(',');
                        const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(', ');
                        filters.push(`${column} IN (${placeholders})`);
                        queryParams.push(...values);
                        paramIndex += values.length;
                        break;
                    case 'is':
                        if (value === 'null') {
                            filters.push(`${column} IS NULL`);
                        } else if (value === 'not.null') {
                            filters.push(`${column} IS NOT NULL`);
                        }
                        break;
                }
            }
        }
        
        if (filters.length > 0) {
            query += ` WHERE ${filters.join(' AND ')}`;
        }
        
        if (order) {
            const [column, direction] = order.split('.');
            query += ` ORDER BY ${column} ${direction || 'ASC'}`;
        }
        
        if (limit) {
            query += ` LIMIT $${paramIndex}`;
            queryParams.push(parseInt(limit));
            paramIndex++;
        }
        
        if (offset) {
            query += ` OFFSET $${paramIndex}`;
            queryParams.push(parseInt(offset));
        }
        
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro na query:', error);
        res.status(500).json({ error: error.message });
    }
});

// Insert - DEPRECATED
// DESIGN-SUPABASE-PURGE-GLOBAL-002: Rotas genéricas são FORBIDDEN
app.post('/rest/v1/:table', authenticate, domainSchemaGuard, async (req, res) => {
    console.warn(`⚠️ DEPRECATED: POST /rest/v1/${req.params.table} está deprecated. Use rotas semânticas /api/*`);
    const { table } = req.params;
    const data = req.body;
    const userId = req.user?.id; // ID do usuário autenticado
    
    // Declarar variáveis no escopo da função para uso no catch
    let filteredData = {};
    let columns = [];
    let values = [];
    
    try {
        // Filtrar campos que não devem ser inseridos (id, created_at têm defaults)
        const fieldsToExclude = ['id', 'created_at', 'updated_at'];
        
        // COACH-01: Sempre usar userId autenticado para coach_id em todas as tabelas que têm esse campo
        // Por segurança, sempre substituir coach_id pelo userId do usuário autenticado
        // Nota: alunos_treinos NÃO tem coluna coach_id (ver migração 20251016132724)
        const tablesWithCoachId = ['feedbacks_alunos', 'alunos', 'fotos_alunos', 'treinos', 'videos', 'lives', 
                                    'payment_plans', 'financial_exceptions', 'expenses', 'recurring_charges_config'];
        
        // COACH-01: Apenas processar coach_id se o campo estiver presente nos dados OU se a tabela requer
        if ('coach_id' in data) {
            // Se coach_id foi fornecido, sempre substituir por userId autenticado
            const originalCoachId = data.coach_id;
            data.coach_id = userId;
            
            if (originalCoachId !== userId && 
                originalCoachId !== '00000000-0000-0000-0000-000000000000' &&
                originalCoachId !== null && 
                originalCoachId !== undefined) {
                logger.warn('COACH-01: coach_id fornecido substituído por userId autenticado', {
                    table,
                    originalCoachId,
                    userId
                });
            } else {
                logger.debug('COACH-01: coach_id definido para userId autenticado', {
                    table,
                    userId
                });
            }
        } else if (tablesWithCoachId.includes(table)) {
            // Se a tabela requer coach_id mas não foi fornecido, adicionar
            // Mas apenas se a tabela realmente tem a coluna (não adicionar para alunos_treinos)
            data.coach_id = userId;
            logger.debug('COACH-01: coach_id adicionado (userId autenticado)', {
                table,
                userId
            });
        }
        
        filteredData = Object.entries(data)
            .filter(([key]) => {
                // FILTER-01: Filtrar campos que não existem na tabela
                // Remover coach_id se a tabela não tem essa coluna
                if (key === 'coach_id' && !tablesWithCoachId.includes(table)) {
                    logger.debug('FILTER-01: Removendo coach_id de tabela que não tem essa coluna', {
                        table,
                        key
                    });
                    return false; // Remover coach_id
                }
                return !fieldsToExclude.includes(key);
            })
            .reduce((acc, [key, value]) => {
                // Tratar null/undefined corretamente
                if (value === undefined || value === null) {
                    // Para campos opcionais, permitir null; para obrigatórios, omitir se null
                    if (key === 'alimento_id' || key === 'dia_semana') {
                        acc[key] = null; // Campos opcionais podem ser null
                    }
                    return acc; // Omitir campos undefined
                }
                
                // Converter strings vazias para null em campos opcionais
                if (value === '') {
                    if (key.includes('_id') || key.includes('dia_semana')) {
                        acc[key] = null; // Campos opcionais
                    } else if (key.includes('quantidade')) {
                        // quantidade é obrigatório, não pode ser vazio
                        return acc; // Omitir se vazio (vai gerar erro de validação do banco)
                    } else {
                        return acc; // Omitir strings vazias em outros campos
                    }
                } 
                // Converter string "0" para número 0 em campos numéricos
                else if (value === '0' && key.includes('quantidade')) {
                    acc[key] = 0;
                }
                // Converter strings numéricas para números em quantidade
                else if (typeof value === 'string' && key === 'quantidade' && value.trim() !== '') {
                    const numValue = parseFloat(value.replace(',', '.'));
                    if (isNaN(numValue)) {
                        return acc; // Omitir se não for número válido
                    }
                    acc[key] = numValue;
                }
                // JSON-01: Converter objetos/arrays para JSON string para campos JSONB/JSON
                // PostgreSQL aceita objetos JavaScript diretamente via pg, mas vamos serializar para garantir
                // Não aplicar em campos DATE (data_expiracao, data_inicio, etc.) - apenas em campos JSONB reais
                // Campos DATE comuns: data_expiracao, data_inicio, data_vencimento, data_pagamento, data_agendamento
                const isDateField = key.startsWith('data_') || key === 'data_inicio' || key === 'data_expiracao' || 
                                    key === 'data_vencimento' || key === 'data_pagamento' || key === 'data_agendamento' ||
                                    key === 'created_at' || key === 'updated_at';
                const isJsonbField = key === 'exercicios' || (key.includes('json') && !isDateField);
                
                if (isJsonbField && !isDateField) {
                    // Se é objeto ou array, serializar para JSON string
                    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                        try {
                            // Para JSONB, pg aceita objetos JavaScript diretamente, mas serializar para garantir
                            acc[key] = JSON.stringify(value);
                            logger.debug('JSON-01: Campo JSON serializado', { 
                                key, 
                                type: Array.isArray(value) ? 'array' : 'object',
                                valuePreview: JSON.stringify(value).substring(0, 100)
                            });
                        } catch (jsonError) {
                            logger.warn('JSON-01: Erro ao serializar JSON, mantendo original', { key, error: jsonError.message });
                            acc[key] = value; // Manter original se falhar (pg pode aceitar objeto direto)
                        }
                    } else if (typeof value === 'string') {
                        // Se já é string, verificar se é JSON válido
                        try {
                            JSON.parse(value); // Validar se é JSON válido
                            acc[key] = value; // Já é JSON válido
                        } catch {
                            // Se não é JSON válido, tentar usar como está (pode ser campo text)
                            acc[key] = value;
                        }
                    } else {
                        // Para outros tipos (null, undefined, numbers), manter como está
                        acc[key] = value;
                    }
                }
                // Validar UUIDs
                else if (key.includes('_id') && typeof value === 'string') {
                    // Validar formato UUID básico
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (uuidRegex.test(value)) {
                        acc[key] = value;
                    } else {
                        logger.warn('UUID inválido ignorado', { key, value });
                        return acc; // Omitir UUID inválido
                    }
                }
                else {
                    acc[key] = value;
                }
                return acc;
            }, {});
        
        if (Object.keys(filteredData).length === 0) {
            return res.status(400).json({ error: 'Nenhum campo válido para inserir' });
        }
        
        columns = Object.keys(filteredData);
        values = Object.values(filteredData);
        
        // JSON-01: Para campos JSONB, usar cast explícito no SQL se necessário
        // PostgreSQL aceita objetos JavaScript diretamente via pg, mas vamos garantir
        // Não aplicar cast em campos DATE (data_expiracao, data_inicio, etc.)
        const placeholders = columns.map((col, i) => {
            // Verificar se é campo DATE
            const isDateField = col.startsWith('data_') || col === 'data_inicio' || col === 'data_expiracao' || 
                                col === 'data_vencimento' || col === 'data_pagamento' || col === 'data_agendamento' ||
                                col === 'created_at' || col === 'updated_at';
            // Se é campo JSONB real (exercicios ou campos com json no nome, mas não DATE)
            const isJsonbField = col === 'exercicios' || (col.includes('json') && !isDateField);
            
            if (isJsonbField && !isDateField) {
                // Usar cast ::jsonb para garantir conversão correta
                // pg aceita objetos JS diretamente, mas cast garante compatibilidade
                return `$${i + 1}::jsonb`;
            }
            return `$${i + 1}`;
        }).join(', ');
        
        const query = `
            INSERT INTO public.${table} (${columns.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;
        
        // Log para debug (temporariamente em produção para diagnosticar)
        logger.info('Insert query', { 
            table, 
            columns: columns.join(', '),
            valuesCount: values.length,
            sampleValues: values.slice(0, 3) // Primeiros 3 valores para debug
        });
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Erro ao inserir registro', {
            table,
            error: error.message,
            stack: error.stack,
            data: JSON.stringify(data),
            filteredData: JSON.stringify(filteredData),
            columns: columns?.join(', ') || 'N/A',
            values: values?.map(v => typeof v === 'string' ? v.substring(0, 50) : v) || 'N/A'
        });
        res.status(500).json({ error: error.message });
    }
});

// Update - DEPRECATED
// DESIGN-SUPABASE-PURGE-GLOBAL-002: Rotas genéricas são FORBIDDEN
app.patch('/rest/v1/:table', authenticate, domainSchemaGuard, async (req, res) => {
    console.warn(`⚠️ DEPRECATED: PATCH /rest/v1/${req.params.table} está deprecated. Use rotas semânticas /api/*`);
    const { table } = req.params;
    const { id, ...data } = req.body;
    
    // Gerar request ID para rastreamento end-to-end
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const actorUserId = req.user?.id;
    
    // SECURITY-01: Validação explícita de ID obrigatório no payload
    // O ID DEVE estar no body, não na query string, para evitar UPDATE sem WHERE
    // Validação ocorre ANTES de qualquer transação (fail-fast)
    if (!id) {
        logger.warn('user_roles.update.blocked_missing_id', {
            requestId,
            table,
            actor_user_id: actorUserId,
            body: JSON.stringify(req.body),
            query: JSON.stringify(req.query)
        });
        return res.status(400).json({ 
            error: 'ID é obrigatório para atualizar',
            hint: 'O campo "id" deve estar presente no body do PATCH request',
            requestId
        });
    }
    
    // Validação de formato UUID (básica)
    // UUID v4 format: 8-4-4-4-12 hexadecimal characters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        logger.warn('user_roles.update.blocked_invalid_id', {
            requestId,
            table,
            id,
            actor_user_id: actorUserId
        });
        return res.status(400).json({ 
            error: 'ID inválido',
            hint: 'O campo "id" deve ser um UUID válido',
            requestId
        });
    }
    
    try {
        // SCHEMA-03: Whitelist explícita para tabela alunos
        // Princípio: Schema do banco é a única fonte de verdade
        // Nunca confiar em Object.keys(body) direto no SQL - sempre validar campos
        const ALUNOS_UPDATE_POLICY = {
            allowedColumns: new Set([
                'nome',
                'email',
                'telefone',
                'data_nascimento',
                'linked_user_id', // Campo crítico para vínculo de usuários
                'peso',
                'altura',
                'idade',
                'objetivo',
                'plano',
                'cpf_cnpj',
                'status'
            ]),
            forbiddenColumns: new Set([
                'id',          // Nunca permitir update de ID
                'created_at',  // Nunca permitir update de timestamp de criação
                'updated_at',  // Atualizado automaticamente por trigger
                'coach_id'     // Protegido - só pode ser alterado por operações específicas
            ]),
            mode: 'explicit-whitelist',
            stripUnknownFields: true,
            rejectIfEmptyAfterFilter: true
        };

        // SCHEMA-03: Aplicar política de update apenas para tabela alunos
        // Para outras tabelas, manter comportamento atual (após validação de schema no boot)
        let sanitizedData = { ...data };
        if (table === 'alunos') {
            const rejectedFields = [];
            const sanitized = {};
            
            for (const key of Object.keys(data)) {
                // Verificar campos proibidos primeiro (mais restritivo)
                if (ALUNOS_UPDATE_POLICY.forbiddenColumns.has(key)) {
                    rejectedFields.push(key);
                    logger.error('alunos.update.rejected_forbidden_field', {
                        requestId,
                        table,
                        id,
                        field: key,
                        reason: 'Campo proibido por política de segurança',
                        forbidden_fields: Array.from(ALUNOS_UPDATE_POLICY.forbiddenColumns),
                        actor_user_id: actorUserId,
                        payload: JSON.stringify(data)
                    });
                } 
                // Verificar campos permitidos (whitelist)
                else if (ALUNOS_UPDATE_POLICY.allowedColumns.has(key)) {
                    sanitized[key] = data[key];
                } 
                // Campos desconhecidos são rejeitados (modo strict)
                else {
                    rejectedFields.push(key);
                    logger.error('alunos.update.rejected_invalid_field', {
                        requestId,
                        table,
                        id,
                        field: key,
                        reason: 'Campo não está na whitelist permitida',
                        allowed_fields: Array.from(ALUNOS_UPDATE_POLICY.allowedColumns),
                        actor_user_id: actorUserId,
                        payload: JSON.stringify(data)
                    });
                }
            }
            
            // Rejeitar se houver campos inválidos ou proibidos
            if (rejectedFields.length > 0) {
                const isForbidden = rejectedFields.some(f => ALUNOS_UPDATE_POLICY.forbiddenColumns.has(f));
                return res.status(400).json({ 
                    error: isForbidden ? 'Campos proibidos' : 'Campos não permitidos',
                    message: `A tabela ${table} não aceita os campos: ${rejectedFields.join(', ')}`,
                    hint: isForbidden 
                        ? `Campos proibidos: ${Array.from(ALUNOS_UPDATE_POLICY.forbiddenColumns).join(', ')}`
                        : `Campos permitidos para alunos: ${Array.from(ALUNOS_UPDATE_POLICY.allowedColumns).join(', ')}`,
                    rejected_fields: rejectedFields,
                    allowed_fields: Array.from(ALUNOS_UPDATE_POLICY.allowedColumns),
                    forbidden_fields: Array.from(ALUNOS_UPDATE_POLICY.forbiddenColumns),
                    error_code: 'SCHEMA_VIOLATION',
                    requestId
                });
            }
            
            // Verificar se ainda há campos após filtrar (stripUnknownFields = true já aplicado acima)
            if (ALUNOS_UPDATE_POLICY.rejectIfEmptyAfterFilter && Object.keys(sanitized).length === 0) {
                return res.status(400).json({ 
                    error: 'Nenhum campo válido para atualizar',
                    hint: 'Todos os campos fornecidos foram rejeitados pela política de update',
                    allowed_fields: Array.from(ALUNOS_UPDATE_POLICY.allowedColumns),
                    requestId
                });
            }
            
            sanitizedData = sanitized;
        }

        const columns = Object.keys(sanitizedData);
        
        // Validação: pelo menos um campo opcional deve estar presente
        if (columns.length === 0) {
            logger.warn('user_roles.update.blocked_no_fields', {
                requestId,
                table,
                id,
                actor_user_id: actorUserId
            });
            return res.status(400).json({ 
                error: 'Nenhum campo para atualizar',
                hint: 'Forneça pelo menos um campo para atualizar (ex: role, status)',
                requestId
            });
        }
        
        // Log ANTES do BEGIN para auditoria completa
        logger.info('user_roles.update.start', {
            requestId,
            table,
            id,
            updated_fields: columns,
            actor_user_id: actorUserId
        });
        
        // Construir query UPDATE com WHERE explícito (nunca UPDATE sem WHERE)
        // NOTA: updated_at é atualizado automaticamente por trigger se a tabela tiver essa coluna
        // Não precisamos atualizar manualmente - o trigger set_updated_at() cuida disso
        // SCHEMA-03: Usar dados sanitizados (com whitelist aplicada para alunos)
        const values = Object.values(sanitizedData);
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        
        const query = `
            UPDATE public.${table}
            SET ${setClause}
            WHERE id = $${values.length + 1}
            RETURNING *
        `;
        
        // Executar UPDATE dentro de transação implícita do pool
        // Se não encontrar registro, result.rows.length será 0
        const result = await pool.query(query, [...values, id]);
        
        if (result.rows.length === 0) {
            logger.warn('user_roles.update.not_found', {
                requestId,
                table,
                id,
                actor_user_id: actorUserId
            });
            return res.status(404).json({ 
                error: 'Registro não encontrado',
                hint: `Nenhum registro encontrado com id=${id} na tabela ${table}`,
                requestId
            });
        }
        
        // Log de sucesso APÓS commit implícito
        logger.info('user_roles.update.success', {
            requestId,
            table,
            id,
            updated_fields: columns,
            actor_user_id: actorUserId,
            row_count: result.rows.length
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        // SCHEMA-02: Tratamento específico para coluna inexistente
        // Quando tentamos atualizar uma coluna que não existe no schema
        const attemptedColumns = Object.keys(data || {});
        if (error.code === '42703' || error.message.includes('does not exist') || error.message.includes('column')) {
            logger.error('aluno.update.error.column_not_found', {
                requestId,
                table,
                id,
                attempted_columns: attemptedColumns,
                error: error.message,
                code: error.code,
                detail: error.detail,
                actor_user_id: actorUserId,
                payload: JSON.stringify(req.body)
            });
            
            return res.status(400).json({ 
                error: 'Coluna não encontrada no schema',
                message: error.message,
                hint: `A tabela ${table} não possui uma ou mais das colunas: ${attemptedColumns.join(', ')}. Verifique se a migração do schema foi aplicada.`,
                attempted_columns: attemptedColumns,
                requestId
            });
        }
        
        // Log de erro com stack trace completo para diagnóstico
        logger.error('user_roles.update.error', {
            requestId,
            table,
            id,
            error: error.message,
            code: error.code,
            detail: error.detail,
            stack: error.stack,
            actor_user_id: actorUserId,
            payload: JSON.stringify(req.body)
        });
        
        // Erro 500 para erros inesperados (ex: constraint violation, connection error)
        res.status(500).json({ 
            error: error.message || 'Erro ao atualizar registro',
            requestId
        });
    }
});

// Delete - DEPRECATED
// DESIGN-SUPABASE-PURGE-GLOBAL-002: Rotas genéricas são FORBIDDEN
app.delete('/rest/v1/:table', authenticate, domainSchemaGuard, async (req, res) => {
    console.warn(`⚠️ DEPRECATED: DELETE /rest/v1/${req.params.table} está deprecated. Use rotas semânticas /api/*`);
    const { table } = req.params;
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'ID é obrigatório para deletar' });
    }
    
    try {
        // Para tabela 'user_roles', deletar usuário completamente (incluindo app_auth.users)
        if (table === 'user_roles') {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Buscar user_id antes de deletar
                const roleResult = await client.query(
                    'SELECT user_id FROM public.user_roles WHERE id = $1',
                    [id]
                );
                
                if (roleResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Role não encontrada' });
                }
                
                const userId = roleResult.rows[0].user_id;
                
                // IMPORTANTE: Deletar app_auth.users ANTES de deletar user_roles
                // Porque pode haver foreign keys que impedem a exclusão
                // Ordem correta: dependências primeiro, depois user_roles, depois app_auth.users
                
                // 1. Buscar email do usuário ANTES de deletar qualquer coisa
                const userResult = await client.query(
                    'SELECT email FROM app_auth.users WHERE id = $1',
                    [userId]
                );
                
                if (userResult.rows.length === 0) {
                    // Se não encontrou o usuário em app_auth.users, apenas deletar o role
                    await client.query('DELETE FROM public.user_roles WHERE id = $1', [id]);
                    await client.query('COMMIT');
                    logger.warn('Usuário não encontrado em app_auth.users, apenas role deletado', {
                        userId,
                        roleId: id
                    });
                    return res.json({ message: 'Role deletado (usuário não encontrado em app_auth.users)' });
                }
                
                const email = userResult.rows[0].email;
                logger.info('Iniciando deleção completa de usuário', { userId, email, roleId: id });
                
                // 2. Deletar aluno se existir (por email) - fazer antes de deletar user_roles
                const alunoResult = await client.query('DELETE FROM public.alunos WHERE email = $1 RETURNING id', [email]);
                logger.info('Aluno deletado (se existia)', { count: alunoResult.rows.length, email });
                
                // 3. Deletar profile se existir
                const profileResult = await client.query('DELETE FROM public.profiles WHERE id = $1 RETURNING id', [userId]);
                logger.info('Profile deletado (se existia)', { count: profileResult.rows.length, userId });
                
                // 4. Deletar user_roles
                await client.query('DELETE FROM public.user_roles WHERE id = $1', [id]);
                logger.info('user_roles deletado', { roleId: id });
                
                // 5. Deletar usuário de app_auth.users (FINALMENTE - mais importante!)
                await client.query('DELETE FROM app_auth.users WHERE id = $1', [userId]);
                logger.info('app_auth.users deletado', { userId, email });
                
                logger.info('Usuário deletado completamente com sucesso', {
                    userId,
                    email,
                    roleId: id,
                    dependenciasRemovidas: {
                        aluno: alunoResult.rows.length,
                        profile: profileResult.rows.length
                    }
                });
                
                await client.query('COMMIT');
                res.json({ message: 'Usuário deletado com sucesso' });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }
        // Para tabela 'alunos', verificar dependências e deletar em cascata se necessário
        else if (table === 'alunos') {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                logger.info('Iniciando deleção de aluno com dependências', { alunoId: id });
                
                // Deletar todas as dependências em ordem (mesmo que tenham ON DELETE CASCADE, vamos garantir)
                // 1. itens_dieta (via dietas)
                const dietasResult = await client.query('SELECT id FROM dietas WHERE aluno_id = $1', [id]);
                const dietasIds = dietasResult.rows.map(r => r.id);
                if (dietasIds.length > 0) {
                    await client.query('DELETE FROM itens_dieta WHERE dieta_id = ANY($1)', [dietasIds]);
                    logger.info('itens_dieta deletados', { count: dietasIds.length });
                }
                
                // 2. dietas
                await client.query('DELETE FROM dietas WHERE aluno_id = $1', [id]);
                logger.info('dietas deletadas', { count: dietasResult.rows.length });
                
                // 3. alunos_treinos (pode ter ON DELETE CASCADE, mas vamos garantir)
                const alunosTreinosResult = await client.query('DELETE FROM alunos_treinos WHERE aluno_id = $1 RETURNING id', [id]);
                logger.info('alunos_treinos deletados', { count: alunosTreinosResult.rows.length });
                
                // 4. feedbacks_alunos (pode ter ON DELETE CASCADE, mas vamos garantir)
                const feedbacksResult = await client.query('DELETE FROM feedbacks_alunos WHERE aluno_id = $1 RETURNING id', [id]);
                logger.info('feedbacks_alunos deletados', { count: feedbacksResult.rows.length });
                
                // 5. fotos_alunos (pode ter ON DELETE CASCADE, mas vamos garantir)
                const fotosResult = await client.query('DELETE FROM fotos_alunos WHERE aluno_id = $1 RETURNING id', [id]);
                logger.info('fotos_alunos deletadas', { count: fotosResult.rows.length });
                
                // 6. asaas_payments (pode ter ON DELETE CASCADE, mas vamos garantir)
                const asaasPaymentsResult = await client.query('DELETE FROM asaas_payments WHERE aluno_id = $1 RETURNING id', [id]);
                logger.info('asaas_payments deletados', { count: asaasPaymentsResult.rows.length });
                
                // 7. asaas_customers (pode ter ON DELETE CASCADE, mas vamos garantir)
                const asaasCustomersResult = await client.query('DELETE FROM asaas_customers WHERE aluno_id = $1 RETURNING id', [id]);
                logger.info('asaas_customers deletados', { count: asaasCustomersResult.rows.length });
                
                // 8. turmas_alunos (se existir)
                try {
                    const turmasAlunosResult = await client.query('DELETE FROM turmas_alunos WHERE aluno_id = $1 RETURNING id', [id]);
                    logger.info('turmas_alunos deletados', { count: turmasAlunosResult.rows.length });
                } catch (turmasError) {
                    // Tabela pode não existir, ignorar erro
                    if (!turmasError.message.includes('does not exist')) {
                        logger.warn('Erro ao deletar turmas_alunos (pode não existir)', { error: turmasError.message });
                    }
                }
                
                // 9. eventos_participantes (se existir)
                try {
                    const eventosParticipantesResult = await client.query('DELETE FROM eventos_participantes WHERE aluno_id = $1 RETURNING id', [id]);
                    logger.info('eventos_participantes deletados', { count: eventosParticipantesResult.rows.length });
                } catch (eventosError) {
                    // Tabela pode não existir, ignorar erro
                    if (!eventosError.message.includes('does not exist')) {
                        logger.warn('Erro ao deletar eventos_participantes (pode não existir)', { error: eventosError.message });
                    }
                }
                
                // 10. avisos_destinatarios (se existir)
                try {
                    const avisosDestinatariosResult = await client.query('DELETE FROM avisos_destinatarios WHERE aluno_id = $1 RETURNING id', [id]);
                    logger.info('avisos_destinatarios deletados', { count: avisosDestinatariosResult.rows.length });
                } catch (avisosError) {
                    // Tabela pode não existir, ignorar erro
                    if (!avisosError.message.includes('does not exist')) {
                        logger.warn('Erro ao deletar avisos_destinatarios (pode não existir)', { error: avisosError.message });
                    }
                }
                
                // 11. weekly_checkins (se existir)
                try {
                    const weeklyCheckinsResult = await client.query('DELETE FROM weekly_checkins WHERE aluno_id = $1 RETURNING id', [id]);
                    logger.info('weekly_checkins deletados', { count: weeklyCheckinsResult.rows.length });
                } catch (checkinsError) {
                    // Tabela pode não existir, ignorar erro
                    if (!checkinsError.message.includes('does not exist')) {
                        logger.warn('Erro ao deletar weekly_checkins (pode não existir)', { error: checkinsError.message });
                    }
                }
                
                // 12. progressos (se existir)
                try {
                    const progressosResult = await client.query('DELETE FROM progressos WHERE aluno_id = $1 RETURNING id', [id]);
                    logger.info('progressos deletados', { count: progressosResult.rows.length });
                } catch (progressosError) {
                    // Tabela pode não existir, ignorar erro
                    if (!progressosError.message.includes('does not exist')) {
                        logger.warn('Erro ao deletar progressos (pode não existir)', { error: progressosError.message });
                    }
                }
                
                // 13. avaliacoes (se existir)
                try {
                    const avaliacoesResult = await client.query('DELETE FROM avaliacoes WHERE aluno_id = $1 RETURNING id', [id]);
                    logger.info('avaliacoes deletadas', { count: avaliacoesResult.rows.length });
                } catch (avaliacoesError) {
                    // Tabela pode não existir, ignorar erro
                    if (!avaliacoesError.message.includes('does not exist')) {
                        logger.warn('Erro ao deletar avaliacoes (pode não existir)', { error: avaliacoesError.message });
                    }
                }
                
                // 14. recurring_charges_config (se existir)
                try {
                    const recurringChargesResult = await client.query('DELETE FROM recurring_charges_config WHERE aluno_id = $1 RETURNING id', [id]);
                    logger.info('recurring_charges_config deletados', { count: recurringChargesResult.rows.length });
                } catch (recurringError) {
                    // Tabela pode não existir, ignorar erro
                    if (!recurringError.message.includes('does not exist')) {
                        logger.warn('Erro ao deletar recurring_charges_config (pode não existir)', { error: recurringError.message });
                    }
                }
                
                // 15. financial_exceptions (se existir)
                try {
                    const financialExceptionsResult = await client.query('DELETE FROM financial_exceptions WHERE aluno_id = $1 RETURNING id', [id]);
                    logger.info('financial_exceptions deletados', { count: financialExceptionsResult.rows.length });
                } catch (financialError) {
                    // Tabela pode não existir, ignorar erro
                    if (!financialError.message.includes('does not exist')) {
                        logger.warn('Erro ao deletar financial_exceptions (pode não existir)', { error: financialError.message });
                    }
                }
                
                // 16. Deletar o aluno (finalmente)
                await client.query('DELETE FROM public.alunos WHERE id = $1', [id]);
                
                await client.query('COMMIT');
                logger.info('Aluno deletado com sucesso (todas as dependências removidas)', { 
                    alunoId: id,
                    dependenciasRemovidas: {
                        dietas: dietasResult.rows.length,
                        itens_dieta: dietasIds.length,
                        alunos_treinos: alunosTreinosResult.rows.length,
                        feedbacks_alunos: feedbacksResult.rows.length,
                        fotos_alunos: fotosResult.rows.length,
                        asaas_payments: asaasPaymentsResult.rows.length,
                        asaas_customers: asaasCustomersResult.rows.length
                    }
                });
                res.json({ message: 'Deletado com sucesso' });
            } catch (error) {
                await client.query('ROLLBACK');
                logger.error('Erro ao deletar aluno', {
                    alunoId: id,
                    error: error.message,
                    code: error.code,
                    detail: error.detail
                });
                throw error;
            } finally {
                client.release();
            }
        } else {
            // Para outras tabelas, deletar diretamente
            await pool.query(`DELETE FROM public.${table} WHERE id = $1`, [id]);
            res.json({ message: 'Deletado com sucesso' });
        }
    } catch (error) {
        logger.error('Erro ao deletar registro', {
            table,
            id,
            error: error.message,
            code: error.code,
            detail: error.detail
        });
        
        // Tratar erros de foreign key de forma mais amigável
        if (error.code === '23503') { // Foreign key violation
            const tableName = table === 'alunos' ? 'aluno' : table;
            res.status(400).json({ 
                error: `Não é possível deletar este ${tableName} porque existem registros relacionados.`,
                detail: error.detail || error.message
            });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// =============== STORAGE (arquivos locais) ===============

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const bucket = req.params.bucket;
        const dir = path.join(__dirname, 'storage', bucket);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// upload já declarado acima (linha ~96), reutilizando

app.post('/storage/v1/object/:bucket/*', authenticate, upload.single('file'), (req, res) => {
    const filePath = `/storage/${req.params.bucket}/${req.file.filename}`;
    res.json({ path: filePath });
});

app.get('/storage/v1/object/public/:bucket/*', (req, res) => {
    const filePath = path.join(__dirname, 'storage', req.params.bucket, req.params[0]);
    res.sendFile(filePath);
});

// =============== IMPORTAÇÃO DE FICHAS VIA PDF (NOVA ARQUITETURA) ===============

// RUNTIME-02: Logar pool antes de criar ImportController
logger.error('RUNTIME-02: Pool antes de criar ImportController', {
    poolType: typeof pool,
    poolConstructor: pool?.constructor?.name,
    poolHasQuery: typeof pool?.query === 'function',
    poolKeys: Object.keys(pool || {}).slice(0, 15),
    poolInspect: require('util').inspect(pool, { depth: 2, maxArrayLength: 3 })
});

// Endpoint para processar PDF e extrair dados (fase 1: parsing)
// Usa multipart/form-data ao invés de base64
// STEP-08: Rota de debug para testar pool isoladamente
app.get('/debug/db-test', async (req, res) => {
    try {
        logger.info('STEP-08: Teste de DB iniciado');
        const result = await pool.query('SELECT 1 as test, NOW() as timestamp');
        logger.info('STEP-08: Query executada com sucesso', { result: result.rows[0] });
        res.json({ success: true, data: result.rows[0], poolType: typeof pool, hasQuery: typeof pool.query === 'function' });
    } catch (error) {
        logger.error('STEP-08: Erro no teste de DB', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/import/parse-pdf', authenticate, uploadLimiter, upload.single('pdf'), async (req, res) => {
    await importController.parsePDF(req, res);
});

// Endpoint para confirmar importação e criar aluno + dieta (fase 2: persistência)
// Executa em transação para garantir atomicidade
// STEP-10: Garantir bind correto do método
app.post('/api/import/confirm', authenticate, (req, res) => {
    // Usar arrow function para preservar contexto, mas método já está bindado
    importController.confirmImport(req, res).catch(err => {
        const logger = require('./utils/logger');
        logger.error('STEP-10: Erro não capturado em confirmImport', {
            error: err.message,
            stack: err.stack
        });
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message || 'Erro ao confirmar importação' });
        }
    });
});

// =============== IMPORTAÇÃO DE FICHAS VIA PDF (LEGADO - MANTIDO POR COMPATIBILIDADE) ===============

// Parse Student PDF (processamento local, sem dependências externas)
// DEPRECATED: Use /api/import/parse-pdf com multipart/form-data
app.post('/functions/parse-student-pdf', authenticate, async (req, res) => {
    try {
        const { pdfBase64, fileName } = req.body;

        if (!pdfBase64) {
            return res.status(400).json({ success: false, error: 'PDF base64 é obrigatório' });
        }

        // Validar tamanho do base64 (aproximadamente 4/3 do tamanho do arquivo original)
        const base64SizeMB = (pdfBase64.length * 3 / 4) / (1024 * 1024);
        if (base64SizeMB > 50) {
            return res.status(413).json({ 
                success: false, 
                error: `Arquivo muito grande (${base64SizeMB.toFixed(2)}MB). Tamanho máximo: 50MB. Tente reduzir o tamanho do PDF.` 
            });
        }

        console.log('Processando PDF localmente:', fileName, `(${base64SizeMB.toFixed(2)}MB)`);

        // Converter base64 para Buffer
        let pdfBuffer;
        try {
            pdfBuffer = Buffer.from(pdfBase64, 'base64');
        } catch (bufferError) {
            return res.status(400).json({ 
                success: false, 
                error: 'Base64 inválido. Verifique o formato do arquivo.' 
            });
        }

        // Processar PDF localmente
        const parsedData = await parseStudentPDF(pdfBuffer);

        // Validação básica
        if (!parsedData.aluno) {
            parsedData.aluno = { nome: 'Aluno Importado' };
        }
        if (!parsedData.aluno.nome) {
            parsedData.aluno.nome = 'Aluno Importado';
        }

        const numRefeicoes = parsedData.dieta?.refeicoes?.length || 0;
        console.log('Dados extraídos - Aluno:', parsedData.aluno?.nome);
        console.log('Dados extraídos - Número de Refeições:', numRefeicoes);

        // Log each meal name
        if (parsedData.dieta?.refeicoes) {
            parsedData.dieta.refeicoes.forEach((ref, idx) => {
                console.log(`  - ${ref.nome}: ${ref.alimentos?.length || 0} alimentos`);
            });
        }

        console.log('Dados extraídos - Suplementos:', parsedData.suplementos?.length || 0);
        console.log('Dados extraídos - Fármacos:', parsedData.farmacos?.length || 0);

        // Warning if few meals
        if (numRefeicoes < 3) {
            console.warn('AVISO: Poucas refeições extraídas. O PDF pode conter mais refeições.');
        }

        res.json({ success: true, data: parsedData });

    } catch (error) {
        console.error('Erro ao processar PDF:', error);
        // Garantir que sempre retornamos JSON, mesmo em caso de erro
        const errorMessage = error.message || 'Erro ao processar PDF';
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ 
            success: false, 
            error: errorMessage 
        });
    }
});

// =============== PAYMENTS (Asaas Integration) ===============

// Endpoint para criar pagamento no Asaas (substitui Edge Function)
app.post('/api/payments/create-asaas', authenticate, async (req, res) => {
    try {
        const { alunoId, value, billingType, dueDate, description } = req.body;

        if (!alunoId || !value || !billingType || !dueDate) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: alunoId, value, billingType, dueDate'
            });
        }

        // Buscar dados do aluno
        const alunoResult = await pool.query(
            'SELECT * FROM public.alunos WHERE id = $1 AND coach_id = $2',
            [alunoId, req.user.id]
        );

        if (alunoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Aluno não encontrado'
            });
        }

        const aluno = alunoResult.rows[0];

        let payment = null;
        let asaasPaymentData = null;

        // Se Asaas Service estiver disponível, criar pagamento no Asaas
        if (asaasService) {
            try {
                // Criar pagamento completo no Asaas
                const result = await asaasService.createCompletePayment({
                    alunoId: aluno.id,
                    alunoNome: aluno.nome,
                    alunoEmail: aluno.email || `${aluno.nome.toLowerCase().replace(/\s+/g, '.')}@aluno.temp`,
                    alunoCpf: aluno.cpf || null,
                    alunoTelefone: aluno.telefone || null,
                    value: parseFloat(value),
                    billingType: billingType,
                    dueDate: dueDate,
                    description: description || `Pagamento - ${aluno.nome}`
                });

                asaasPaymentData = result.payment;

                // Criar registro no banco com dados do Asaas
                const paymentResult = await pool.query(
                    `INSERT INTO public.asaas_payments (
                        aluno_id, 
                        coach_id, 
                        value, 
                        billing_type, 
                        due_date, 
                        description,
                        status,
                        asaas_payment_id,
                        asaas_customer_id,
                        pix_copy_paste,
                        invoice_url
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9, $10)
                    RETURNING *`,
                    [
                        alunoId,
                        req.user.id,
                        parseFloat(value),
                        billingType,
                        dueDate,
                        description || null,
                        asaasPaymentData.id,
                        result.customer.id,
                        asaasPaymentData.pix?.copyPaste || null,
                        asaasPaymentData.invoiceUrl || null
                    ]
                );

                payment = paymentResult.rows[0];

                // Notificar via WebSocket se disponível
                if (notificationService) {
                    await notificationService.notifyPaymentStatus(
                        payment.id,
                        req.user.id,
                        'PENDING',
                        {
                            asaasPaymentId: asaasPaymentData.id,
                            pixCopyPaste: asaasPaymentData.pix?.copyPaste,
                            invoiceUrl: asaasPaymentData.invoiceUrl
                        }
                    );
                }
            } catch (asaasError) {
                console.error('Erro ao criar pagamento no Asaas:', asaasError);
                // Criar registro local mesmo em caso de erro no Asaas
                // Gerar IDs temporários únicos para asaas_payment_id e asaas_customer_id
                const tempPaymentId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const tempCustomerId = `temp_customer_${alunoId}_${Date.now()}`;
                
                const paymentResult = await pool.query(
                    `INSERT INTO public.asaas_payments (
                        aluno_id, 
                        coach_id, 
                        value, 
                        billing_type, 
                        due_date, 
                        description,
                        status,
                        asaas_payment_id,
                        asaas_customer_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8)
                    RETURNING *`,
                    [alunoId, req.user.id, parseFloat(value), billingType, dueDate, description || null, tempPaymentId, tempCustomerId]
                );
                payment = paymentResult.rows[0];
                
                logger.warn('Pagamento criado localmente sem Asaas (IDs temporários)', {
                    paymentId: payment.id,
                    tempAsaasPaymentId: tempPaymentId,
                    tempAsaasCustomerId: tempCustomerId,
                    error: asaasError.message
                });
            }
        } else {
            // Criar apenas registro local se Asaas não estiver disponível
            // Gerar IDs temporários únicos para asaas_payment_id e asaas_customer_id
            const tempPaymentId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const tempCustomerId = `temp_customer_${alunoId}_${Date.now()}`;
            
            const paymentResult = await pool.query(
                `INSERT INTO public.asaas_payments (
                    aluno_id, 
                    coach_id, 
                    value, 
                    billing_type, 
                    due_date, 
                    description,
                    status,
                    asaas_payment_id,
                    asaas_customer_id
                ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8)
                RETURNING *`,
                [alunoId, req.user.id, parseFloat(value), billingType, dueDate, description || null, tempPaymentId, tempCustomerId]
            );
            payment = paymentResult.rows[0];
            
            logger.warn('Pagamento criado localmente sem Asaas Service (IDs temporários)', {
                paymentId: payment.id,
                tempAsaasPaymentId: tempPaymentId,
                tempAsaasCustomerId: tempCustomerId
            });
        }

        res.json({
            success: true,
            payment: {
                id: payment.id,
                aluno_id: payment.aluno_id,
                value: payment.value,
                billing_type: payment.billing_type,
                due_date: payment.due_date,
                description: payment.description,
                status: payment.status,
                asaas_payment_id: payment.asaas_payment_id || null,
                pix_copy_paste: payment.pix_copy_paste || null,
                invoice_url: payment.invoice_url || null
            }
        });

    } catch (error) {
        console.error('Erro ao criar pagamento:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erro ao criar pagamento'
        });
    }
});

// Error handlers (devem ser os últimos middlewares)
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// CORS ASSERT NO BOOT - CORS-SINGLE-SOURCE-OF-TRUTH-001
// ============================================================================
// Garantir que CORS está configurado corretamente antes de iniciar servidor
// ============================================================================
const { assertCORSConfig } = require('./utils/cors-assert');

const corsValid = assertCORSConfig(app);
if (!corsValid) {
    logger.warn('CORS-ASSERT: CORS pode não estar configurado corretamente', {
        note: 'Servidor iniciará mesmo assim, mas CORS pode falhar'
    });
} else {
    logger.info('CORS-ASSERT: CORS validado com sucesso');
}

// Iniciar servidor HTTP (suporta WebSocket)
// DESIGN-AUTH-API-HARDENING-AVAILABILITY-002: Fail-fast se PORT não estiver definida
const PORT = process.env.PORT || 3001;

if (!PORT || isNaN(parseInt(PORT))) {
    logger.error('DESIGN-AUTH-API-HARDENING-AVAILABILITY-002: PORT inválida ou não definida', {
        port: PORT,
        env_port: process.env.PORT
    });
    console.error('❌ ERRO CRÍTICO: PORT inválida ou não definida');
    console.error('❌ Defina PORT no ambiente ou use padrão 3001');
    process.exit(1);
}

httpServer.listen(PORT, () => {
    logger.info(`API rodando na porta ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        websocketEnabled: !!websocketService,
        jobsEnabled: !!jobsRunner,
        corsConfigured: corsValid
    });
    
    // DESIGN-AUTH-API-HARDENING-AVAILABILITY-002: Log explícito de inicialização
    console.log(`✅ API iniciada com sucesso na porta ${PORT}`);
    console.log(`✅ Health check disponível em http://localhost:${PORT}/health`);
});

// Configurar graceful shutdown
const gracefulShutdown = new GracefulShutdown(httpServer, pool, websocketService, jobsRunner);
gracefulShutdown.setup();
