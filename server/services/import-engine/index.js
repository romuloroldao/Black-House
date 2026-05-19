/**
 * Import Engine — orquestrador multi-camadas para fichas de alunos.
 *
 * Pipeline:
 *   1. OCR Layer        → texto limpo + detecção de PDF escaneado
 *   2. Document Understanding → segmentação semântica por seção
 *   3. Semantic Layer   → extração IA / parser local
 *   4. Entity Normalizer → sinónimos e reclassificação protocolo
 *   5. Sanitizer + Zod  → schema canónico
 *   6. Normalizer       → formato interno
 *   7. Validation Layer → coerência contextual + correções
 *   8. Confidence Layer → scores por campo
 */

const ocrLayer = require('./ocr-layer');
const documentUnderstanding = require('./document-understanding');
const semanticLayer = require('./semantic-layer');
const entityNormalizer = require('./entity-normalizer');
const validationLayer = require('./validation-layer');
const confidenceLayer = require('./confidence-layer');
const { sanitizeAiOutput } = require('../ai/sanitizer');
const { safeValidate } = require('../../schemas/import-schema');
const normalizerService = require('../normalizer.service');
const validatorService = require('../validator.service');
const logger = require('../../utils/logger');

class ImportEngine {
    /**
     * Processa PDF completo e devolve dados prontos para revisão.
     * @param {Buffer} pdfBuffer
     * @param {Object} options - { fileName, requestId }
     */
    async process(pdfBuffer, options = {}) {
        const { fileName = 'ficha.pdf', requestId = `req-${Date.now()}` } = options;

        // 1. OCR
        const ocrResult = await ocrLayer.process(pdfBuffer);
        if (!ocrResult.text?.trim()) {
            const err = new Error(
                'Não foi possível extrair texto do PDF. O documento pode estar escaneado sem OCR — configure IA multimodal (Gemini) para PDFs-imagem.'
            );
            err.code = 'OCR_EMPTY';
            throw err;
        }

        // 2. Document understanding
        const docAnalysis = documentUnderstanding.analyze(ocrResult.text);

        // 3. Semantic extraction
        const { raw, aiUsed, source } = await semanticLayer.extract({
            ocrResult,
            docAnalysis,
            pdfBuffer,
            fileName
        });

        logger.info('IMPORT-ENGINE: extração bruta concluída', {
            requestId,
            fileName,
            source,
            aiUsed,
            hasAluno: !!raw?.aluno,
            refeicoes: raw?.dieta?.refeicoes?.length || 0
        });

        // 4. Entity normalization (antes do sanitizer)
        const entityNormalized = entityNormalizer.normalizeExtractedData(raw);

        // 5. Sanitize + Zod
        const sanitized = sanitizeAiOutput(entityNormalized, requestId);

        if (sanitized.dieta?.refeicoes) {
            sanitized.dieta.refeicoes = sanitized.dieta.refeicoes.filter(
                (ref) => ref?.alimentos?.length > 0
            );
            if (sanitized.dieta.refeicoes.length === 0) {
                delete sanitized.dieta;
            }
        }

        const schemaValidation = safeValidate(sanitized);
        if (!schemaValidation.success) {
            const errors = (schemaValidation.errors || [])
                .map((e) => `${e.path}: ${e.message}`)
                .slice(0, 15);
            const err = new Error('Dados extraídos fora do schema canónico');
            err.code = 'SCHEMA_INVALID';
            err.details = errors;
            err.rawOutput = raw;
            throw err;
        }

        // 6. Business normalizer
        const normalizedData = normalizerService.normalize(schemaValidation.data);

        // 7. Contextual validation + fixes
        const validationResult = validationLayer.validateAndFix(normalizedData, {
            fullText: ocrResult.text,
            sections: docAnalysis.sections,
            docAnalysis
        });

        // 8. Business validator (legado)
        const businessValidation = validatorService.validateImportData(validationResult.data);

        // 9. Confidence
        const confidence = confidenceLayer.evaluate(validationResult.data, {
            ocrResult,
            docAnalysis,
            validationResult,
            aiUsed
        });

        const warnings = [
            ...businessValidation.errors,
            ...validationResult.issues,
            ...confidence.warnings
        ].filter(Boolean);

        const extractedTreino = validationResult.data._extracted_treino || null;
        const data = { ...validationResult.data };
        delete data._extracted_treino;

        return {
            data,
            warnings: [...new Set(warnings)],
            meta: {
                aiUsed,
                source,
                requestId,
                numPages: ocrResult.numPages,
                hasPerPage: (ocrResult.perPageText?.length || 0) > 1,
                confidence,
                ocr: {
                    quality: ocrResult.extractionQuality,
                    likelyScanned: ocrResult.likelyScanned,
                    avgCharsPerPage: ocrResult.avgCharsPerPage
                },
                document: docAnalysis.hints,
                validation: {
                    fixes: validationResult.fixes,
                    valid: validationResult.valid && businessValidation.valid
                },
                extractedTreino
            }
        };
    }
}

module.exports = new ImportEngine();
