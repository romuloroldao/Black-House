/**
 * Aplica apenas o patch de nutrição/unidade (sem reexecutar o schema completo).
 * Uso: a partir da raiz do repo — npm run db:migrate
 * Requer variáveis DB_* em server/.env (igual ao index.js).
 */
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PATCH_FILES = [
    '20260216_nutrition_precision_patch.sql',
    '20260519_equivalencia_alimentar_grupos.sql',
];

async function main() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    await client.connect();
    try {
        for (const file of PATCH_FILES) {
            const sqlPath = path.join(__dirname, '..', 'migrations', file);
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`➡️ Aplicando patch: ${file}`);
            try {
                await client.query(sql);
            } catch (err) {
                console.warn(`⚠️ Patch ${file} ignorado: ${err.message}`);
                console.warn('   Execute como owner da BD ou rode: npm run db:seed-equivalencia');
            }
        }
        console.log('✅ Patches processados');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('❌ Erro ao aplicar patch:', err.message);
    process.exit(1);
});
