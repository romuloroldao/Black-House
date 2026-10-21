/**
 * Camada 5 — Confidence score por campo e global.
 */

const { CONFIDENCE_THRESHOLD_REVIEW, CONFIDENCE_THRESHOLD_LOW } = require('./constants');
const { isPlausibleStudentName } = require('./validation-layer');

function fieldScore(value, checks) {
    let score = 0;
    let weight = 0;
    for (const { fn, w } of checks) {
        weight += w;
        if (fn(value)) score += w;
    }
    return weight > 0 ? score / weight : 0;
}

function wrapField(value, confidence, notes = null) {
    const out = { valor: value, confidence: Math.round(confidence * 100) / 100 };
    if (notes) out.notes = notes;
    if (confidence < CONFIDENCE_THRESHOLD_REVIEW) out.revisar = true;
    return out;
}

/**
 * @param {Object} data - dados validados
 * @param {Object} context - { docAnalysis, ocrResult, validationResult, aiUsed }
 */
function evaluate(data, context = {}) {
    const warnings = [...(context.validationResult?.issues || [])];
    const fields = {};
    const aluno = data?.aluno || {};

    // Nome
    const nomeConf = isPlausibleStudentName(aluno.nome)
        ? (/\s/.test(aluno.nome) ? 0.95 : 0.7)
        : 0.25;
    fields.nome = wrapField(aluno.nome, nomeConf, nomeConf < CONFIDENCE_THRESHOLD_REVIEW ? 'Nome suspeito' : null);
    if (nomeConf < CONFIDENCE_THRESHOLD_REVIEW) {
        warnings.push('Nome do aluno com baixa confiança — revise antes de salvar.');
    }

    fields.telefone = wrapField(
        aluno.telefone || null,
        aluno.telefone && /^\(\d{2}\)/.test(aluno.telefone) ? 0.9 : (aluno.telefone ? 0.6 : 0.3)
    );

    fields.idade = wrapField(
        aluno.idade,
        aluno.idade != null && aluno.idade >= 14 && aluno.idade <= 80 ? 0.92 : (aluno.idade ? 0.5 : 0.2)
    );

    fields.peso = wrapField(
        aluno.peso,
        fieldScore(aluno.peso, [
            { fn: (v) => v != null, w: 1 },
            { fn: (v) => v >= 40 && v <= 200, w: 2 }
        ])
    );

    fields.altura = wrapField(
        aluno.altura,
        fieldScore(aluno.altura, [
            { fn: (v) => v != null, w: 1 },
            { fn: (v) => v >= 140 && v <= 220, w: 2 }
        ])
    );

    // Dieta
    const refeicoes = data?.dieta?.refeicoes || [];
    const totalAlimentos = refeicoes.reduce((a, r) => a + (r.alimentos?.length || 0), 0);
    let dietaScore = 0;
    if (refeicoes.length > 0) {
        dietaScore = Math.min(refeicoes.length / 5, 1) * 0.35 +
            Math.min(totalAlimentos / Math.max(refeicoes.length * 3, 1), 1) * 0.45 +
            (context.docAnalysis?.hints?.hasPlanoAlimentar ? 0.2 : 0.1);
    }
    fields.dieta = wrapField(
        { refeicoes: refeicoes.length, alimentos: totalAlimentos },
        Math.min(dietaScore, 1)
    );
    if (refeicoes.length < 3 && context.docAnalysis?.hints?.hasPlanoAlimentar) {
        warnings.push('Plano alimentar detectado mas poucas refeições extraídas — possível perda de dados.');
    }

    // Protocolo
    const protocolItems = [...(data?.suplementos || []), ...(data?.farmacos || [])];
    const protocolScore = protocolItems.length === 0
        ? null
        : protocolItems.filter((i) => i.dosagem?.trim()).length / protocolItems.length;

    // OCR quality penalty
    let ocrMultiplier = 1;
    if (context.ocrResult?.likelyScanned) ocrMultiplier = 0.85;
    if (context.ocrResult?.extractionQuality === 'low') ocrMultiplier = Math.min(ocrMultiplier, 0.75);

    const sectionScores = {
        aluno: Math.round(((nomeConf + (fields.idade.confidence) + (fields.peso.confidence)) / 3) * 100 * ocrMultiplier),
        dieta: Math.round((fields.dieta.confidence) * 100 * ocrMultiplier),
        protocolo: protocolScore !== null ? Math.round(protocolScore * 100) : null,
        paginas: context.ocrResult?.numPages > 1
            ? (context.ocrResult?.perPage?.length > 1 ? 90 : 60)
            : 100
    };

    const weights = [
        { w: 2, s: sectionScores.aluno },
        { w: 5, s: sectionScores.dieta }
    ];
    if (sectionScores.protocolo !== null) weights.push({ w: 1, s: sectionScores.protocolo });
    if (sectionScores.paginas !== null) weights.push({ w: 0.5, s: sectionScores.paginas });

    const wSum = weights.reduce((a, c) => a + c.w, 0);
    const overall = Math.round(
        (weights.reduce((a, c) => a + c.w * c.s, 0) / wSum) * ocrMultiplier
    );

    const lowConfidenceFields = Object.entries(fields)
        .filter(([, v]) => v.confidence < CONFIDENCE_THRESHOLD_REVIEW)
        .map(([k]) => k);

    if (lowConfidenceFields.length > 0) {
        warnings.push(`Campos com baixa confiança: ${lowConfidenceFields.join(', ')}`);
    }

    return {
        overall: Math.max(0, Math.min(100, overall)),
        sections: sectionScores,
        fields,
        warnings: [...new Set(warnings)],
        thresholds: {
            review: CONFIDENCE_THRESHOLD_REVIEW,
            low: CONFIDENCE_THRESHOLD_LOW
        },
        meta: {
            refeicoes: refeicoes.length,
            alimentos: totalAlimentos,
            suplementos: (data?.suplementos || []).length,
            farmacos: (data?.farmacos || []).length,
            aiUsed: !!context.aiUsed,
            extractionQuality: context.ocrResult?.extractionQuality,
            likelyScanned: !!context.ocrResult?.likelyScanned,
            fixes: context.validationResult?.fixes || []
        }
    };
}

module.exports = { evaluate };
