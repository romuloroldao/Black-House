/**
 * Camada 1 — OCR / extração textual
 * Extrai texto do PDF, limpa ruído, reconstrói linhas e detecta PDF escaneado.
 */

const pdfParserService = require('../pdf-parser.service');

const MIN_CHARS_PER_PAGE_SCANNED = 80;

function cleanOcrNoise(text) {
    if (!text) return '';
    return text
        // espaços especiais
        .replace(/[\u00A0\u200B\uFEFF]/g, ' ')
        // hífen de quebra de linha: "prote-\nina" → "proteina"
        .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
        // múltiplos espaços (preserva TAB)
        .replace(/[^\S\t\n]+/g, ' ')
        // linhas só com separadores
        .replace(/^[\s\-_|]+$/gm, '')
        .trim();
}

function reconstructBrokenLines(lines) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        let line = (lines[i] || '').trim();
        if (!line) continue;

        // junta linha curta sem pontuação final com a seguinte
        while (
            i + 1 < lines.length &&
            line.length < 28 &&
            !/[.!?:;]$/.test(line) &&
            !/^\d/.test(lines[i + 1]) &&
            !/^Refei[cç][aã]o\s+\d+/i.test(lines[i + 1])
        ) {
            const next = (lines[i + 1] || '').trim();
            if (!next) break;
            if (/^(Kcal|CHO|PTN|LIP|Prot|Carb)/i.test(next)) break;
            line = `${line} ${next}`;
            i += 1;
        }
        out.push(line);
    }
    return out;
}

function enrichTableHints(text) {
    // Preserva TABs sem prefixos que quebram o parser local (COMPLEMENTO, refeições)
    return text;
}

class OcrLayer {
    /**
     * @param {Buffer} pdfBuffer
     * @returns {Promise<Object>}
     */
    async process(pdfBuffer) {
        const structured = await pdfParserService.extractStructured(pdfBuffer);
        const perPageRaw = Array.isArray(structured.perPageText) ? structured.perPageText : [];
        const numPages = structured.numPages || perPageRaw.length || 1;

        const perPageClean = perPageRaw.map((pageText, idx) => {
            const cleaned = cleanOcrNoise(pageText || '');
            const lines = reconstructBrokenLines(cleaned.split('\n'));
            const enriched = enrichTableHints(lines.join('\n'));
            return {
                page: idx + 1,
                raw: pageText || '',
                text: enriched,
                charCount: enriched.length,
                lineCount: lines.length
            };
        });

        const fullText = perPageClean.length > 0
            ? perPageClean.map((p) => `=== PÁGINA ${p.page} ===\n${p.text}`).join('\n\n')
            : cleanOcrNoise(structured.text || '');

        const avgCharsPerPage = numPages > 0
            ? perPageClean.reduce((s, p) => s + p.charCount, 0) / numPages
            : fullText.length;

        const likelyScanned = fullText.trim().length < 50 ||
            (numPages > 0 && avgCharsPerPage < MIN_CHARS_PER_PAGE_SCANNED);

        return {
            text: fullText,
            perPage: perPageClean,
            perPageText: perPageClean.map((p) => p.text),
            numPages,
            likelyScanned,
            avgCharsPerPage,
            info: structured.info || {},
            extractionQuality: likelyScanned ? 'low' : (avgCharsPerPage < 200 ? 'medium' : 'high')
        };
    }
}

module.exports = new OcrLayer();
