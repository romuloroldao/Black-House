/**
 * Classifica ângulo (frente/costas/lados) de fotos de evolução via Vision (Gemini).
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const aiService = require('./ai.service');
const logger = require('../utils/logger');
const { normalizeUploadImage } = require('../utils/normalize-upload-image');
const engine = require('./foto-pose.engine');

const POSES = engine.COMPARABLE_POSES;
const VISION_MAX_SIDE = Number(process.env.POSE_VISION_MAX_SIDE) || 1024;
const VISION_MAX_BYTES = 1.5 * 1024 * 1024;

function buildSystemPrompt() {
  return `És um classificador de pose corporal para fotos de evolução física (antes/depois).
Responde APENAS com JSON válido (sem markdown), em português neutro.

Regras:
- Analisa se a pessoa está de FRENTE, de COSTAS, de LADO ESQUERDO ou de LADO DIREITO em relação à câmara.
- frente = rosto/peito/abdômen de frente para a câmara
- costas = costas/nuca voltadas para a câmara
- Convenção ANATÓMICA (lado do corpo da pessoa, não o lado da imagem):
  - lado_esquerdo = o lado ESQUERDO do corpo está voltado para a câmara (ombro e braço esquerdos mais próximos da câmara); o rosto/nariz aponta para a ESQUERDA da imagem
  - lado_direito = o lado DIREITO do corpo está voltado para a câmara (ombro e braço direitos mais próximos da câmara); o rosto/nariz aponta para a DIREITA da imagem
  - Se a foto parecer espelhada (selfie no espelho), usa na mesma a regra acima sobre a imagem tal como está
- desconhecido = ângulo ambíguo ou confiança insuficiente
- invalido = sem pessoa, múltiplas pessoas, corpo insuficientemente visível, ou foto inadequada para comparação
- Se people_count > 1, pose DEVE ser "invalido"
- NÃO inventes. Prefere "desconhecido" ou "invalido" a um chute.
- NÃO sugerir correção da imagem (espelhar, rodar, gerar partes do corpo).

SCHEMA:
{
  "pose": "frente" | "costas" | "lado_esquerdo" | "lado_direito" | "desconhecido" | "invalido",
  "confidence": number (0-1),
  "reason": string,
  "people_count": integer,
  "body_visible": boolean,
  "suitable_for_compare": boolean
}`;
}

function buildUserPrompt() {
  return `Classifica o ângulo corporal da pessoa nesta foto de evolução.
Conta quantas pessoas aparecem. Avalia se o corpo está suficientemente visível para comparação antes/depois.
Devolve só o JSON do schema.`;
}

function normalizePose(raw) {
  return engine.normalizePose(raw);
}

async function prepareBuffer(imageBuffer, maxSide = VISION_MAX_SIDE) {
  const normalized = await normalizeUploadImage(imageBuffer, {
    maxSide,
    maxBytes: VISION_MAX_BYTES,
    quality: 78,
  });
  return {
    buffer: normalized.buffer,
    mimeType: normalized.mime || 'image/jpeg',
  };
}

function fetchUrlBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 4) {
      reject(new Error('Demasiados redirects ao obter imagem'));
      return;
    }
    const lib = String(url).startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchUrlBuffer(res.headers.location, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} ao obter imagem`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout ao obter imagem'));
    });
  });
}

/**
 * Resolve buffer a partir de URL pública/local de progress photo.
 */
async function resolveImageBufferFromUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) {
    const err = new Error('URL de imagem em falta');
    err.statusCode = 400;
    err.error_code = 'EMPTY_IMAGE';
    throw err;
  }

  let pathname = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      pathname = new URL(raw).pathname;
    }
  } catch {
    pathname = raw;
  }

  const storagePrefix = '/api/uploads/storage/';
  if (pathname.startsWith(storagePrefix)) {
    const rel = pathname.slice(storagePrefix.length);
    const absolute = path.resolve(__dirname, '..', 'storage', rel);
    const root = path.resolve(__dirname, '..', 'storage');
    if (!absolute.startsWith(root) || !fs.existsSync(absolute)) {
      const err = new Error('Imagem não encontrada no storage');
      err.statusCode = 404;
      err.error_code = 'IMAGE_NOT_FOUND';
      throw err;
    }
    return fs.readFileSync(absolute);
  }

  if (/^https?:\/\//i.test(raw)) {
    return fetchUrlBuffer(raw);
  }

  const err = new Error('URL de imagem inválida');
  err.statusCode = 400;
  err.error_code = 'INVALID_IMAGE_URL';
  throw err;
}

/**
 * @param {{ imageBuffer?: Buffer, url?: string }} input
 */
async function classifyProgressPhotoPose(input = {}) {
  if (!aiService.isVisionAvailable()) {
    const err = new Error(
      'IA de visão não está disponível. Configure Gemini (AI_VISION_PROVIDER / GEMINI_API_KEY).',
    );
    err.statusCode = 503;
    err.error_code = 'VISION_UNAVAILABLE';
    throw err;
  }

  let buffer = input.imageBuffer || null;
  if (!buffer && input.url) {
    buffer = await resolveImageBufferFromUrl(input.url);
  }
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('Envie uma imagem (file) ou url');
    err.statusCode = 400;
    err.error_code = 'EMPTY_IMAGE';
    throw err;
  }

  const prepared = await prepareBuffer(buffer);
  let raw;
  const started = Date.now();
  try {
    raw = await aiService.analyzeMealPhotoWithModelFallback(
      prepared.buffer,
      prepared.mimeType,
      buildSystemPrompt(),
      buildUserPrompt(),
      { feature: 'pose' },
    );
  } catch (error) {
    logger.warn('classifyProgressPhotoPose vision failed', {
      error: error.message,
      duration_ms: Date.now() - started,
    });
    throw error;
  }

  return interpretPoseVision(raw);
}

/** Converte o JSON bruto do modelo de visão no resultado de pose usado pelo pipeline. */
function interpretPoseVision(raw) {
  const peopleCount = Number(raw?.people_count);
  let pose = normalizePose(raw?.pose);
  if (Number.isFinite(peopleCount) && peopleCount > 1) {
    pose = 'invalido';
  }

  const confidence = Math.max(0, Math.min(1, Number(raw?.confidence) || 0));
  return {
    pose,
    confidence,
    reason: raw?.reason ? String(raw.reason).slice(0, 240) : null,
    source: 'vision',
    known_poses: [...POSES, 'desconhecido', 'invalido'],
    people_count: Number.isFinite(peopleCount) ? peopleCount : null,
    body_visible: raw?.body_visible === true,
    suitable_for_compare: raw?.suitable_for_compare !== false,
  };
}

module.exports = {
  classifyProgressPhotoPose,
  normalizePose,
  resolveImageBufferFromUrl,
  prepareBuffer,
  interpretPoseVision,
  buildSystemPrompt,
  buildUserPrompt,
  POSES,
};
