#!/usr/bin/env node
/**
 * Reimporta dieta de um PDF para aluno já cadastrado (sem duplicar aluno).
 *
 * Uso:
 *   node server/scripts/reimport-diet-from-pdf.js --email aluno@email.com --pdf /caminho/ficha.pdf
 *   node server/scripts/reimport-diet-from-pdf.js --aluno-id <uuid> --pdf /caminho/ficha.pdf
 *   node server/scripts/reimport-diet-from-pdf.js --dir /pasta/pdfs   # nome do ficheiro = email (antes do .pdf)
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { parseStudentPDF } = require('../parse-pdf-local');
const importEngine = require('../services/import-engine');
const { safeValidateDietOnly } = require('../schemas/import-schema');
const AlimentoRepository = require('../repositories/alimento.repository');
const TipoAlimentoRepository = require('../repositories/tipo-alimento.repository');
const DietRepository = require('../repositories/diet.repository');
const FoodMatchingService = require('../services/food-matching.service');
const DietService = require('../services/diet.service');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
    const out = { email: null, alunoId: null, pdf: null, dir: null, coachId: null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--email') out.email = argv[++i];
        else if (a === '--aluno-id') out.alunoId = argv[++i];
        else if (a === '--pdf') out.pdf = argv[++i];
        else if (a === '--dir') out.dir = argv[++i];
        else if (a === '--coach-id') out.coachId = argv[++i];
    }
    return out;
}

async function resolveAlunoId(client, { email, alunoId }) {
    if (alunoId) {
        const r = await client.query('SELECT id, email, nome FROM public.alunos WHERE id = $1', [alunoId]);
        if (!r.rows[0]) throw new Error(`Aluno não encontrado: ${alunoId}`);
        return r.rows[0];
    }
    if (!email) throw new Error('Informe --email ou --aluno-id');
    const r = await client.query(
        'SELECT id, email, nome FROM public.alunos WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
        [email],
    );
    if (!r.rows[0]) throw new Error(`Aluno não encontrado com email: ${email}`);
    return r.rows[0];
}

async function reimportOne(client, alunoRow, pdfPath, coachUserId) {
    const buf = fs.readFileSync(pdfPath);
    const parsed = await parseStudentPDF(buf);
    if (!parsed?.dieta?.refeicoes?.length) {
        throw new Error(`PDF sem refeições reconhecidas: ${pdfPath}`);
    }

    // Secção COMPLEMENTO (suplementos/fármacos) nem sempre vem no parseStudentPDF — import-engine cobre.
    if (!(parsed.suplementos?.length || parsed.farmacos?.length)) {
        try {
            const engine = await importEngine.process(buf, {
                fileName: path.basename(pdfPath),
                requestId: `reimport-${Date.now()}`,
            });
            parsed.suplementos = engine?.data?.suplementos || [];
            parsed.farmacos = engine?.data?.farmacos || [];
        } catch (engineErr) {
            console.warn(`⚠ Protocolo não extraído de ${pdfPath}: ${engineErr.message}`);
        }
    }

    const payload = {
        aluno_id: alunoRow.id,
        dieta: parsed.dieta,
        suplementos: parsed.suplementos || [],
        farmacos: parsed.farmacos || [],
    };
    const validation = safeValidateDietOnly(payload);
    if (!validation.success) {
        const msg = (validation.errors || []).map((e) => e.message).join('; ');
        throw new Error(`Validação falhou: ${msg}`);
    }

    const alimentoRepo = new AlimentoRepository({ query: client.query.bind(client) });
    const tipoAlimentoRepo = new TipoAlimentoRepository(client.query.bind(client));
    const dietRepo = new DietRepository({ query: client.query.bind(client) });
    const foodMatching = new FoodMatchingService(alimentoRepo, tipoAlimentoRepo);
    const dietService = new DietService(dietRepo, foodMatching);

    const dietaPayload = {
        ...validation.data.dieta,
        suplementos: validation.data.suplementos || [],
        farmacos: validation.data.farmacos || [],
    };

    const result = await dietService.createDietaCompleta(
        dietaPayload,
        alunoRow.id,
        coachUserId,
    );

    return result;
}

async function main() {
    const args = parseArgs(process.argv);
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'blackhouse_db',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });

    await client.connect();

    const coachRes = await client.query(
        `SELECT u.id FROM app_auth.users u
         JOIN public.user_roles ur ON ur.user_id = u.id
         WHERE ur.role IN ('coach', 'admin')
         ORDER BY CASE WHEN ur.role = 'admin' THEN 0 ELSE 1 END
         LIMIT 1`,
    );
    const coachUserId = args.coachId || coachRes.rows[0]?.id;
    if (!coachUserId) {
        throw new Error('Nenhum coach/admin encontrado; use --coach-id');
    }

    const jobs = [];
    if (args.dir) {
        const files = fs.readdirSync(args.dir).filter((f) => f.toLowerCase().endsWith('.pdf'));
        for (const f of files) {
            const email = path.basename(f, path.extname(f)).replace(/_/g, '@').includes('@')
                ? path.basename(f, path.extname(f)).replace(/_/g, '.')
                : null;
            jobs.push({ pdf: path.join(args.dir, f), email });
        }
    } else if (args.pdf) {
        jobs.push({ pdf: args.pdf, email: args.email, alunoId: args.alunoId });
    } else {
        throw new Error('Informe --pdf ou --dir');
    }

    let ok = 0;
    let fail = 0;

    for (const job of jobs) {
        try {
            await client.query('BEGIN');
            const aluno = await resolveAlunoId(client, job);
            const result = await reimportOne(client, aluno, job.pdf, coachUserId);
            await client.query('COMMIT');
            ok++;
            console.log(
                `✅ ${aluno.email} → dieta ${result.dieta.id} (${result.stats.itens_criados} itens)`,
            );
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            fail++;
            console.error(`❌ ${job.pdf}: ${err.message}`);
        }
    }

    await client.end();
    console.log(`\nConcluído: ${ok} sucesso, ${fail} falha(s).`);
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
});
