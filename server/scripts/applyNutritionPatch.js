/**
 * Aplica patches SQL incrementais (um ficheiro = uma transacção).
 * Patches já registados em public.schema_patches são ignorados.
 *
 * Uso: npm run db:migrate
 * Requer variáveis DB_* em server/.env (igual ao index.js).
 */
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PATCH_FILES = [
    '20260216_nutrition_precision_patch.sql',
    '20260519_equivalencia_alimentar_grupos.sql',
    '20260526_checkin_coach_respondido.sql',
    '20260527_checkin_relato_search.sql',
    '20260528_importacoes_historico.sql',
    '20260529_checkin_coach_resposta.sql',
    '20260529_video_categorias_rename.sql',
    '20260530_educational_contents.sql',
    '20260607_educational_contents_grants.sql',
    '20260609_treino_copia_aluno.sql',
    '20260611_treino_atribuicoes_para_copias.sql',
    '20260623_financial_sync_architecture.sql',
    '20260623_student_body_metrics.sql',
    '20260623_smart_reminders.sql',
];

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS public.schema_patches (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);
`;

/** Ficheiros que já gerem BEGIN/COMMIT internamente — não envolver noutra transacção. */
function sqlManagesOwnTransaction(sql) {
    return /\bBEGIN\s*;/i.test(sql);
}

async function safeRollback(client) {
    try {
        await client.query('ROLLBACK');
    } catch {
        /* transacção já fechada (ex.: COMMIT interno no SQL) */
    }
}

async function recordPatch(client, filename) {
    await client.query(
        `INSERT INTO public.schema_patches (filename)
         VALUES ($1)
         ON CONFLICT (filename) DO NOTHING`,
        [filename],
    );
}

async function isPatchApplied(client, filename) {
    const r = await client.query(
        'SELECT 1 FROM public.schema_patches WHERE filename = $1 LIMIT 1',
        [filename],
    );
    return r.rows.length > 0;
}

/**
 * @returns {'applied'|'skipped'|'failed'}
 */
async function applyOnePatch(client, filename) {
    const sqlPath = path.join(MIGRATIONS_DIR, filename);
    if (!fs.existsSync(sqlPath)) {
        console.warn(`⚠️ Ficheiro inexistente: ${filename}`);
        return 'failed';
    }

    if (await isPatchApplied(client, filename)) {
        console.log(`⏭️  Já aplicado: ${filename}`);
        return 'skipped';
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const ownTx = sqlManagesOwnTransaction(sql);

    console.log(`➡️ Aplicando patch: ${filename}${ownTx ? ' (transacção interna)' : ''}`);

    if (ownTx) {
        try {
            await client.query(sql);
            await recordPatch(client, filename);
            console.log(`✅ ${filename}`);
            return 'applied';
        } catch (err) {
            await safeRollback(client);
            console.warn(`⚠️ Patch ${filename} falhou: ${err.message}`);
            console.warn('   Execute como owner da BD ou rode: npm run db:seed-equivalencia');
            return 'failed';
        }
    }

    await client.query('BEGIN');
    try {
        await client.query(sql);
        await recordPatch(client, filename);
        await client.query('COMMIT');
        console.log(`✅ ${filename}`);
        return 'applied';
    } catch (err) {
        await safeRollback(client);
        console.warn(`⚠️ Patch ${filename} falhou (rollback deste ficheiro): ${err.message}`);
        console.warn('   Execute como owner da BD ou rode: npm run db:seed-equivalencia');
        return 'failed';
    }
}

async function main() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    await client.connect();

    const summary = { applied: 0, skipped: 0, failed: 0, failedFiles: [] };

    try {
        await client.query(BOOTSTRAP_SQL);

        for (const file of PATCH_FILES) {
            const result = await applyOnePatch(client, file);
            summary[result === 'failed' ? 'failed' : result]++;
            if (result === 'failed') summary.failedFiles.push(file);
        }

        console.log('');
        console.log(
            `📋 Resumo: ${summary.applied} aplicados, ${summary.skipped} ignorados (já feitos), ${summary.failed} falharam`,
        );

        if (summary.failed > 0) {
            console.error(`❌ Patches com falha: ${summary.failedFiles.join(', ')}`);
            process.exitCode = 1;
        } else {
            console.log('✅ Patches processados');
        }
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('❌ Erro ao aplicar patches:', err.message);
    process.exit(1);
});
