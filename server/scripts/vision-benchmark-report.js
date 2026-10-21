#!/usr/bin/env node
/**
 * Relatório do benchmark de visão (saída JSONL de vision-benchmark.js).
 *
 * Uso:
 *   node scripts/vision-benchmark-report.js --in /root/benchmark-visao/qwen.jsonl \
 *     [--mediapipe /root/benchmark-visao/mediapipe-eval-full.jsonl] \
 *     [--html /root/benchmark-visao/revisao-divergencias.html]
 *
 * A página HTML embute miniaturas de fotos de alunos: gravar só fora de diretórios públicos.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const POSES = ['frente', 'costas', 'lado_esquerdo', 'lado_direito', 'desconhecido', 'invalido'];

function readJsonl(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function dedupeById(records) {
  const byId = new Map();
  for (const r of records) {
    const prev = byId.get(r.id);
    if (!prev || (prev.error && !r.error)) byId.set(r.id, r);
  }
  return [...byId.values()];
}

function pct(n, d) {
  return d ? `${((100 * n) / d).toFixed(1)}%` : '—';
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function errorKind(msg) {
  const s = String(msg || '');
  if (/tokens per day|TPD|per day|PerDay/i.test(s)) return 'cota_diaria';
  if (/429|rate limit/i.test(s)) return 'limite_por_minuto';
  if (/timeout/i.test(s)) return 'timeout';
  return 'outro';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function buildHtml(rows, mediapipeById, file) {
  const sharp = require('sharp');
  const { Pool } = require('pg');
  const { resolveImageBufferFromUrl } = require('../services/progress-photo-pose.service');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  const ids = rows.map((r) => r.id);
  const { rows: urls } = await pool.query(`SELECT id, url FROM public.fotos_alunos WHERE id = ANY($1)`, [ids]);
  await pool.end();
  const urlById = new Map(urls.map((u) => [String(u.id), u.url]));

  const cards = [];
  for (const r of rows) {
    let img = '';
    try {
      const buf = await resolveImageBufferFromUrl(urlById.get(String(r.id)));
      const thumb = await sharp(buf).rotate().resize({ height: 260, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
      img = `<img src="data:image/jpeg;base64,${thumb.toString('base64')}" alt="">`;
    } catch (err) {
      img = `<div class="noimg">${escapeHtml(err.message)}</div>`;
    }
    const mp = mediapipeById.get(String(r.id));
    cards.push(`<figure>${img}<figcaption>
      <b>${escapeHtml(r.stratum)}</b> · ${escapeHtml(String(r.id).slice(0, 8))}<br>
      rótulo actual: <b>${escapeHtml(r.label)}</b> (visão ${escapeHtml(r.label_vision)}, aluno ${escapeHtml(r.pose_aluno)})<br>
      Groq: <b>${escapeHtml(r.predicted)}</b> ${r.confidence != null ? `(${Number(r.confidence).toFixed(2)})` : ''}<br>
      MediaPipe: <b>${escapeHtml(mp?.predicted ?? '—')}</b><br>
      <small>${escapeHtml(r.reason)}</small></figcaption></figure>`);
  }

  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Revisão de divergências de pose</title>
<style>body{font-family:system-ui,sans-serif;margin:16px;background:#111;color:#eee}
main{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:220px;background:#1d1d1d;padding:8px;border-radius:8px}
img{max-width:100%;display:block;margin:0 auto 6px}figcaption{font-size:12px;line-height:1.4}.noimg{height:120px;color:#f88}
small{color:#aaa}</style></head><body>
<h1>Divergências entre Groq e o rótulo actual (${rows.length})</h1>
<p>Convenção anatómica: <b>lado_esquerdo</b> = lado esquerdo do corpo virado para a câmara (rosto aponta para a esquerda da imagem).</p>
<main>${cards.join('\n')}</main></body></html>`;
  fs.writeFileSync(file, html, { mode: 0o600 });
}

async function main() {
  const input = arg('in');
  if (!input) throw new Error('--in obrigatório');
  const all = readJsonl(input);
  const rows = dedupeById(all);
  const ok = rows.filter((r) => !r.error);
  const failed = rows.filter((r) => r.error);
  const mediapipeFile = arg('mediapipe');
  const mediapipeById = new Map(
    mediapipeFile ? readJsonl(mediapipeFile).map((r) => [String(r.id), r]) : [],
  );

  console.log(`Modelo: ${ok[0]?.model || all[0]?.model}`);
  console.log(`Registos: ${all.length} linhas, ${rows.length} fotos únicas, ${ok.length} com resposta`);

  const errKinds = {};
  for (const r of all.filter((x) => x.error)) errKinds[errorKind(r.error)] = (errKinds[errorKind(r.error)] || 0) + 1;
  console.log(`Erros (todas as tentativas): ${JSON.stringify(errKinds)}; fotos sem resposta final: ${failed.length}`);

  const agree = ok.filter((r) => r.predicted === r.label).length;
  console.log(`\nConcordância com o rótulo actual: ${agree}/${ok.length} (${pct(agree, ok.length)})`);

  console.log('\nPor estrato:');
  const strata = [...new Set(ok.map((r) => r.stratum))];
  for (const s of strata) {
    const sub = ok.filter((r) => r.stratum === s);
    const a = sub.filter((r) => r.predicted === r.label).length;
    const aluno = sub.filter((r) => r.pose_aluno && r.predicted === r.pose_aluno).length;
    console.log(`  ${s.padEnd(18)} rótulo ${a}/${sub.length} (${pct(a, sub.length)})  aluno ${aluno}/${sub.length}`);
  }

  const invalidLabeled = ok.filter((r) => r.label === 'invalido');
  const invalidHit = invalidLabeled.filter((r) => r.predicted === 'invalido').length;
  console.log(`\nDetecção de inválidas: ${invalidHit}/${invalidLabeled.length}`);

  console.log('\nMatriz de confusão (linhas = rótulo actual, colunas = Groq)');
  console.log(['rótulo'.padEnd(14), ...POSES.map((p) => p.slice(0, 10).padStart(11))].join(''));
  const labels = [...new Set(ok.map((r) => r.label))].sort();
  for (const l of labels) {
    const sub = ok.filter((r) => r.label === l);
    console.log([l.padEnd(14), ...POSES.map((p) => String(sub.filter((r) => r.predicted === p).length).padStart(11))].join(''));
  }

  const lat = ok.map((r) => r.latency_ms).filter(Number.isFinite);
  console.log(`\nLatência Groq: p50 ${percentile(lat, 0.5)} ms, p95 ${percentile(lat, 0.95)} ms`);

  if (mediapipeById.size) {
    const both = ok.filter((r) => mediapipeById.has(String(r.id)));
    const same = both.filter((r) => mediapipeById.get(String(r.id)).predicted === r.predicted).length;
    console.log(`\nGroq vs MediaPipe (mesmas fotos): ${same}/${both.length} (${pct(same, both.length)})`);
    const lateral = both.filter((r) => ['lado_esquerdo', 'lado_direito'].includes(r.predicted) &&
      ['lado_esquerdo', 'lado_direito'].includes(mediapipeById.get(String(r.id)).predicted));
    const sameSide = lateral.filter((r) => mediapipeById.get(String(r.id)).predicted === r.predicted).length;
    console.log(`  Laterais em ambos: mesmo lado ${sameSide}/${lateral.length}`);
  }

  const htmlFile = arg('html');
  if (htmlFile) {
    const divergent = ok.filter((r) => r.predicted !== r.label);
    await buildHtml(divergent, mediapipeById, htmlFile);
    console.log(`\nPágina de revisão: ${htmlFile} (${divergent.length} fotos)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
