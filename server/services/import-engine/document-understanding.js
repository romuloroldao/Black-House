/**
 * Camada 2 — Compreensão documental
 * Identifica seções, hierarquia e contexto sem depender de coordenadas fixas.
 */

const { SECTION_ANCHORS } = require('./constants');

function scoreLineForSection(line, sectionId) {
    const anchor = SECTION_ANCHORS.find((s) => s.id === sectionId);
    if (!anchor) return 0;
    let score = 0;
    for (const p of anchor.patterns) {
        if (p.test(line)) score += 2;
    }
    return score;
}

function detectDominantSection(line) {
    let best = { id: 'geral', score: 0 };
    for (const { id } of SECTION_ANCHORS) {
        const s = scoreLineForSection(line, id);
        if (s > best.score) best = { id, score: s };
    }
    return best.score > 0 ? best.id : 'geral';
}

/**
 * Segmenta o documento em blocos por seção semântica.
 * @param {string} fullText
 * @returns {{ sections: Object, outline: Array, hints: Object }}
 */
function analyze(fullText) {
    const lines = (fullText || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const sections = {
        dados_pessoais: [],
        dieta: [],
        treino: [],
        suplementacao: [],
        farmacos: [],
        hormonios: [],
        observacoes: [],
        exames: [],
        geral: []
    };

    const outline = [];
    let currentSection = 'geral';

    for (const line of lines) {
        const detected = detectDominantSection(line);
        if (detected !== 'geral' && detected !== currentSection) {
            // mudança de seção — só troca se linha parece cabeçalho forte
            const isHeader = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9]/.test(line) && line.length < 120;
            if (isHeader || scoreLineForSection(line, detected) >= 2) {
                currentSection = detected;
                outline.push({ section: currentSection, line: line.slice(0, 120) });
            }
        }
        (sections[currentSection] || sections.geral).push(line);
    }

    const hasPlanoAlimentar = /\bPLANO\s+ALIMENTAR\b/i.test(fullText);
    const hasTreino = sections.treino.length > 3 || /\b(plano\s+de\s+treino|divis[aã]o\s+[abc])\b/i.test(fullText);
    const hasProtocolo = sections.suplementacao.length > 0 ||
        sections.farmacos.length > 0 ||
        sections.hormonios.length > 0;

    const hints = {
        hasPlanoAlimentar,
        hasTreino,
        hasProtocolo,
        estimatedMeals: (fullText.match(/Refei[cç][aã]o\s+\d+/gi) || []).length,
        pageMarkers: (fullText.match(/=== PÁGINA \d+ ===/g) || []).length
    };

    return { sections, outline, hints, lineCount: lines.length };
}

/**
 * Monta contexto estruturado para o prompt da IA.
 */
function buildStructuredContext(docAnalysis, ocrResult) {
    const parts = [];
    const order = ['dados_pessoais', 'dieta', 'treino', 'suplementacao', 'farmacos', 'hormonios', 'observacoes', 'exames'];

    parts.push('=== MAPA DO DOCUMENTO (segmentação automática) ===');
    parts.push(`Qualidade OCR: ${ocrResult.extractionQuality}${ocrResult.likelyScanned ? ' [PDF possivelmente escaneado — use layout visual do PDF]' : ''}`);
    parts.push(`Plano alimentar detectado: ${docAnalysis.hints.hasPlanoAlimentar ? 'sim' : 'não'}`);
    parts.push(`Treino detectado: ${docAnalysis.hints.hasTreino ? 'sim' : 'não'}`);
    parts.push(`Protocolo (sup/fármacos) detectado: ${docAnalysis.hints.hasProtocolo ? 'sim' : 'não'}`);
    parts.push('');

    for (const key of order) {
        const lines = docAnalysis.sections[key] || [];
        if (lines.length === 0) continue;
        parts.push(`--- SEÇÃO: ${key.toUpperCase()} (${lines.length} linhas) ---`);
        parts.push(lines.join('\n'));
        parts.push('');
    }

    const geral = docAnalysis.sections.geral || [];
    if (geral.length > 0) {
        parts.push('--- SEÇÃO: GERAL / NÃO CLASSIFICADO ---');
        parts.push(geral.join('\n'));
    }

    return parts.join('\n');
}

module.exports = {
    analyze,
    buildStructuredContext
};
