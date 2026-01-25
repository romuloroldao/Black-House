#!/usr/bin/env node
/**
 * Script para limpar completamente um usuário por email
 * Remove de todas as tabelas: app_auth.users, user_roles, alunos, profiles, etc.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'blackhouse_db',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD,
});

async function cleanupUserByEmail(email) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log(`🔍 Buscando usuário com email: ${email}`);
        
        // 1. Buscar usuário em app_auth.users
        const userResult = await client.query(
            'SELECT id, email FROM app_auth.users WHERE email = $1',
            [email]
        );
        
        if (userResult.rows.length === 0) {
            console.log('✅ Usuário não encontrado em app_auth.users');
            await client.query('COMMIT');
            return;
        }
        
        const userId = userResult.rows[0].id;
        console.log(`📋 ID do usuário encontrado: ${userId}`);
        
        // 2. Buscar roles
        const rolesResult = await client.query(
            'SELECT id, role FROM public.user_roles WHERE user_id = $1',
            [userId]
        );
        console.log(`📋 Roles encontrados: ${rolesResult.rows.length}`);
        
        // 3. Buscar aluno
        const alunoResult = await client.query(
            'SELECT id, nome FROM public.alunos WHERE email = $1',
            [email]
        );
        console.log(`📋 Alunos encontrados: ${alunoResult.rows.length}`);
        
        // 4. Deletar todas as dependências
        console.log('\n🗑️  Iniciando deleção...');
        
        // 4.1. Deletar aluno (e todas suas dependências via cascade ou manualmente)
        if (alunoResult.rows.length > 0) {
            const alunoId = alunoResult.rows[0].id;
            console.log(`   - Deletando aluno ${alunoId}...`);
            
            // Deletar dependências do aluno
            await client.query('DELETE FROM itens_dieta WHERE dieta_id IN (SELECT id FROM dietas WHERE aluno_id = $1)', [alunoId]);
            await client.query('DELETE FROM dietas WHERE aluno_id = $1', [alunoId]);
            await client.query('DELETE FROM alunos_treinos WHERE aluno_id = $1', [alunoId]);
            await client.query('DELETE FROM feedbacks_alunos WHERE aluno_id = $1', [alunoId]);
            await client.query('DELETE FROM fotos_alunos WHERE aluno_id = $1', [alunoId]);
            await client.query('DELETE FROM asaas_payments WHERE aluno_id = $1', [alunoId]);
            await client.query('DELETE FROM asaas_customers WHERE aluno_id = $1', [alunoId]);
            
            await client.query('DELETE FROM public.alunos WHERE id = $1', [alunoId]);
            console.log('   ✅ Aluno deletado');
        }
        
        // 4.2. Deletar profiles
        const profileResult = await client.query('DELETE FROM public.profiles WHERE id = $1 RETURNING id', [userId]);
        console.log(`   ✅ Profiles deletados: ${profileResult.rows.length}`);
        
        // 4.3. Deletar user_roles
        for (const role of rolesResult.rows) {
            await client.query('DELETE FROM public.user_roles WHERE id = $1', [role.id]);
        }
        console.log(`   ✅ User roles deletados: ${rolesResult.rows.length}`);
        
        // 4.4. Deletar app_auth.users (FINALMENTE)
        await client.query('DELETE FROM app_auth.users WHERE id = $1', [userId]);
        console.log('   ✅ Usuário deletado de app_auth.users');
        
        await client.query('COMMIT');
        console.log('\n✅ Usuário limpo completamente!');
        console.log(`📧 Email: ${email}`);
        console.log(`🆔 User ID: ${userId}`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao limpar usuário:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const email = process.argv[2];
    
    if (!email) {
        console.error('❌ Uso: node cleanup-user-by-email.js <email>');
        process.exit(1);
    }
    
    cleanupUserByEmail(email)
        .then(() => {
            console.log('\n✅ Script concluído');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Erro:', error);
            process.exit(1);
        });
}

module.exports = { cleanupUserByEmail };
