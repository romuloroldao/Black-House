// ============================================================================
// VALIDADOR DE SCHEMA CANÔNICO
// ============================================================================
// VPS-BACKEND-CANONICAL-ARCH-001
// Fail-fast no boot para schema crítico
// ============================================================================

const logger = require('./logger');

/**
 * Valida schema canônico no boot (fail-fast)
 * @param {Pool} pool - Pool de conexão PostgreSQL
 * @throws {Error} Se schema não estiver válido
 */
async function assertCanonicalSchema(pool) {
    logger.info('canonical.schema.assert.start', {
        timestamp: new Date().toISOString()
    });
    
    const errors = [];
    
    try {
        // ========================================================================
        // VALIDAR TABELA: public.users
        // ========================================================================
        try {
            await assertTableExists(pool, 'public', 'users');
            await assertTableColumns(pool, 'public', 'users', [
                'id',
                'email',
                'password_hash',
                'role',
                'created_at',
                'updated_at'
            ]);
            
            // Validar constraint de role
            const roleCheck = await pool.query(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND table_name = 'users'
                  AND constraint_type = 'CHECK'
                  AND constraint_name LIKE '%role%'
            `);
            
            if (roleCheck.rows.length === 0) {
                errors.push('Tabela public.users: constraint CHECK para role não encontrada');
            }
            
            logger.info('canonical.schema.assert.users.valid');
        } catch (error) {
            errors.push(`Tabela public.users: ${error.message}`);
        }
        
        // ========================================================================
        // VALIDAR TABELA: public.alunos
        // ========================================================================
        try {
            await assertTableExists(pool, 'public', 'alunos');
            await assertTableColumns(pool, 'public', 'alunos', [
                'id',
                'user_id',
                'coach_id',
                'nome',
                'status',
                'created_at',
                'updated_at'
            ]);
            
            // Validar constraint UNIQUE em user_id
            const userUnique = await pool.query(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND table_name = 'alunos'
                  AND constraint_type = 'UNIQUE'
                  AND constraint_name LIKE '%user_id%'
            `);
            
            if (userUnique.rows.length === 0) {
                errors.push('Tabela public.alunos: constraint UNIQUE em user_id não encontrada');
            }
            
            logger.info('canonical.schema.assert.alunos.valid');
        } catch (error) {
            errors.push(`Tabela public.alunos: ${error.message}`);
        }
        
        // ========================================================================
        // VALIDAR TABELA: public.mensagens
        // ========================================================================
        try {
            await assertTableExists(pool, 'public', 'mensagens');
            await assertTableColumns(pool, 'public', 'mensagens', [
                'id',
                'aluno_id',
                'sender_role',
                'sender_user_id',
                'conteudo',
                'lida',
                'created_at'
            ]);
            
            // Validar constraint CHECK em sender_role
            const senderRoleCheck = await pool.query(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND table_name = 'mensagens'
                  AND constraint_type = 'CHECK'
                  AND constraint_name LIKE '%sender_role%'
            `);
            
            if (senderRoleCheck.rows.length === 0) {
                errors.push('Tabela public.mensagens: constraint CHECK para sender_role não encontrada');
            }
            
            logger.info('canonical.schema.assert.mensagens.valid');
        } catch (error) {
            errors.push(`Tabela public.mensagens: ${error.message}`);
        }
        
        // ========================================================================
        // VALIDAR TABELA: public.uploads
        // ========================================================================
        try {
            await assertTableExists(pool, 'public', 'uploads');
            await assertTableColumns(pool, 'public', 'uploads', [
                'id',
                'owner_user_id',
                'type',
                'path',
                'created_at'
            ]);
            
            // Validar constraint CHECK em type
            const typeCheck = await pool.query(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND table_name = 'uploads'
                  AND constraint_type = 'CHECK'
                  AND constraint_name LIKE '%type%'
            `);
            
            if (typeCheck.rows.length === 0) {
                errors.push('Tabela public.uploads: constraint CHECK para type não encontrada');
            }
            
            logger.info('canonical.schema.assert.uploads.valid');
        } catch (error) {
            errors.push(`Tabela public.uploads: ${error.message}`);
        }
        
        // ========================================================================
        // RESULTADO FINAL
        // ========================================================================
        if (errors.length > 0) {
            const errorMessage = `Schema canônico inválido:\n${errors.join('\n')}\n\nAplicar schema_canonico_vps.sql antes de iniciar o servidor.`;
            logger.error('canonical.schema.assert.failed', {
                errors: errors,
                count: errors.length
            });
            throw new Error(errorMessage);
        }
        
        logger.info('canonical.schema.assert.success', {
            tables: ['users', 'alunos', 'mensagens', 'uploads']
        });
        
    } catch (error) {
        if (error.message.includes('Schema canônico inválido')) {
            throw error; // Re-throw schema errors
        }
        logger.error('canonical.schema.assert.error', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Assert que uma tabela existe
 */
async function assertTableExists(pool, schema, table) {
    const result = await pool.query(`
        SELECT table_type
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
    `, [schema, table]);
    
    if (result.rows.length === 0) {
        throw new Error(`Tabela ${schema}.${table} não existe`);
    }
}

/**
 * Assert que colunas existem
 */
async function assertTableColumns(pool, schema, table, requiredColumns) {
    const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
    `, [schema, table]);
    
    const existingColumns = new Set(result.rows.map(r => r.column_name));
    const missingColumns = requiredColumns.filter(col => !existingColumns.has(col));
    
    if (missingColumns.length > 0) {
        throw new Error(`Colunas faltando: ${missingColumns.join(', ')}`);
    }
}

module.exports = {
    assertCanonicalSchema
};
