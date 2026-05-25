/**
 * Import Engine — orquestrador multi-camadas para fichas de alunos.
 *
 * Suporta PDF, CSV e XLSX (modelo Excel Black House).
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
const { parseBlackHouseCSV } = require('../parse-csv-local');
const { parseBlackHouseXLSX } = require('../parse-xlsx-local');

const CSV_MIMES = new Set(['text/csv', 'application/csv', 'text/comma-separated-values']);
const XLSX_MIMES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
]);

function isCsvImport(fileName, mimeType) {
    if (/\.csv$/i.test(String(fileName || ''))) return true;
    if (!mimeType) return false;
    return CSV_MIMES.has(String(mimeType).toLowerCase());
}

function isXlsxImport(fileName, mimeType) {
    if (/\.xlsx$/i.test(String(fileName || ''))) return true;
    if (!mimeType) return false;
    return XLSX_MIMES.has(String(mimeType).toLowerCase());
}

class ImportEngine {
    /**
     * Processa ficheiro (PDF, CSV ou XLSX) e devolve dados prontos para revisão.
     * @param {Buffer} fileBuffer
     * @param {Object} options - { fileName, requestId, mimeType }
     */
    async process(fileBuffer, options = {}) {
        const { fileName = 'ficha.pdf', requestId = `req-${Date.now()}`, mimeType } = options;

        if (isXlsxImport(fileName, mimeType)) {
            return this._processSpreadsheet(fileBuffer, {
                fileName,
                requestId,
                parse: () => parseBlackHouseXLSX(fileBuffer, fileName),
                source: 'xlsx_blackhouse',
                format: 'XLSX',
                hints: { fromXlsx: true },
            });
        }

        if (isCsvImport(fileName, mimeType)) {
            return this._processSpreadsheet(fileBuffer, {
                fileName,
                requestId,
                parse: () => parseBlackHouseCSV(fileBuffer, fileName),
                source: 'csv_blackhouse',
                format: 'CSV',
                hints: { fromCsv: true },
            });
        }

        return this._processPdf(fileBuffer, { fileName, requestId });
    }

    async _processSpreadsheet(_buffer, { fileName, requestId, parse, source, format, hints }) {
        let raw;
        try {
            raw = parse();
        } catch (err) {
            err.code = err.code || `${format}_PARSE_FAILED`;
            throw err;
        }

        logger.info(`IMPORT-ENGINE: ${format} Black House parseado`, {
            requestId,
            fileName,
            refeicoes: raw?.dieta?.refeicoes?.length || 0,
            dataRetorno: raw?.dieta?.data_retorno || null,
        });

        const ocrResult = {
            text: '',
            numPages: 1,
            extractionQuality: 'high',
            likelyScanned: false,
            avgCharsPerPage: 0,
            perPageText: [],
        };
        const docAnalysis = {
            hints: { hasPlanoAlimentar: true, ...hints },
            sections: [],
        };

        return this._finalizePipeline(raw, {
            requestId,
            fileName,
            aiUsed: false,
            source,
            ocrResult,
            docAnalysis,
        });
    }

    async _processPdf(pdfBuffer, { fileName, requestId }) {
        const ocrResult = await ocrLayer.process(pdfBuffer);
        if (!ocrResult.text?.trim()) {
            const err = new Error(
                'Não foi possível extrair texto do PDF. O documento pode estar escaneado sem OCR — configure IA multimodal (Gemini) para PDFs-imagem.'
            );
            err.code = 'OCR_EMPTY';
            throw err;
        }

        const docAnalysis = documentUnderstanding.analyze(ocrResult.text);

        const { raw, aiUsed, source } = await semanticLayer.extract({
            ocrResult,
            docAnalysis,
            pdfBuffer,
            fileName,
        });

        logger.info('IMPORT-ENGINE: extração bruta concluída', {
            requestId,
            fileName,
            source,
            aiUsed,
            hasAluno: !!raw?.aluno,
            refeicoes: raw?.dieta?.refeicoes?.length || 0,
        });

        return this._finalizePipeline(raw, {
            requestId,
            fileName,
            aiUsed,
            source,
            ocrResult,
            docAnalysis,
        });
    }

    async _finalizePipeline(raw, ctx) {
        const { requestId, aiUsed, source, ocrResult, docAnalysis } = ctx;

        const entityNormalized = entityNormalizer.normalizeExtractedData(raw);

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
            const err = new Error('Dados extraídos fora do schema canônico');
            err.code = 'SCHEMA_INVALID';
            err.details = errors;
            err.rawOutput = raw;
            throw err;
        }

        const normalizedData = normalizerService.normalize(schemaValidation.data);

        const validationResult = validationLayer.validateAndFix(normalizedData, {
            fullText: ocrResult.text,
            sections: docAnalysis.sections,
            docAnalysis,
        });

        const businessValidation = validatorService.validateImportData(validationResult.data);

        const confidence = confidenceLayer.evaluate(validationResult.data, {
            ocrResult,
            docAnalysis,
            validationResult,
            aiUsed,
        });

        const warnings = [
            ...businessValidation.errors,
            ...validationResult.issues,
            ...confidence.warnings,
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
                    avgCharsPerPage: ocrResult.avgCharsPerPage,
                },
                document: docAnalysis.hints,
                validation: {
                    fixes: validationResult.fixes,
                    valid: validationResult.valid && businessValidation.valid,
                },
                extractedTreino,
            },
        };
    }
}

module.exports = new ImportEngine();
