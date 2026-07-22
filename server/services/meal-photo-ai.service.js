/**
 * Análise nutricional de foto de refeição via camada de IA (vision).
 */

const path = require('path');
const fs = require('fs');
const aiService = require('./ai.service');
const logger = require('../utils/logger');
const {
  normalizeUploadImage,
} = require('../utils/normalize-upload-image');
const { parseMealPhotoAnalysis } = require('../schemas/meal-photo-schema');

const VISION_MAX_SIDE = 1024;
const VISION_MAX_BYTES = 1.5 * 1024 * 1024;

function buildSystemPrompt() {
  return `És um assistente de estimativa nutricional por imagem para um app de coaching.
Responde SEMPRE em português (Brasil) e APENAS com JSON válido (sem markdown).

IMPORTANTE — honestidade:
- Uma foto NÃO permite precisão clínica. Trata tudo como ESTIMATIVA APROXIMADA.
- NÃO inventes alimentos que não estejam claramente visíveis.
- Se a imagem estiver escura, desfocada, sem comida, ou ilegível, usa status apropriado e items=[].
- Inclui uncertainties sobre óleo, molhos, açúcar, método de preparo e peso real.

status permitido:
- "OK" — refeição identificável (mesmo com incerteza nas porções)
- "LOW_QUALITY" — imagem escura/desfocada/baixa qualidade
- "IMAGE_NOT_MEAL" — não parece uma refeição/prato
- "UNIDENTIFIABLE" — parece comida mas não identificável com segurança

SCHEMA JSON:
{
  "status": "OK" | "LOW_QUALITY" | "IMAGE_NOT_MEAL" | "UNIDENTIFIABLE",
  "error_message": string|null,
  "nome_sugerido": string,
  "confidence": number (0-1),
  "itens": [
    {
      "nome": string,
      "quantidade": number,
      "unidade": "g",
      "kcal": number,
      "ptn": number,
      "cho": number,
      "lip": number,
      "confidence": number
    }
  ],
  "totais": { "kcal": number, "ptn": number, "cho": number, "lip": number },
  "uncertainties": [string]
}

Macros: ptn=proteína(g), cho=carboidrato(g), lip=gordura(g), kcal=calorias.
Quantidades em gramas estimadas. Totais devem ser coerentes com a soma dos itens.`;
}

function buildUserPrompt() {
  return `Analisa a imagem anexada da refeição.
Identifica alimentos visíveis, estima porções em gramas e macros aproximados.
Se não conseguires identificar com segurança, não inventes — usa status UNIDENTIFIABLE ou LOW_QUALITY.
Devolve só o JSON do schema.`;
}

/**
 * Resolve ficheiro no storage a partir de imagem_path relativo.
 * @param {string} imagemPath
 * @param {string} alunoId
 * @returns {{ absolutePath: string, mime: string }}
 */
function resolveMealPhotoFile(imagemPath, alunoId) {
  const rel = String(imagemPath || '').trim();
  const prefix = `/api/uploads/storage/meal-photos/${alunoId}/`;
  if (!rel.startsWith(prefix)) {
    const err = new Error('Caminho de imagem inválido');
    err.statusCode = 400;
    err.error_code = 'INVALID_IMAGE_PATH';
    throw err;
  }
  const fileName = path.basename(rel.slice(prefix.length));
  if (!fileName || fileName.includes('..')) {
    const err = new Error('Nome de ficheiro inválido');
    err.statusCode = 400;
    err.error_code = 'INVALID_IMAGE_PATH';
    throw err;
  }
  const absolutePath = path.resolve(
    __dirname,
    '..',
    'storage',
    'meal-photos',
    String(alunoId),
    fileName,
  );
  const root = path.resolve(__dirname, '..', 'storage', 'meal-photos', String(alunoId));
  if (!absolutePath.startsWith(root)) {
    const err = new Error('Caminho de imagem inválido');
    err.statusCode = 400;
    err.error_code = 'INVALID_IMAGE_PATH';
    throw err;
  }
  if (!fs.existsSync(absolutePath)) {
    const err = new Error('Imagem não encontrada');
    err.statusCode = 404;
    err.error_code = 'IMAGE_NOT_FOUND';
    throw err;
  }
  return { absolutePath, mime: 'image/jpeg' };
}

/**
 * Comprime buffer para envio à IA (mais agressivo que storage).
 */
async function compressForVision(inputBuffer) {
  return normalizeUploadImage(inputBuffer, {
    maxSide: VISION_MAX_SIDE,
    maxBytes: VISION_MAX_BYTES,
    quality: 72,
  });
}

/**
 * @param {object} opts
 * @param {Buffer} [opts.imageBuffer]
 * @param {string} [opts.imagemPath]
 * @param {string} opts.alunoId
 */
async function analyzeMealPhoto({ imageBuffer, imagemPath, alunoId }) {
  if (!aiService.isVisionAvailable()) {
    const err = new Error(
      'Análise por foto indisponível. Configure um provider de visão (Gemini) no servidor.',
    );
    err.statusCode = 503;
    err.error_code = 'AI_UNAVAILABLE';
    throw err;
  }

  let buffer = imageBuffer;
  let mime = 'image/jpeg';

  if (!buffer && imagemPath) {
    const resolved = resolveMealPhotoFile(imagemPath, alunoId);
    buffer = fs.readFileSync(resolved.absolutePath);
    mime = resolved.mime;
  }

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('Nenhuma imagem para analisar');
    err.statusCode = 400;
    err.error_code = 'EMPTY_IMAGE';
    throw err;
  }

  let compressed;
  try {
    compressed = await compressForVision(buffer);
  } catch (e) {
    const err = new Error('Não foi possível processar a imagem para análise');
    err.statusCode = 400;
    err.error_code = 'IMAGE_PROCESS_FAILED';
    throw err;
  }

  let raw;
  try {
    raw = await aiService.analyzeMealPhoto(
      compressed.buffer,
      compressed.mime || mime,
      buildSystemPrompt(),
      buildUserPrompt(),
    );
  } catch (e) {
    logger.error('meal-photo-ai: falha provider', { error: e.message });
    const err = new Error(
      e.message?.includes('timeout') || e.message?.includes('Timeout')
        ? 'A análise demorou demasiado. Tente novamente com outra foto.'
        : 'Não foi possível analisar a refeição. Tente novamente em instantes.',
    );
    err.statusCode = e.statusCode === 429 ? 429 : 502;
    err.error_code = e.statusCode === 429 ? 'AI_RATE_LIMIT' : 'AI_BAD_RESPONSE';
    err.cause = e;
    throw err;
  }

  let analysis;
  try {
    analysis = parseMealPhotoAnalysis(raw);
  } catch (e) {
    logger.error('meal-photo-ai: JSON inválido', {
      error: e.message,
      rawPreview: JSON.stringify(raw)?.slice(0, 400),
    });
    const err = new Error(
      'A IA devolveu uma resposta inválida. Tente novamente.',
    );
    err.statusCode = 502;
    err.error_code = 'AI_BAD_RESPONSE';
    throw err;
  }

  const isOk = analysis.status === 'OK' && analysis.itens.length > 0;

  return {
    ok: isOk,
    status: analysis.status,
    error_message: analysis.error_message,
    nome_sugerido: analysis.nome_sugerido,
    confidence: analysis.confidence,
    itens: analysis.itens,
    totais: analysis.totais,
    uncertainties: analysis.uncertainties.length
      ? analysis.uncertainties
      : [
          'Estimativa aproximada com base na imagem. Óleo, molhos e peso real podem diferir.',
        ],
    disclaimer:
      'Estimativa aproximada. Valores estimados — revise as porções antes de salvar.',
  };
}

module.exports = {
  analyzeMealPhoto,
  resolveMealPhotoFile,
  compressForVision,
  buildSystemPrompt,
  VISION_MAX_SIDE,
};
