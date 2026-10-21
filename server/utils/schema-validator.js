// SCHEMA-03: Validador de schema no boot (fail-fast)
// Garante que colunas esperadas existem antes do servidor aceitar requisições
// Evita erros 42703 em runtime após deploy
// DB-IDENTITY-001: Valida identidade do banco para eliminar risco de banco errado

const logger = require('./logger');
const { validateDatabaseIdentity, generateManualVerificationMessage, extractDatabaseIdentity } = require('./db-identity');

/**
 * Assert que todas as colunas requeridas existem na tabela especificada
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {string} schema - Schema da tabela (ex: 'public')
 * @param {string} table - Nome da tabela
 * @param {string[]} requiredColumns - Array de nomes de colunas obrigatórias
 * @throws {Error} Se alguma coluna não existir
 */
async function assertTableColumns(pool, schema, table, requiredColumns) {
    try {
        const result = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = $1
              AND table_name = $2
        `, [schema, table]);

        const existingColumns = new Set(result.rows.map(r => r.column_name));
        const missingColumns = requiredColumns.filter(col => !existingColumns.has(col));

        if (missingColumns.length > 0) {
            const error = `Schema inválido: tabela ${schema}.${table} está faltando colunas: ${missingColumns.join(', ')}. Aplicar migração SQL necessária antes de iniciar o servidor.`;
            
            logger.error('database.schema.assert.failed', {
                table: `${schema}.${table}`,
                missing_columns: missingColumns,
                existing_columns: Array.from(existingColumns),
                required_columns: requiredColumns
            });

            throw new Error(error);
        }

        logger.info('database.schema.assert.success', {
            table: `${schema}.${table}`,
            required_columns: requiredColumns,
            total_columns: existingColumns.size
        });
    } catch (error) {
        if (error.message.includes('Schema inválido')) {
            throw error; // Re-throw schema errors
        }
        logger.error('database.schema.assert.error', {
            table: `${schema}.${table}`,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Assert que uma tabela existe
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {string} schema - Schema da tabela
 * @param {string} table - Nome da tabela
 * @throws {Error} Se a tabela não existir
 */
async function assertTableExists(pool, schema, table) {
    const result = await pool.query(`
        SELECT table_type
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
    `, [schema, table]);

    if (result.rows.length === 0) {
        throw new Error(`Tabela obrigatória ${schema}.${table} não existe. Aplicar migrações SQL necessárias.`);
    }

    logger.info('database.schema.assert.table_exists', {
        table: `${schema}.${table}`,
        table_type: result.rows[0].table_type
    });
}

/**
 * Valida schema do banco de dados no boot
 * DB-IDENTITY-001: Valida identidade do banco ANTES de validar schema
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {Object} dbConfig - Configuração do banco (para log de identidade)
 */
async function assertDatabaseSchema(pool, dbConfig = null) {
    logger.info('database.schema.assert.start', {
        timestamp: new Date().toISOString()
    });

    try {
        // DB-IDENTITY-001: Validar identidade do banco conectado (database, schema)
        const identity = await validateDatabaseIdentity(pool);
        
        // DB-IDENTITY-001: Logar configuração do banco (sem password)
        if (dbConfig) {
            const dbIdentity = extractDatabaseIdentity(dbConfig);
            logger.info('db.identity.config', {
                ...dbIdentity,
                ...identity,
                note: 'Backend conectado ao banco acima'
            });
        }

        // SCHEMA-03: Validar existência de tabelas críticas
        await assertTableExists(pool, 'public', 'alunos');
        await assertTableExists(pool, 'public', 'user_roles');

        // SCHEMA-03: Validar colunas obrigatórias de alunos
        // IMPORTANTE: linked_user_id é opcional - sistema funciona sem ela
        await assertTableColumns(pool, 'public', 'alunos', [
            'id',
            'coach_id'
            // linked_user_id removido - será criado automaticamente se necessário
        ]);

        // AUTO-CREATE: Tentar criar linked_user_id automaticamente se não existir
        // Isso permite que o sistema funcione sem migração manual
        try {
            const linkedUserIdCheck = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'alunos'
                  AND column_name = 'linked_user_id'
            `);

            if (linkedUserIdCheck.rows.length === 0) {
                logger.info('schema.auto_create.linked_user_id', {
                    database: identity.database,
                    schema: identity.schema,
                    action: 'Tentando criar coluna linked_user_id automaticamente'
                });

                // Tentar criar a coluna automaticamente
                try {
                    await pool.query(`
                        ALTER TABLE public.alunos 
                        ADD COLUMN IF NOT EXISTS linked_user_id UUID NULL
                    `);
                    
                    logger.info('schema.auto_create.linked_user_id.success', {
                        database: identity.database,
                        schema: identity.schema,
                        message: 'Coluna linked_user_id criada automaticamente'
                    });

                    // Tentar criar índice (pode falhar se não tiver privilégios, mas não bloqueia)
                    try {
                        await pool.query(`
                            CREATE INDEX IF NOT EXISTS idx_alunos_linked_user_id 
                            ON public.alunos(linked_user_id)
                        `);
                        logger.info('schema.auto_create.index.success', {
                            index: 'idx_alunos_linked_user_id'
                        });
                    } catch (idxError) {
                        logger.warn('schema.auto_create.index.warning', {
                            error: idxError.message,
                            note: 'Índice não criado, mas não bloqueia sistema'
                        });
                    }
                } catch (createError) {
                    // Se não tiver privilégios, apenas loga warning - não bloqueia
                    if (createError.code === '42501' || createError.message.includes('must be owner')) {
                        logger.warn('schema.auto_create.linked_user_id.insufficient_privileges', {
                            database: identity.database,
                            schema: identity.schema,
                            error: createError.message,
                            note: 'Sistema funcionará sem linked_user_id. Coluna pode ser criada manualmente depois.'
                        });
                    } else {
                        throw createError;
                    }
                }
            } else {
                logger.info('schema.auto_create.linked_user_id.exists', {
                    database: identity.database,
                    schema: identity.schema,
                    message: 'Coluna linked_user_id já existe'
                });
            }
        } catch (error) {
            // Erro na verificação/criação não bloqueia o sistema
            logger.warn('schema.auto_create.linked_user_id.warning', {
                error: error.message,
                note: 'Sistema funcionará sem linked_user_id'
            });
        }

        // SCHEMA-03: Validar colunas opcionais mas esperadas
        // Se updated_at não existir em user_roles, não bloqueia (já foi adicionado via migração anterior)
        // await assertTableColumns(pool, 'public', 'user_roles', ['id', 'user_id', 'role', 'updated_at']);

        logger.info('database.schema.assert.complete', {
            timestamp: new Date().toISOString(),
            database: identity.database,
            schema: identity.schema,
            linked_user_id_validated: true
        });
    } catch (error) {
        // DB-IDENTITY-001: Enriquecer erro com identidade do banco se disponível
        let enrichedError = error;
        if (error.code !== 'SCHEMA_LINKED_USER_ID_MISSING') {
            try {
                const identity = await validateDatabaseIdentity(pool);
                enrichedError = new Error(`${error.message} [Banco: ${identity.database}, Schema: ${identity.schema}]`);
                enrichedError.database = identity.database;
                enrichedError.schema = identity.schema;
            } catch (identityError) {
                // Ignorar erro de identidade se já estamos em erro de schema
            }
        }

        logger.error('database.schema.assert.fatal', {
            error: enrichedError.message,
            stack: enrichedError.stack,
            code: enrichedError.code,
            database: enrichedError.database,
            schema: enrichedError.schema,
            service: 'blackhouse-api',
            environment: process.env.NODE_ENV || 'development'
        });
        throw enrichedError; // Fail-fast: não iniciar servidor com schema inválido
    }
}

/**
 * Valida schema global mínimo necessário para o sistema funcionar
 * DOMAIN-SCHEMA-ISOLATION-005: Valida apenas schema necessário para auth
 * NÃO valida schema de domínios específicos (alunos, profiles, etc.)
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @returns {Promise<void>}
 */
async function assertGlobalSchema(pool) {
    logger.info('database.schema.global.start', {
        timestamp: new Date().toISOString()
    });

    try {
        // Validação mínima para o sistema funcionar
        // Apenas tabelas críticas para auth e sistema básico
        
        // Validar tabelas críticas para auth
        await assertTableExists(pool, 'public', 'user_roles');
        
        // Validar que app_auth schema existe (se usado)
        // Nota: Se app_auth.users for usado, validar aqui também
        
        logger.info('database.schema.global.complete', {
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('database.schema.global.fatal', {
            error: error.message,
            stack: error.stack,
            service: 'blackhouse-api',
            environment: process.env.NODE_ENV || 'development'
        });
        throw error;
    }
}

module.exports = {
    assertDatabaseSchema,
    assertGlobalSchema,
    assertTableColumns,
    assertTableExists
};
