#!/usr/bin/env node
/**
 * Benchmark das fichas-modelo em /root/black/
 * Uso: node scripts/benchmark-black-fichas.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const BLACK_DIR = path.join(__dirname, '..', '..', 'black');
const importEngine = require('../services/import-engine');

async function main() {
    const pdfs = fs.readdirSync(BLACK_DIR).filter((f) => f.endsWith('.pdf')).sort();
    if (pdfs.length === 0) {
        console.error('Nenhum PDF em', BLACK_DIR);
        process.exit(1);
    }

    console.log(`📁 Benchmark: ${pdfs.length} fichas em ${BLACK_DIR}\n`);
    const rows = [];

    for (const file of pdfs) {
        const buffer = fs.readFileSync(path.join(BLACK_DIR, file));
        const t0 = Date.now();
        let result;
        let err = null;
        try {
            result = await importEngine.process(buffer, { fileName: file, requestId: `bench-${file}` });
        } catch (e) {
            err = e.message;
        }
        const ms = Date.now() - t0;

        if (err) {
            rows.push({ file, err, ms });
            continue;
        }

        const { data, meta } = result;
        const refeicoes = data.dieta?.refeicoes || [];
        const alimentos = refeicoes.reduce((a, r) => a + (r.alimentos?.length || 0), 0);

        rows.push({
            file,
            ms,
            source: meta.source,
            confidence: meta.confidence?.overall,
            nome: data.aluno?.nome,
            idade: data.aluno?.idade,
            peso: data.aluno?.peso,
            refeicoes: refeicoes.length,
            alimentos,
            suplementos: (data.suplementos || []).length,
            farmacos: (data.farmacos || []).length,
            orientacoes: data.orientacoes ? 'sim' : 'não'
        });
    }

    console.log('| Ficha | Nome | Conf. | Ref. | Alim. | Sup. | Fár. | ms |');
    console.log('|-------|------|-------|------|-------|------|------|-----|');
    for (const r of rows) {
        if (r.err) {
            console.log(`| ${r.file} | ERRO: ${r.err.slice(0, 40)} |`);
            continue;
        }
        console.log(
            `| ${r.file.slice(0, 28)} | ${(r.nome || '').slice(0, 18)} | ${r.confidence}% | ${r.refeicoes} | ${r.alimentos} | ${r.suplementos} | ${r.farmacos} | ${r.ms} |`
        );
    }

    const ok = rows.filter((r) => !r.err);
    const avgConf = ok.reduce((s, r) => s + r.confidence, 0) / (ok.length || 1);
    const avgFoods = ok.reduce((s, r) => s + r.alimentos, 0) / (ok.length || 1);
    console.log(`\n✅ ${ok.length}/${rows.length} OK | Confiança média: ${avgConf.toFixed(0)}% | Média alimentos: ${avgFoods.toFixed(1)}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
