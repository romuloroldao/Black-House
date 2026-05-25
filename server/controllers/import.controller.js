// Import Controller
// Orquestra o fluxo completo de importação de fichas de alunos via PDF

const pdfParserService = require('../services/pdf-parser.service');
const aiService = require('../services/ai.service');
const importEngine = require('../services/import-engine');
const validatorService = require('../services/validator.service');
const { safeValidate, safeValidateDietOnly } = require('../schemas/import-schema');
const logger = require('../utils/logger');
const StudentService = require('../services/student.service');
const DietService = require('../services/diet.service');
const AlimentoRepository = require('../repositories/alimento.repository');
const TipoAlimentoRepository = require('../repositories/tipo-alimento.repository');
const StudentRepository = require('../repositories/student.repository');
const DietRepository = require('../repositories/diet.repository');
const FoodMatchingService = require('../services/food-matching.service');

// STEP-15: Usar helper compartilhado
const { assertQueryable: assertQueryableShared } = require('../shared/db-guards');

// GUARD-01: Fail-fast contra regressão - pool NÃO deve existir neste escopo
// SCOPE-01: DO NOT USE pool HERE - Use apenas this._db ou client
// Este arquivo NUNCA deve importar ou referenciar 'pool' diretamente
if (typeof pool !== 'undefined') {
    throw new Error('GUARD-01: ERRO CRÍTICO - pool não deve existir neste escopo! Use apenas this._db ou client.');
}

class ImportController {
    constructor(db) {
        // STEP-03: Log detalhado do argumento recebido
        const logger = require('../utils/logger');
        logger.info('STEP-03: ImportController constructor chamado', {
            dbType: typeof db,
            dbIsNull: db === null,
            dbIsUndefined: db === undefined,
            hasQuery: typeof db?.query === 'function',
            hasConnect: typeof db?.connect === 'function',
            dbKeys: db ? Object.keys(db).slice(0, 10) : []
        });

        if (!db || typeof db.query !== 'function') {
            logger.error('STEP-03: Pool inválido no constructor', {
                dbType: typeof db,
                hasQuery: typeof db?.query
            });
            throw new Error('Pool de banco não inicializado no ImportController');
        }
        
        // STEP-09: Usar _db para evitar shadowing
        this._db = db;
        this.parsePDF = this.parsePDF.bind(this);
        this.confirmImport = this.confirmImport.bind(this);
        this.confirmDietForAluno = this.confirmDietForAluno.bind(this);
        
        // STEP-03: Validar após atribuição
        logger.info('STEP-03: ImportController inicializado', {
            this_DbType: typeof this._db,
            this_DbHasQuery: typeof this._db.query === 'function',
            this_DbHasConnect: typeof this._db.connect === 'function'
        });
        
        // STEP-11: Verificar se há outras referências de banco
        const hasPgRequire = Object.keys(require.cache).some(key => key.includes('pg') && !key.includes('node_modules'));
        logger.info('STEP-11: Verificação de referências múltiplas', {
            hasPgRequire,
            cacheKeys: Object.keys(require.cache).filter(k => k.includes('pg')).slice(0, 5)
        });
    }

    /**
     * Processa PDF e extrai dados estruturados (fase 1: parsing)
     * Retorna dados para revisão no frontend
     */
    async parsePDF(req, res) {
        try {
            const file = req.file;
            
            if (!file) {
                return res.status(400).json({
                    success: false,
                    error: 'Arquivo é obrigatório (PDF, CSV ou XLSX)'
                });
            }

            const isCsv = /\.csv$/i.test(file.originalname || '') ||
                ['text/csv', 'application/csv', 'text/comma-separated-values'].includes(file.mimetype);
            const isXlsx = /\.xlsx$/i.test(file.originalname || '') ||
                [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                ].includes(file.mimetype);
            const isSpreadsheet = isCsv || isXlsx;

            if (!isSpreadsheet && file.mimetype !== 'application/pdf') {
                return res.status(400).json({
                    success: false,
                    error: 'Apenas arquivos PDF, CSV ou XLSX são aceitos'
                });
            }

            if (isSpreadsheet) {
                if (!pdfParserService.isValidSize(file.buffer, 50)) {
                    return res.status(413).json({
                        success: false,
                        error: 'Arquivo muito grande. Tamanho máximo: 50MB'
                    });
                }
            } else {
            // Validar se é PDF válido
            if (!pdfParserService.isValidPDF(file.buffer)) {
                return res.status(400).json({
                    success: false,
                    error: 'Arquivo não é um PDF válido'
                });
            }

            // Validar tamanho (50MB máximo)
            if (!pdfParserService.isValidSize(file.buffer, 50)) {
                return res.status(413).json({
                    success: false,
                    error: 'Arquivo muito grande. Tamanho máximo: 50MB'
                });
            }
            }

            const requestId = req.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            logger.info('IMPORT-PDF: import-engine', {
                requestId,
                fileName: file.originalname,
                sizeMb: (file.buffer.length / 1024 / 1024).toFixed(2),
                format: isXlsx ? 'xlsx' : isCsv ? 'csv' : 'pdf',
            });

            let engineResult;
            try {
                engineResult = await importEngine.process(file.buffer, {
                    fileName: file.originalname,
                    requestId,
                    mimeType: file.mimetype,
                });
            } catch (engineError) {
                if (engineError.code === 'OCR_EMPTY' || engineError.code === 'CSV_PARSE_FAILED' || engineError.code === 'XLSX_PARSE_FAILED' || engineError.code === 'XLSX_READ_FAILED') {
                    return res.status(400).json({
                        success: false,
                        error: engineError.message
                    });
                }
                if (engineError.code === 'SCHEMA_INVALID') {
                    return res.status(400).json({
                        success: false,
                        error: 'Dados extraídos não estão no formato esperado',
                        errors: engineError.details,
                        details: 'Revise a ficha ou tente novamente com outro PDF.'
                    });
                }
                logger.error('IMPORT-ENGINE: falha', {
                    requestId,
                    error: engineError.message
                });
                return res.status(500).json({
                    success: false,
                    error: engineError.message || 'Erro ao processar ficha'
                });
            }

            const { data: normalizedData, warnings, meta } = engineResult;

            res.json({
                success: true,
                data: normalizedData,
                warnings: warnings?.length > 0 ? warnings : undefined,
                meta: {
                    ...meta,
                    provider: aiService.getProviderInfo?.() || null,
                    fileName: file.originalname,
                    fallback: !meta.aiUsed
                }
            });

        } catch (error) {
            console.error('Erro ao processar ficha:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Erro ao processar ficha'
            });
        }
    }

    /**
     * Confirma importação e cria aluno + dieta (fase 2: persistência)
     * Executa em transação para garantir atomicidade
     */
    async confirmImport(req, res) {
        const logger = require('../utils/logger');
        const CONTROLLER_VERSION = 'v1.0.0-debug-20260115-phase2';
        
        // INFRA-07: Teste nuclear - remover após confirmação
        // throw new Error('🔥 CODE VERSION CHECK 🔥 - Se você vê isso, o código novo está rodando!');
        
        // RUNTIME-04: Validar assinatura de método
        logger.error('RUNTIME-04: Validação de assinatura de método confirmImport', {
            thisType: typeof this,
            thisIsUndefined: this === undefined,
            thisIsNull: this === null,
            thisConstructor: this?.constructor?.name,
            thisHas_Db: typeof this?._db !== 'undefined',
            this_DbType: typeof this?._db,
            confirmImportIsMethod: typeof this?.confirmImport === 'function',
            confirmImportName: this?.confirmImport?.name,
            callStack: new Error().stack?.split('\n').slice(2, 8).join('\n')
        });
        
        // STEP-10: Verificar contexto this
        if (this === undefined || this === null) {
            logger.error('STEP-10: Contexto this perdido em confirmImport');
            return res.status(500).json({ success: false, error: 'Erro interno: contexto perdido' });
        }
        
        // STEP-04: Log de entrada no método
        logger.info('STEP-04: confirmImport chamado', {
            version: CONTROLLER_VERSION,
            thisType: typeof this,
            thisIsUndefined: this === undefined,
            this_DbType: typeof this._db,
            this_DbIsNull: this._db === null,
            this_DbIsUndefined: this._db === undefined,
            hasQuery: typeof this._db?.query === 'function',
            hasConnect: typeof this._db?.connect === 'function',
            reqBodyType: typeof req.body,
            reqBodyKeys: req.body ? Object.keys(req.body) : [],
            userId: req.user?.id
        });

        try {
            // STEP-13: Validar shape exato do req.body
            logger.info('STEP-13: Validando req.body', {
                reqBodyStringified: JSON.stringify(req.body).substring(0, 500),
                hasData: !!req.body?.data,
                dataType: typeof req.body?.data,
                dataKeys: req.body?.data ? Object.keys(req.body.data) : []
            });

            const { data } = req.body;
            const userId = req.user.id;

            if (!data) {
                logger.error('STEP-13: req.body.data não existe', {
                    reqBodyKeys: Object.keys(req.body || {}),
                    reqBodyType: typeof req.body
                });
                return res.status(400).json({
                    success: false,
                    error: 'Dados de importação são obrigatórios'
                });
            }

            const schemaValidation = safeValidate(data);
            if (!schemaValidation.success) {
                const validationErrors = Array.isArray(schemaValidation.errors) ? schemaValidation.errors : [];
                const errorMessages = validationErrors.length > 0
                    ? validationErrors.map((e) => `${e.path || 'root'}: ${e.message}`)
                    : ['Erro desconhecido na validação'];
                logger.warn('confirmImport: dados fora do schema canônico', {
                    errors: validationErrors,
                    userId
                });
                return res.status(400).json({
                    success: false,
                    error: 'Dados inválidos para importação',
                    errors: errorMessages.slice(0, 15)
                });
            }

            const validatedData = schemaValidation.data;

            // Validar regras de negócio (sobre dados já validados pelo Zod)
            const businessValidation = validatorService.validateImportData(validatedData);
            
            if (!businessValidation.valid) {
                logger.warn('Tentativa de persistir dados com erros de validação de negócio', {
                    errors: businessValidation.errors,
                    userId: userId
                });
                
                return res.status(400).json({
                    success: false,
                    error: 'Dados inválidos',
                    errors: businessValidation.errors
                });
            }
            // RUNTIME-05: Teste forçado de falha controlada ANTES do primeiro uso
            const util = require('util');
            if (!this._db) {
                const error = new Error('RUNTIME-05: DUMP COMPLETO - this._db é undefined/null');
                logger.error(error.message, {
                    thisType: typeof this,
                    thisConstructor: this?.constructor?.name,
                    thisKeys: Object.keys(this || {}).slice(0, 20),
                    thisInspect: util.inspect(this, { depth: 3, maxArrayLength: 5 }),
                    stack: new Error().stack
                });
                throw error;
            }
            
            // STEP-09: Usar _db e validar com guard
            assertQueryableShared(this._db, 'this._db', 'antes de connect()');
            
            // RUNTIME-02: Dump completo de this._db
            logger.error('RUNTIME-02: Dump completo de this._db antes de connect()', {
                this_DbType: typeof this._db,
                this_DbConstructor: this._db?.constructor?.name,
                this_DbHasQuery: typeof this._db?.query === 'function',
                this_DbHasConnect: typeof this._db?.connect === 'function',
                this_DbKeys: Object.keys(this._db || {}).slice(0, 20),
                this_DbInspect: util.inspect(this._db, { depth: 3, maxArrayLength: 5 })
            });
            
            // STEP-05: Validar _db antes de connect
            if (!this._db || typeof this._db.connect !== 'function') {
                logger.error('STEP-05: this._db inválido antes de connect', {
                    this_DbType: typeof this._db,
                    hasConnect: typeof this._db?.connect
                });
                throw new Error('Pool de banco não disponível para transação');
            }

            logger.info('STEP-05: Iniciando transação', {
                this_DbType: typeof this._db,
                hasConnect: typeof this._db.connect === 'function'
            });

            const client = await this._db.connect();
            
            // STEP-12: Flag para rastrear release do client
            let clientReleased = false;
            
            // STEP-05: Validar client após connect com guard
            assertQueryableShared(client, 'client', 'após connect()');
            
            // RUNTIME-01: Instrumentar client para interceptar todas as chamadas .query
            const { instrumentQueryable } = require('../shared/query-interceptor');
            instrumentQueryable(client, 'client-da-transacao');
            
            // RUNTIME-02: Mapear objetos de banco em runtime
            // SCOPE-02: NUNCA referenciar 'pool' diretamente - usar apenas this._db ou client
            // GUARD-01: Fail-fast contra regressão - pool não existe neste escopo
            if (typeof pool !== 'undefined') {
                throw new Error('GUARD-01: ERRO CRÍTICO - pool não deve existir neste escopo! Use apenas this._db ou client.');
            }
            
            logger.error('RUNTIME-02: Mapeando objetos de banco', {
                thisType: typeof this,
                thisConstructor: this?.constructor?.name,
                this_DbType: typeof this._db,
                this_DbConstructor: this._db?.constructor?.name,
                this_DbHasQuery: typeof this._db?.query === 'function',
                clientType: typeof client,
                clientConstructor: client?.constructor?.name,
                clientHasQuery: typeof client?.query === 'function',
                clientKeys: Object.keys(client || {}).slice(0, 15),
                dbVsClient: this._db === client ? 'mesmo objeto' : 'objetos diferentes',
                this_DbIsPool: this._db?.constructor?.name === 'BoundPool',
                clientIsClient: client?.constructor?.name === 'Client'
            });
            
            logger.info('STEP-05: Client conectado com sucesso', {
                clientType: typeof client,
                hasQuery: typeof client.query === 'function',
                clientReleased: false
            });

            let result;

            try {
                // STEP-12: Guard antes de usar client
                if (clientReleased) {
                    throw new Error('STEP-12: Tentativa de usar client após release');
                }
                assertQueryableShared(client, 'client', 'antes de BEGIN');
                
                logger.info('STEP-05: Executando BEGIN');
                await client.query('BEGIN');
                logger.info('STEP-05: BEGIN executado com sucesso');

                // STEP-12: Validar client antes de criar repositórios
                assertQueryableShared(client, 'client', 'antes de criar repositórios');
                
                // RUNTIME-02: Log detalhado antes de criar repositórios
                logger.error('RUNTIME-02: Estado antes de criar repositórios', {
                    clientType: typeof client,
                    clientConstructor: client?.constructor?.name,
                    clientHasQuery: typeof client?.query === 'function',
                    clientQueryType: typeof client?.query,
                    clientQueryConstructor: client?.query?.constructor?.name,
                    clientInspect: require('util').inspect(client, { depth: 2, maxArrayLength: 3 })
                });
                
                // Criar repositórios com client de transação
                // TYPE-02: Tipos devem ser resolvidos dentro da mesma transação
                const alimentoRepo = new AlimentoRepository({ query: client.query.bind(client) });
                const tipoAlimentoRepo = new TipoAlimentoRepository(client.query.bind(client));
                const studentRepo = new StudentRepository({ query: client.query.bind(client) });
                const dietRepo = new DietRepository({ query: client.query.bind(client) });
                // ALIM-01: Passar tipoAlimentoRepository para resolver tipos antes de criar alimentos
                const foodMatching = new FoodMatchingService(alimentoRepo, tipoAlimentoRepo);
                
                // RUNTIME-02: Log de repositórios criados com detalhes
                logger.error('RUNTIME-02: Repositórios criados - mapeamento completo', {
                    alimentoRepoType: typeof alimentoRepo,
                    alimentoRepoConstructor: alimentoRepo?.constructor?.name,
                    alimentoRepoHasQuery: typeof alimentoRepo?.query === 'function',
                    studentRepoType: typeof studentRepo,
                    studentRepoConstructor: studentRepo?.constructor?.name,
                    studentRepoHasQuery: typeof studentRepo?.query === 'function',
                    dietRepoType: typeof dietRepo,
                    dietRepoConstructor: dietRepo?.constructor?.name,
                    dietRepoHasQuery: typeof dietRepo?.query === 'function',
                    // Verificar se todos usam o mesmo client
                    alimentoRepoQueryEqual: alimentoRepo?.query === client?.query,
                    studentRepoQueryEqual: studentRepo?.query === client?.query,
                    dietRepoQueryEqual: dietRepo?.query === client?.query
                });

                const studentService = new StudentService(studentRepo);
                const dietService = new DietService(dietRepo, foodMatching);

                // 1. Criar aluno (whitelist de colunas válidas)
                //
                // IMPORT-OPTIONAL-STUDENT-FIELDS-001:
                // A ficha importada pode não trazer email/CPF/objetivo/altura.
                // Como public.alunos.email é NOT NULL + UNIQUE, geramos um email
                // técnico temporário quando o PDF não informa email. Isso permite
                // salvar a ficha agora e vincular/completar o cadastro do aluno depois.
                const rawEmail = typeof validatedData.aluno.email === 'string'
                    ? validatedData.aluno.email.trim()
                    : '';
                const fallbackEmail = `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@blackhouse.local`;
                const alunoEmail = rawEmail || fallbackEmail;

                const alunoPayload = {
                    nome: validatedData.aluno.nome,
                    email: alunoEmail,
                    altura: validatedData.aluno.altura || null,
                    cpf_cnpj: validatedData.aluno.cpf_cnpj || null,
                    telefone: validatedData.aluno.telefone || null,
                    peso: validatedData.aluno.peso || null,
                    idade: validatedData.aluno.idade || null,
                    objetivo: validatedData.aluno.objetivo || null,
                    coach_id: userId
                };
                console.log("alunoPayload", alunoPayload)
                const aluno = await studentService.createAluno(alunoPayload);

                // 2. Criar dieta (se existir)
                let dietaResult = null;
                if (validatedData.dieta && validatedData.dieta.refeicoes && validatedData.dieta.refeicoes.length > 0) {
                    dietaResult = await dietService.createDietaCompleta(
                        validatedData.dieta,
                        aluno.id,
                        userId
                    );
                }

                result = {
                    aluno,
                    dieta: dietaResult?.dieta || null,
                    stats: dietaResult?.stats || null
                };

                // STEP-12: Guard antes de COMMIT
                if (clientReleased) {
                    throw new Error('STEP-12: Tentativa de COMMIT após release');
                }
                assertQueryableShared(client, 'client', 'antes de COMMIT');
                
                logger.info('STEP-05: Executando COMMIT');
                await client.query('COMMIT');
                logger.info('STEP-05: COMMIT executado com sucesso');
            } catch (transactionError) {
                logger.error('STEP-05: Erro na transação, fazendo ROLLBACK', {
                    error: transactionError.message,
                    stack: transactionError.stack,
                    clientReleased
                });
                try {
                    if (!clientReleased && client && typeof client.query === 'function') {
                        assertQueryableShared(client, 'client', 'antes de ROLLBACK');
                        await client.query('ROLLBACK');
                        logger.info('STEP-05: ROLLBACK executado');
                    } else {
                        logger.error('STEP-05: Não é possível fazer ROLLBACK', {
                            clientReleased,
                            clientType: typeof client,
                            hasQuery: typeof client?.query
                        });
                    }
                } catch (rollbackError) {
                    logger.error('STEP-05: Erro ao fazer ROLLBACK', {
                        error: rollbackError.message,
                        stack: rollbackError.stack
                    });
                }
                throw transactionError;
            } finally {
                if (client && typeof client.release === 'function' && !clientReleased) {
                    logger.info('STEP-05: Liberando client');
                    client.release();
                    clientReleased = true;
                } else {
                    logger.error('STEP-05: Client inválido ou já liberado no finally', {
                        clientType: typeof client,
                        hasRelease: typeof client?.release,
                        clientReleased
                    });
                }
            }

            // Retornar resultado
            res.json({
                success: true,
                aluno: result.aluno,
                dieta: result.dieta,
                stats: result.stats
            });

        } catch (error) {
            console.error('Erro ao confirmar importação:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Erro ao confirmar importação'
            });
        }
    }

    /**
     * Reimporta apenas a dieta para um aluno já existente (recuperação).
     * Não cria aluno duplicado; alimentos são vinculados ao catálogo actual (equivalência).
     */
    async confirmDietForAluno(req, res) {
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Não autenticado' });
            }
            if (userRole !== 'coach' && userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Apenas coach ou admin podem reimportar dietas',
                });
            }

            const payload = req.body?.data ?? req.body;
            const schemaValidation = safeValidateDietOnly(payload);
            if (!schemaValidation.success) {
                const errors = schemaValidation.errors || [];
                return res.status(400).json({
                    success: false,
                    error: 'Dados inválidos para reimportação de dieta',
                    errors: errors.map((e) => `${e.path}: ${e.message}`).slice(0, 15),
                });
            }

            const { aluno_id: alunoId, dieta, suplementos, farmacos } = schemaValidation.data;

            assertQueryableShared(this._db, 'this._db', 'confirmDietForAluno');
            const client = await this._db.connect();
            let clientReleased = false;

            try {
                await client.query('BEGIN');

                const alunoCheck = await client.query(
                    `SELECT id, coach_id, email, nome FROM public.alunos WHERE id = $1`,
                    [alunoId],
                );
                if (alunoCheck.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, error: 'Aluno não encontrado' });
                }
                const alunoRow = alunoCheck.rows[0];
                if (userRole === 'coach' && String(alunoRow.coach_id) !== String(userId)) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        success: false,
                        error: 'Este aluno não pertence ao seu perfil de coach',
                    });
                }

                const alimentoRepo = new AlimentoRepository({ query: client.query.bind(client) });
                const tipoAlimentoRepo = new TipoAlimentoRepository(client.query.bind(client));
                const dietRepo = new DietRepository({ query: client.query.bind(client) });
                const foodMatching = new FoodMatchingService(alimentoRepo, tipoAlimentoRepo);
                const dietService = new DietService(dietRepo, foodMatching);

                const dietaPayload = {
                    ...dieta,
                    suplementos: suplementos || [],
                    farmacos: farmacos || [],
                };

                const dietaResult = await dietService.createDietaCompleta(
                    dietaPayload,
                    alunoId,
                    userId,
                );

                await client.query('COMMIT');

                logger.info('Dieta reimportada para aluno existente', {
                    aluno_id: alunoId,
                    dieta_id: dietaResult?.dieta?.id,
                    itens: dietaResult?.stats?.itens_criados,
                    user_id: userId,
                });

                return res.json({
                    success: true,
                    aluno: { id: alunoRow.id, email: alunoRow.email, nome: alunoRow.nome },
                    dieta: dietaResult?.dieta || null,
                    stats: dietaResult?.stats || null,
                });
            } catch (transactionError) {
                try {
                    if (!clientReleased) await client.query('ROLLBACK');
                } catch (_) { /* ignore */ }
                throw transactionError;
            } finally {
                if (client && typeof client.release === 'function' && !clientReleased) {
                    client.release();
                    clientReleased = true;
                }
            }
        } catch (error) {
            logger.error('Erro ao reimportar dieta', {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
            });
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: error.message || 'Erro ao reimportar dieta',
                });
            }
        }
    }
}

module.exports = ImportController;
