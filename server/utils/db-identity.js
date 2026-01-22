// DB-IDENTITY-001: Validador de identidade do banco de dados
// Garante que backend e operador humano estão olhando para o MESMO banco
// Elimina risco de migração aplicada em banco diferente

const logger = require('./logger');

/**
 * Extrai informações de identidade do banco (sem expor credenciais)
 * @param {Object} dbConfig - Configuração do banco (host, port, database, user)
 * @returns {Object} Identidade do banco (sem password)
 */
function extractDatabaseIdentity(dbConfig) {
    return {
        host: dbConfig.host || 'N/A',
        port: dbConfig.port || 'N/A',
        database: dbConfig.database || 'N/A',
        user: dbConfig.user || 'N/A',
        // Explicitamente NÃO incluir password
        hasPassword: !!dbConfig.password
    };
}

/**
 * Valida identidade do banco conectado via query runtime
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @returns {Promise<Object>} Identidade do banco (database, schema)
 */
async function validateDatabaseIdentity(pool) {
    try {
        const result = await pool.query(`
            SELECT 
                current_database() AS database,
                current_schema() AS schema
        `);

        if (!result.rows || result.rows.length === 0) {
            throw new Error('Não foi possível obter identidade do banco de dados');
        }

        const identity = {
            database: result.rows[0].database,
            schema: result.rows[0].schema,
            timestamp: new Date().toISOString()
        };

        logger.info('db.identity.validated', {
            ...identity,
            service: 'blackhouse-api',
            environment: process.env.NODE_ENV || 'development'
        });

        return identity;
    } catch (error) {
        logger.error('db.identity.validation_failed', {
            error: error.message,
            stack: error.stack,
            service: 'blackhouse-api',
            environment: process.env.NODE_ENV || 'development'
        });
        throw error;
    }
}

/**
 * Verifica existência de coluna específica no banco conectado
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @param {string} schema - Schema da tabela
 * @param {string} table - Nome da tabela
 * @param {string} column - Nome da coluna
 * @returns {Promise<boolean>} True se coluna existe, False caso contrário
 */
async function checkColumnExists(pool, schema, table, column) {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = $1
              AND table_name = $2
              AND column_name = $3
        `, [schema, table, column]);

        const exists = result.rows.length > 0;
        
        if (exists) {
            logger.info('db.identity.column_exists', {
                schema,
                table,
                column,
                data_type: result.rows[0].data_type,
                database: (await validateDatabaseIdentity(pool)).database
            });
        } else {
            logger.warn('db.identity.column_missing', {
                schema,
                table,
                column,
                database: (await validateDatabaseIdentity(pool)).database
            });
        }

        return exists;
    } catch (error) {
        logger.error('db.identity.column_check_failed', {
            schema,
            table,
            column,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Gera mensagem de erro com instruções claras para verificação manual
 * @param {Object} dbConfig - Configuração do banco
 * @param {Object} identity - Identidade do banco (database, schema)
 * @param {string} missingColumn - Coluna ausente
 * @returns {string} Mensagem de erro detalhada
 */
function generateManualVerificationMessage(dbConfig, identity, missingColumn) {
    const dbIdentity = extractDatabaseIdentity(dbConfig);
    
    return `
================================================================================
ERRO: Coluna '${missingColumn}' não encontrada no banco conectado
================================================================================

IDENTIDADE DO BANCO CONECTADO PELO BACKEND:
  Database: ${identity.database}
  Schema: ${identity.schema}
  Host: ${dbIdentity.host}
  Port: ${dbIdentity.port}
  User: ${dbIdentity.user}

VERIFICAÇÃO MANUAL NECESSÁRIA:
Execute as seguintes queries no MESMO banco conectado pelo backend:

  1. Verificar identidade do banco:
     SELECT current_database(), current_schema();

  2. Verificar existência da coluna:
     SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'alunos'
       AND column_name = 'linked_user_id';

  RESULTADO ESPERADO: 1 row retornada

AÇÃO NECESSÁRIA:
Aplicar migração SQL no banco correto:
  Arquivo: /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql

ATENÇÃO: Se a query #2 retornar 0 rows no banco conectado pelo backend,
         a migração foi aplicada em um banco DIFERENTE ou ainda não foi aplicada.
================================================================================
    `.trim();
}

module.exports = {
    extractDatabaseIdentity,
    validateDatabaseIdentity,
    checkColumnExists,
    generateManualVerificationMessage
};
