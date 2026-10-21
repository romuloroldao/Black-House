// Script para importar dados da TACO no banco de dados
// Executa a migração SQL de importação de alimentos

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Carregar variáveis de ambiente
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'blackhouse_db',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD,
    min: 1,
    max: 1, // Apenas uma conexão para script
});

async function importTacoData() {
    const client = await pool.connect();
    
    try {
        console.log('📊 Iniciando importação de dados TACO...\n');
        
        // Ler arquivo SQL da migração
        const migrationPath = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260115180000_import_taco_completo.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Verificar quantos alimentos já existem
        const countBefore = await client.query('SELECT COUNT(*) as count FROM alimentos');
        console.log(`📋 Alimentos antes da importação: ${countBefore.rows[0].count}`);
        
        // Verificar tipos disponíveis
        const tipos = await client.query('SELECT id, nome_tipo FROM tipos_alimentos ORDER BY nome_tipo');
        console.log(`📂 Tipos de alimentos disponíveis: ${tipos.rows.length}`);
        tipos.rows.forEach(tipo => {
            console.log(`   - ${tipo.nome_tipo} (${tipo.id})`);
        });
        
        console.log('\n🔄 Executando importação...');
        
        // Executar migração
        await client.query('BEGIN');
        
        try {
            // Dividir SQL em statements (removendo comentários e linhas vazias)
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
            
            let insertedCount = 0;
            
            for (const statement of statements) {
                if (statement.includes('INSERT INTO alimentos')) {
                    // Executar INSERT e contar inserções
                    const result = await client.query(statement);
                    const count = result.rowCount || 0;
                    insertedCount += count;
                    if (count > 0) {
                        console.log(`   ✅ ${count} alimento(s) inserido(s)`);
                    }
                } else {
                    // Executar outros statements (SELECT, etc.)
                    await client.query(statement);
                }
            }
            
            await client.query('COMMIT');
            
            console.log(`\n✅ Importação concluída! ${insertedCount} alimento(s) inserido(s)`);
            
            // Verificar quantos alimentos existem agora
            const countAfter = await client.query('SELECT COUNT(*) as count FROM alimentos');
            console.log(`📋 Total de alimentos no banco: ${countAfter.rows[0].count}`);
            
            // Mostrar contagem por tipo
            const byType = await client.query(`
                SELECT t.nome_tipo, COUNT(a.id) as count
                FROM tipos_alimentos t
                LEFT JOIN alimentos a ON a.tipo_id = t.id
                GROUP BY t.nome_tipo
                ORDER BY t.nome_tipo
            `);
            
            console.log('\n📊 Alimentos por tipo:');
            byType.rows.forEach(row => {
                console.log(`   - ${row.nome_tipo}: ${row.count} alimento(s)`);
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Erro ao importar dados TACO:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Executar importação
importTacoData()
    .then(() => {
        console.log('\n🎉 Processo concluído com sucesso!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Erro fatal:', error);
        process.exit(1);
    });
