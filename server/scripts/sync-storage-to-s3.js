#!/usr/bin/env node
/**
 * Sync one-shot: server/storage → bucket S3 (só com STORAGE_DRIVER=s3 + credenciais).
 *
 * Uso:
 *   STORAGE_DRIVER=s3 S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
 *     node server/scripts/sync-storage-to-s3.js
 *
 * Não activa o driver em runtime da API — apenas faz upload dos ficheiros locais.
 */
const fs = require('fs');
const path = require('path');
const storage = require('../services/storage.service');

async function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, base, out);
    else out.push({ abs, key: path.relative(base, abs).replace(/\\/g, '/') });
  }
  return out;
}

async function main() {
  if (storage.getDriver() !== 's3') {
    console.error('Defina STORAGE_DRIVER=s3 e as variáveis S3_* antes de correr este script.');
    process.exit(1);
  }
  const root = storage.ROOT;
  const files = await walk(root);
  console.log(`A sincronizar ${files.length} ficheiros de ${root} → s3://${process.env.S3_BUCKET}`);
  let ok = 0;
  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    await storage.putObject(f.key, buf);
    ok += 1;
    if (ok % 25 === 0) console.log(`  … ${ok}/${files.length}`);
  }
  console.log(`Concluído: ${ok} objectos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
