/**
 * Cifra AES-256-GCM para chaves API Asaas por coach (repouso na BD).
 * Prefixo bh1: = payload cifrado; sem prefixo = legado texto simples (migração gradual).
 *
 * ASAAS_COACH_SECRETS_KEY: mínimo 32 caracteres (ex.: openssl rand -base64 48).
 * Em produção é obrigatório para gravar novas chaves (ver encryptCoachAsaasApiKey).
 */
const crypto = require('crypto');
const logger = require('./logger');

const PREFIX = 'bh1:';
const SCRYPT_SALT = 'blackhouse-asaas-coach-v1';

function getScryptKeyOrNull() {
  const raw = process.env.ASAAS_COACH_SECRETS_KEY;
  if (!raw || String(raw).length < 32) return null;
  return crypto.scryptSync(String(raw), SCRYPT_SALT, 32);
}

/**
 * @param {string} stored
 * @returns {string} chave em claro
 */
function decryptCoachAsaasApiKey(stored) {
  const s = String(stored ?? '').trim();
  if (!s) return '';

  if (!s.startsWith(PREFIX)) {
    return s;
  }

  const key = getScryptKeyOrNull();
  if (!key) {
    throw new Error(
      'Chave Asaas cifrada na base de dados mas ASAAS_COACH_SECRETS_KEY não está definida no servidor.',
    );
  }

  const raw = Buffer.from(s.slice(PREFIX.length), 'base64');
  if (raw.length < 12 + 16 + 1) {
    throw new Error('Payload cifrado Asaas inválido.');
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const enc = raw.subarray(12, raw.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/**
 * @param {string} plaintext
 * @returns {string}
 */
function encryptCoachAsaasApiKey(plaintext) {
  const trimmed = String(plaintext ?? '').trim();
  if (!trimmed) return '';

  const keyMaterial = process.env.ASAAS_COACH_SECRETS_KEY;
  if (!keyMaterial || String(keyMaterial).length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Em produção defina ASAAS_COACH_SECRETS_KEY (mínimo 32 caracteres) no servidor para guardar chaves Asaas com segurança.',
      );
    }
    logger.warn(
      '[asaas-coach-secret] ASAAS_COACH_SECRETS_KEY ausente — chave API guardada sem cifrar (apenas para desenvolvimento).',
    );
    return trimmed;
  }

  const key = crypto.scryptSync(String(keyMaterial), SCRYPT_SALT, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, enc, tag]).toString('base64');
}

function hasEncryptedFormat(stored) {
  return String(stored ?? '').trim().startsWith(PREFIX);
}

module.exports = {
  encryptCoachAsaasApiKey,
  decryptCoachAsaasApiKey,
  hasEncryptedFormat,
};
