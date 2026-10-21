/**
 * Normaliza imagens de upload (HEIC/PNG/WebP/JPEG) para JPEG otimizado.
 * Reduz atrito em telemóveis onde o browser não decodifica HEIC.
 */
const sharp = require('sharp');

const DEFAULT_MAX_SIDE = 2048;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_QUALITY = 82;

/**
 * @param {Buffer} inputBuffer
 * @param {{ maxSide?: number; maxBytes?: number; quality?: number }} [options]
 * @returns {Promise<{ buffer: Buffer; ext: string; mime: string; size: number }>}
 */
async function normalizeUploadImage(inputBuffer, options = {}) {
  if (!inputBuffer || !Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error('EMPTY_IMAGE');
  }

  const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let quality = options.quality ?? DEFAULT_QUALITY;

  const base = sharp(inputBuffer, { failOn: 'none' }).rotate();

  for (let attempt = 0; attempt < 7; attempt++) {
    const buffer = await base
      .clone()
      .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (buffer.length <= maxBytes) {
      return { buffer, ext: '.jpg', mime: 'image/jpeg', size: buffer.length };
    }
    quality = Math.max(42, quality - 7);
  }

  const buffer = await sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 68, mozjpeg: true })
    .toBuffer();

  if (buffer.length > maxBytes) {
    const err = new Error('IMAGE_TOO_LARGE');
    err.maxBytes = maxBytes;
    err.outputSize = buffer.length;
    throw err;
  }

  return { buffer, ext: '.jpg', mime: 'image/jpeg', size: buffer.length };
}

function imageNormalizeErrorMessage(err) {
  if (!err) return 'Erro ao processar imagem';
  if (err.message === 'EMPTY_IMAGE') return 'Nenhum arquivo de imagem recebido';
  if (err.message === 'IMAGE_TOO_LARGE') {
    return 'A foto ainda está grande demais. Tente uma imagem mais próxima ou com menos zoom.';
  }
  return 'Não foi possível processar a imagem. Tente outra foto.';
}

module.exports = {
  normalizeUploadImage,
  imageNormalizeErrorMessage,
  DEFAULT_MAX_SIDE,
  DEFAULT_MAX_BYTES,
  DEFAULT_QUALITY,
};
