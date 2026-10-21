// VALIDADOR DE SCHEMA 


const logger = require('./logger');

/**
 * Valida schema no boot (fail-fast)
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @throws {Error} Se schema não estiver válido
 */
async function assertFullSchema(pool) {
  const client = await pool.connect();

  try {
    logger.info('SCHEMA: Iniciando validação estrutural...');


    //Verifica schema app_auth

    const schemaCheck = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'app_auth'
    `);

    if (schemaCheck.rowCount === 0) {
      throw new Error('Schema "app_auth" não encontrado');
    }


    // Tabelas obrigatórias

    const requiredTables = [
      { schema: 'app_auth', table: 'users' },
      { schema: 'app_auth', table: 'sessions' },
      { schema: 'public', table: 'user_roles' },
      { schema: 'public', table: 'alunos' },
      { schema: 'public', table: 'conversas' },
      { schema: 'public', table: 'mensagens' },
    ];

    for (const { schema, table } of requiredTables) {
      const result = await client.query(
        `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
        AND table_name = $2
        `,
        [schema, table]
      );

      if (result.rowCount === 0) {
        throw new Error(`Tabela obrigatória ausente: ${schema}.${table}`);
      }
    }


    // Enum user_role

    const enumCheck = await client.query(`
      SELECT 1
      FROM pg_type
      WHERE typname = 'user_role'
    `);

    if (enumCheck.rowCount === 0) {
      throw new Error('Enum "user_role" não encontrado');
    }

    //login
    const functionCheck = await client.query(`
      SELECT 1
      FROM pg_proc
      WHERE proname = 'login'
      AND pronamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = 'app_auth'
      )
    `);

    if (functionCheck.rowCount === 0) {
      throw new Error('Função app_auth.login não encontrada');
    }

    logger.info('SCHEMA: Estrutura validada com sucesso.');
  } catch (err) {
    logger.error('SCHEMA: Falha estrutural detectada.');
    logger.error(err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { assertFullSchema };

