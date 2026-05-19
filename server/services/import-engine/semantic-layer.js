/**
 * Camada 3 — Interpretação semântica (IA + fallback local estruturado).
 */

const aiService = require('../ai.service');
const logger = require('../../utils/logger');
const { getExtractionSystemPrompt, getExtractionUserPrompt } = require('./prompts');
const { buildStructuredContext } = require('./document-understanding');

class SemanticLayer {
    /**
     * @param {Object} params
     * @param {Object} params.ocrResult
     * @param {Object} params.docAnalysis
     * @param {Buffer} params.pdfBuffer
     * @param {string} params.fileName
     */
    async extract({ ocrResult, docAnalysis, pdfBuffer, fileName }) {
        const requestId = `import-${Date.now()}`;
        let aiUsed = false;
        let source = 'none';

        // 1) Parser local estruturado — só quando plano alimentar claro e texto bom
        if (docAnalysis.hints.hasPlanoAlimentar && !ocrResult.likelyScanned) {
            try {
                const { parseNutritionPlanText } = require('../../parse-pdf-local');
                const local = parseNutritionPlanText(ocrResult.text);
                if (local?.dieta?.refeicoes?.length >= 3) {
                    logger.info('IMPORT-ENGINE: parser local estruturado (alta confiança)', {
                        requestId,
                        fileName,
                        refeicoes: local.dieta.refeicoes.length
                    });
                    return { raw: local, aiUsed: false, source: 'local_structured' };
                }
            } catch (err) {
                logger.warn('IMPORT-ENGINE: parser local falhou', { error: err.message });
            }
        }

        // 2) IA com contexto segmentado
        if (aiService.isAvailable()) {
            aiUsed = true;
            source = 'ai';
            const structuredContext = buildStructuredContext(docAnalysis, ocrResult);
            const systemPrompt = getExtractionSystemPrompt();
            const userPrompt = getExtractionUserPrompt(structuredContext);

            // Preferir multimodal em PDF escaneado ou baixa qualidade
            const useMultimodal = ocrResult.likelyScanned ||
                ocrResult.extractionQuality === 'low';

            const aiInput = ocrResult.perPageText?.length > 0
                ? ocrResult.perPageText
                : ocrResult.text;

            try {
                const raw = await aiService.extractStructuredData(
                    aiInput,
                    useMultimodal ? pdfBuffer : null,
                    { systemPrompt, userPrompt }
                );
                return { raw, aiUsed: true, source: 'ai' };
            } catch (aiError) {
                logger.error('IMPORT-ENGINE: IA falhou, tentando fallback local', {
                    error: aiError.message,
                    fileName
                });
            }
        }

        // 3) Fallback local genérico
        try {
            const { parseStudentPDF } = require('../../parse-pdf-local');
            const raw = await parseStudentPDF(pdfBuffer);
            return { raw, aiUsed: false, source: 'local_fallback' };
        } catch (fallbackError) {
            throw new Error(
                `Falha na extração semântica (IA e parser local): ${fallbackError.message}`
            );
        }
    }
}

module.exports = new SemanticLayer();
