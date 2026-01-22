/**
 * Script de Backup Parcial via API REST do Supabase
 * 
 * ⚠️ LIMITAÇÕES:
 * - A API REST só exporta DADOS, não estrutura (schema)
 * - Não exporta: tabelas, views, funções, triggers, índices, etc.
 * - Tem limites de paginação (máximo 1000 registros por página)
 * - Não é substituto para pg_dump completo
 * 
 * Use este script APENAS se:
 * 1. Não conseguir fazer backup via pg_dump
 * 2. Precisa apenas exportar dados de tabelas específicas
 * 3. Como último recurso antes de usar o painel
 * 
 * RECOMENDAÇÃO: Use o Painel do Supabase para backup completo
 * https://app.supabase.com/project/cghzttbggklhuyqxzabq
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configurações
const SUPABASE_URL = 'https://cghzttbggklhuyqxzabq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY; // Use anon key ou service role key
const BACKUP_DIR = '/root/backup-supabase';
const OUTPUT_FILE = path.join(BACKUP_DIR, `backup_dados_api_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.json`);

// Lista de tabelas para exportar (ajuste conforme necessário)
// Para obter todas as tabelas, você precisaria acessar o schema 'public'
const TABLES_TO_EXPORT = [
    // Adicione aqui os nomes das tabelas que deseja exportar
    // Exemplo: 'users', 'posts', 'comments', etc.
];

/**
 * Faz requisição HTTP GET para a API REST do Supabase
 */
function apiRequest(tableName, page = 0, pageSize = 1000) {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=${pageSize}&offset=${page * pageSize}`;
        
        const options = {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        https.get(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error(`Erro ao parsear JSON: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Erro HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Exporta todos os dados de uma tabela (com paginação)
 */
async function exportTable(tableName) {
    console.log(`\n📊 Exportando tabela: ${tableName}`);
    
    let allData = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const data = await apiRequest(tableName, page, 1000);
            
            if (data.length === 0) {
                hasMore = false;
            } else {
                allData = allData.concat(data);
                console.log(`  ✅ Página ${page + 1}: ${data.length} registros`);
                
                // Se retornou menos que o limite, é a última página
                if (data.length < 1000) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        } catch (error) {
            console.error(`  ❌ Erro ao exportar página ${page + 1}: ${error.message}`);
            hasMore = false;
        }
    }

    console.log(`  ✅ Total: ${allData.length} registros exportados`);
    return allData;
}

/**
 * Obtém lista de tabelas do schema public
 * 
 * ⚠️ NOTA: A API REST não tem endpoint direto para listar tabelas.
 * Você precisa conhecer os nomes das tabelas ou usar uma query SQL.
 */
async function getTables() {
    // Se você souber as tabelas, liste aqui:
    const knownTables = TABLES_TO_EXPORT;
    
    if (knownTables.length > 0) {
        return knownTables;
    }
    
    console.log('⚠️  Nenhuma tabela especificada. Adicione em TABLES_TO_EXPORT ou use o painel.');
    console.log('💡 Para descobrir tabelas, acesse:');
    console.log('   https://app.supabase.com/project/cghzttbggklhuyqxzabq');
    console.log('   Vá em Table Editor para ver todas as tabelas');
    
    return [];
}

/**
 * Função principal
 */
async function main() {
    console.log('==========================================');
    console.log('  BACKUP PARCIAL VIA API REST SUPABASE');
    console.log('==========================================');
    console.log(`URL: ${SUPABASE_URL}`);
    console.log(`Diretório: ${BACKUP_DIR}`);
    console.log(`Arquivo: ${path.basename(OUTPUT_FILE)}`);
    console.log('');

    // Verificar se SUPABASE_KEY está configurada
    if (!SUPABASE_KEY) {
        console.error('❌ ERRO: SUPABASE_KEY não configurada!');
        console.error('');
        console.error('Configure a variável de ambiente:');
        console.error('  export SUPABASE_KEY="sua-chave-aqui"');
        console.error('');
        console.error('Ou edite este script e adicione diretamente (não recomendado para produção)');
        process.exit(1);
    }

    // Criar diretório se não existir
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Obter lista de tabelas
    const tables = await getTables();
    
    if (tables.length === 0) {
        console.error('❌ Nenhuma tabela para exportar!');
        console.error('');
        console.error('Para usar este script:');
        console.error('1. Edite o arquivo e adicione os nomes das tabelas em TABLES_TO_EXPORT');
        console.error('2. Ou descubra as tabelas no painel do Supabase');
        console.error('3. Ou use o backup completo pelo painel (RECOMENDADO)');
        process.exit(1);
    }

    console.log(`\n📋 Tabelas para exportar: ${tables.length}`);
    tables.forEach(table => console.log(`  - ${table}`));

    // Exportar dados
    const backup = {
        metadata: {
            supabase_url: SUPABASE_URL,
            project_ref: 'cghzttbggklhuyqxzabq',
            export_date: new Date().toISOString(),
            tables_exported: tables,
            note: '⚠️ Este backup contém APENAS DADOS, não estrutura (schema) do banco. Para backup completo, use pg_dump ou o painel do Supabase.'
        },
        data: {}
    };

    for (const table of tables) {
        try {
            const tableData = await exportTable(table);
            backup.data[table] = tableData;
        } catch (error) {
            console.error(`❌ Erro ao exportar tabela ${table}: ${error.message}`);
            backup.data[table] = { error: error.message };
        }
    }

    // Salvar backup
    console.log('\n💾 Salvando backup...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(backup, null, 2));
    const stats = fs.statSync(OUTPUT_FILE);
    
    console.log('');
    console.log('✅✅✅ BACKUP PARCIAL CONCLUÍDO! ✅✅✅');
    console.log(`Arquivo: ${OUTPUT_FILE}`);
    console.log(`Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    console.log('⚠️  IMPORTANTE:');
    console.log('   - Este backup contém APENAS DADOS');
    console.log('   - NÃO contém: estrutura de tabelas, views, funções, triggers, etc.');
    console.log('   - Para backup completo, use o Painel do Supabase:');
    console.log('     https://app.supabase.com/project/cghzttbggklhuyqxzabq');
    console.log('     Database → Backups → Download');
    console.log('');
}

// Executar
main().catch(error => {
    console.error('\n❌ ERRO FATAL:', error);
    process.exit(1);
});
