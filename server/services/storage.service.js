/**
 * Abstração de armazenamento de ficheiros.
 *
 * Drivers:
 * - fs (default): disco local em server/storage/
 * - s3: S3-compatible (R2/MinIO/AWS) — requer STORAGE_DRIVER=s3 + credenciais
 *
 * URLs da API mantêm-se em /api/uploads/storage/... (servidas pela rota Express).
 * Com s3, getAbsolutePath devolve null e a rota deve usar openReadStream / getSignedUrl.
 */

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const ROOT = path.join(__dirname, '..', 'storage');

function getDriver() {
  const d = String(process.env.STORAGE_DRIVER || 'fs').trim().toLowerCase();
  return d === 's3' ? 's3' : 'fs';
}

function assertSafeKey(key) {
  const normalized = String(key || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new Error('STORAGE_INVALID_KEY');
  }
  return normalized;
}

function fsAbsolute(key) {
  const safe = assertSafeKey(key);
  const abs = path.resolve(ROOT, safe);
  if (!abs.startsWith(path.resolve(ROOT))) {
    throw new Error('STORAGE_INVALID_KEY');
  }
  return abs;
}

async function putObject(key, buffer, contentType) {
  const driver = getDriver();
  const safe = assertSafeKey(key);

  if (driver === 's3') {
    const client = await getS3Client();
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: safe,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
      }),
    );
    return { key: safe, driver: 's3' };
  }

  const abs = fsAbsolute(safe);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer);
  return { key: safe, driver: 'fs', absolutePath: abs };
}

async function objectExists(key) {
  const driver = getDriver();
  const safe = assertSafeKey(key);

  if (driver === 's3') {
    try {
      const client = await getS3Client();
      const { HeadObjectCommand } = require('@aws-sdk/client-s3');
      await client.send(
        new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: safe }),
      );
      return true;
    } catch {
      return false;
    }
  }

  return fs.existsSync(fsAbsolute(safe));
}

/**
 * Caminho absoluto no disco (só driver fs). Com s3 devolve null.
 */
function getAbsolutePath(key) {
  if (getDriver() !== 'fs') return null;
  const abs = fsAbsolute(key);
  return fs.existsSync(abs) ? abs : null;
}

async function openReadStream(key) {
  const driver = getDriver();
  const safe = assertSafeKey(key);

  if (driver === 's3') {
    const client = await getS3Client();
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const out = await client.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: safe }),
    );
    return out.Body;
  }

  const abs = fsAbsolute(safe);
  if (!fs.existsSync(abs)) return null;
  return fs.createReadStream(abs);
}

async function deleteObject(key) {
  const driver = getDriver();
  const safe = assertSafeKey(key);

  if (driver === 's3') {
    const client = await getS3Client();
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await client.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: safe }),
    );
    return;
  }

  const abs = fsAbsolute(safe);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

/**
 * URL relativa estável da API (não muda com o driver).
 * Ex.: progress-photos/{alunoId}/{file} → /api/uploads/storage/progress-photos/...
 */
function publicApiPath(key) {
  return `/api/uploads/storage/${assertSafeKey(key)}`;
}

let s3ClientPromise = null;

async function getS3Client() {
  if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      'STORAGE_DRIVER=s3 requer S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY',
    );
  }
  if (!s3ClientPromise) {
    s3ClientPromise = (async () => {
      let S3Client;
      try {
        ({ S3Client } = require('@aws-sdk/client-s3'));
      } catch {
        throw new Error(
          'Pacote @aws-sdk/client-s3 não instalado. npm i @aws-sdk/client-s3 no server/',
        );
      }
      return new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      });
    })();
  }
  return s3ClientPromise;
}

module.exports = {
  getDriver,
  putObject,
  objectExists,
  getAbsolutePath,
  openReadStream,
  deleteObject,
  publicApiPath,
  ROOT,
};
