#!/usr/bin/env node
/**
 * Smoke test de importação ponta a ponta sobre um PDF real.
 * Usa a import-engine multi-camadas (mesmo fluxo de produção).
 *
 * Uso: node scripts/test-import-real-pdf.js <caminho-do-pdf>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const importEngine = require('../services/import-engine');
const aiService = require('../services/ai.service');

async function main() {
    const file = process.argv[2];
    if (!file) {
        console.error('Uso: node scripts/test-import-real-pdf.js <pdf>');
        process.exit(1);
    }

    const buffer = fs.readFileSync(file);
    console.log(`📄 PDF: ${path.basename(file)} (${(buffer.length / 1024).toFixed(1)} KB)\n`);

    const provider = aiService.getProviderInfo();
    console.log(`Provider IA: ${provider.provider || 'NENHUM'} | Modelo: ${provider.model || '-'}\n`);

    const t0 = Date.now();
    let result;
    try {
        result = await importEngine.process(buffer, {
            fileName: path.basename(file),
            requestId: 'cli-test'
        });
    } catch (err) {
        console.error('❌ Falha:', err.message);
        if (err.details) console.error('Detalhes:', err.details);
        process.exit(err.code === 'SCHEMA_INVALID' ? 4 : 3);
    }
    const ms = Date.now() - t0;
    console.log(`✅ Import-engine concluída em ${ms}ms`);
    console.log(`Fonte: ${result.meta.source} | IA: ${result.meta.aiUsed}`);
    console.log(`OCR: ${result.meta.ocr?.quality}${result.meta.ocr?.likelyScanned ? ' (escaneado)' : ''}\n`);

    const { data, meta, warnings } = result;
    console.log('=== Aluno ===');
    console.log(`  Nome: ${data.aluno?.nome}`);
    console.log(`  Idade: ${data.aluno?.idade ?? '—'} | Peso: ${data.aluno?.peso ?? '—'} | Altura: ${data.aluno?.altura ?? '—'}`);
    console.log(`  Telefone: ${data.aluno?.telefone ?? '—'}`);
    if (meta.confidence?.fields) {
        const f = meta.confidence.fields;
        console.log(`  Confiança — nome: ${(f.nome?.confidence * 100).toFixed(0)}% | idade: ${(f.idade?.confidence * 100).toFixed(0)}% | telefone: ${(f.telefone?.confidence * 100).toFixed(0)}%`);
    }

    console.log('\n=== Dieta ===');
    const refeicoes = data.dieta?.refeicoes || [];
    console.log(`  Refeições: ${refeicoes.length}`);
    refeicoes.forEach((r, idx) => {
        console.log(`  ${idx + 1}. ${r.nome} (${(r.alimentos || []).length} alimentos)`);
    });

    console.log('\n=== Protocolo ===');
    console.log(`  Suplementos: ${(data.suplementos || []).length}`);
    (data.suplementos || []).forEach((s) => console.log(`    - ${s.nome}: ${s.dosagem}`));
    console.log(`  Fármacos: ${(data.farmacos || []).length}`);
    (data.farmacos || []).forEach((f) => console.log(`    - ${f.nome}: ${f.dosagem}`));

    if (meta.extractedTreino) {
        console.log('\n=== Treino (extraído, revisão manual) ===');
        console.log(JSON.stringify(meta.extractedTreino, null, 2).slice(0, 1500));
    }

    console.log(`\n=== Confidence geral: ${meta.confidence?.overall ?? '—'}% ===`);
    if (meta.validation?.fixes?.length) {
        console.log('Correções automáticas:');
        meta.validation.fixes.forEach((fix) => console.log(`  ✓ ${fix}`));
    }
    if (warnings?.length) {
        console.log('\nAvisos:');
        warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    }
}

main().catch((err) => {
    console.error('💥 Erro inesperado:', err);
    process.exit(1);
});
