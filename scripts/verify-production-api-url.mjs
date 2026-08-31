#!/usr/bin/env node
/**
 * Garante que o bundle de produção não use http://localhost:3001 como API_URL.
 * Deve correr DEPOIS de `vite build`, com VITE_API_URL de produção definido.
 *
 * Uso:
 *   VITE_API_URL=https://api.blackhouse.app.br npm run build
 *   node scripts/verify-production-api-url.mjs
 *
 * Em CI/deploy de produção, falha se a constante base apontar para localhost.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.cwd(), 'dist');
const INDEX_HTML = path.join(DIST, 'index.html');
const LOCALHOST = 'http://localhost:3001';
const PROD_API = process.env.VITE_API_URL || 'https://api.blackhouse.app.br';

function fail(msg) {
  console.error(`❌ verify-production-api-url: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(INDEX_HTML)) {
  fail('dist/index.html não encontrado. Corra vite build antes.');
}

const html = fs.readFileSync(INDEX_HTML, 'utf8');
const match = html.match(/assets\/index-[^"']+\.js/);
if (!match) {
  fail('Não encontrei assets/index-*.js em dist/index.html');
}

const bundlePath = path.join(DIST, match[0]);
if (!fs.existsSync(bundlePath)) {
  fail(`Bundle em falta: ${bundlePath}`);
}

const src = fs.readFileSync(bundlePath, 'utf8');
const prodNeedle = `="${PROD_API.replace(/\/$/, '')}"`;
const localhostConst = `="${LOCALHOST}"`;

if (!src.includes(prodNeedle) && !src.includes(`="${PROD_API}"`)) {
  // aceitar URL sem barra final
  const alt = PROD_API.replace(/\/$/, '');
  if (!src.includes(`="${alt}"`)) {
    fail(
      `API de produção não embutida no bundle (${PROD_API}). ` +
        `Buildou sem VITE_API_URL? Use: VITE_API_URL=${PROD_API} npm run build`,
    );
  }
}

if (src.includes(localhostConst)) {
  fail(
    `Bundle embute ${LOCALHOST} como constante (provável API_URL). ` +
      `Isto quebra login em produção. Rebuild com VITE_API_URL=${PROD_API}`,
  );
}

console.log(`✅ verify-production-api-url: OK (${match[0]} → ${PROD_API})`);
