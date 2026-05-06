#!/usr/bin/env node
/**
 * Garante que rotas críticas permanecem no contrato (evita deploy com bundle que bloqueia POST).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, '..', 'src', 'contracts', 'api-contract.ts');
const src = readFileSync(path, 'utf8');
const required = ["'/api/videos'", "'/api/videos/:id'"];
for (const s of required) {
  if (!src.includes(s)) {
    console.error(`verify-api-contract: em falta ${s} em ${path}`);
    process.exit(1);
  }
}
console.log('verify-api-contract: OK');
