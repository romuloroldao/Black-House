#!/usr/bin/env node
/**
 * Benchmark de visão para pose de fotos de evolução (read-only em fotos_alunos).
 *
 * Compara um modelo (ex. groq:qwen/qwen3.8-27b) com os rótulos actuais (pose_efetiva),
 * numa amostra estratificada. Resultados em JSONL, retomável (--resume).
 *
 * Uso (a partir de /root/server):
 *   node scripts/vision-benchmark.js --model groq:qwen/qwen3.8-27b --out /root/benchmark-visao/qwen.jsonl
 * Opções: --limit 150  --interval-ms 22000  --resume  --dry-run (só mostra a amostra)
 *
 * Fotos corporais de alunos: guarde --out fora de pastas servidas pelo Nginx.
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const aiManager = require('../services/ai');
const poseService = require('../services/progress-photo-pose.service');

const STRATA = [
  { name: 'coach_corrigida', quota: 10, where: 'pose_coach IS NOT NULL' },
  {
    name: 'divergencia_lado',
    quota: 30,
    where: `pose_aluno IN ('lado_esquerdo','lado_direito') AND pose_vision IN ('lado_esquerdo','lado_direito') AND pose_aluno <> pose_vision`,
  },
  { name: 'divergencia_outra', quota: 15, where: `pose_aluno IS NOT NULL AND pose_vision IS NOT NULL AND pose_aluno <> pose_vision` },
  { name: 'invalido', quota: 10, where: `pose_efetiva = 'invalido'` },
  { name: 'frente', quota: 25, where: `pose_efetiva = 'frente'` },
  { name: 'costas', quota: 25, where: `pose_efetiva = 'costas'` },
  { name: 'lado_esquerdo', quota: 20, where: `pose_efetiva = 'lado_esquerdo'` },
  { name: 'lado_direito', quota: 20, where: `pose_efetiva = 'lado_direito'` },
];

function parseArgs(argv) {
  const args = {
    limit: 150,
    intervalMs: 22000,
    resume: false,
    dryRun: false,
    model: null,
    out: null,
    maxPerStratum: null,
    waitOnDaily: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--model') args.model = argv[++i];
    else if (a === '--max-per-stratum') args.maxPerStratum = Number(argv[++i]);
    else if (a === '--wait-on-daily') args.waitOnDaily = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--interval-ms') args.intervalMs = Number(argv[++i]);
    else if (a === '--resume') args.resume = true;
    else if (a === '--dry-run') args.dryRun = true;
  }
  if (!args.model || !args.out) {
    console.error('Uso: --model provider:modelo --out ficheiro.jsonl [--limit N] [--interval-ms N] [--resume] [--dry-run]');
    process.exit(2);
  }
  return args;
}

async function selectSample(pool, limit, maxPerStratum = null) {
  const picked = new Map();
  for (const base of STRATA) {
    if (picked.size >= limit) break;
    const stratum = maxPerStratum ? { ...base, quota: Math.min(base.quota, maxPerStratum) } : base;
    const { rows } = await pool.query(
      `SELECT id, url, pose_efetiva, pose_vision, pose_aluno, pose_coach, pose_vision_confidence
         FROM public.fotos_alunos
        WHERE url IS NOT NULL AND (${stratum.where})
        ORDER BY md5(id::text)
        LIMIT $1`,
      [stratum.quota * 3],
    );
    let taken = 0;
    for (const row of rows) {
      if (taken >= stratum.quota || picked.size >= limit) break;
      if (picked.has(row.id)) continue;
      picked.set(row.id, { ...row, stratum: stratum.name });
      taken += 1;
    }
  }
  return [...picked.values()];
}

function loadDone(outPath) {
  if (!fs.existsSync(outPath)) return new Set();
  const done = new Set();
  for (const line of fs.readFileSync(outPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (!rec.error) done.add(rec.id);
    } catch {
      /* linha parcial */
    }
  }
  return done;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "Please try again in 9m0.432s" → ms */
function parseRetryInMs(message) {
  const m = String(message).match(/try again in\s+(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return ((Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)) * 1000;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  aiManager.setUsagePool(pool);

  const sample = await selectSample(pool, args.limit, args.maxPerStratum);
  const byStratum = sample.reduce((acc, s) => ({ ...acc, [s.stratum]: (acc[s.stratum] || 0) + 1 }), {});
  console.log(`Amostra: ${sample.length} fotos`, byStratum);
  if (args.dryRun) {
    await pool.end();
    return;
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true, mode: 0o700 });
  const done = args.resume ? loadDone(args.out) : new Set();
  if (!args.resume && fs.existsSync(args.out)) fs.truncateSync(args.out, 0);

  let processed = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const photo = sample[index];
    if (done.has(photo.id)) continue;
    const started = Date.now();
    const record = {
      id: photo.id,
      stratum: photo.stratum,
      label: photo.pose_efetiva,
      label_vision: photo.pose_vision,
      label_vision_confidence: photo.pose_vision_confidence != null ? Number(photo.pose_vision_confidence) : null,
      pose_aluno: photo.pose_aluno,
      pose_coach: photo.pose_coach,
      model: args.model,
    };
    try {
      const raw = await poseService.resolveImageBufferFromUrl(photo.url);
      const prepared = await poseService.prepareBuffer(raw);
      const visionRaw = await aiManager.extractStructuredDataFromImage(
        prepared.buffer,
        prepared.mimeType,
        poseService.buildSystemPrompt(),
        poseService.buildUserPrompt(),
        { model: args.model, feature: 'benchmark', timeoutMs: 60000 },
      );
      const result = poseService.interpretPoseVision(visionRaw);
      Object.assign(record, {
        predicted: result.pose,
        confidence: result.confidence,
        reason: result.reason,
        people_count: result.people_count,
        latency_ms: Date.now() - started,
      });
    } catch (error) {
      record.error = String(error?.message || error).slice(0, 300);
      record.latency_ms = Date.now() - started;
    }
    fs.appendFileSync(args.out, `${JSON.stringify(record)}\n`);
    processed += 1;
    const status = record.error ? `ERRO ${record.error.slice(0, 90)}` : `${record.label} -> ${record.predicted}`;
    console.log(`[${processed}] ${photo.stratum} ${photo.id.slice(0, 8)} ${status} (${record.latency_ms}ms)`);

    if (record.error && /PerDay|per day|requests per day|RPD|TPD/i.test(record.error)) {
      const waitMs = parseRetryInMs(record.error);
      if (!args.waitOnDaily || waitMs === null || waitMs > 3 * 60 * 60 * 1000) {
        console.log('Limite diário atingido — rode de novo mais tarde com --resume.');
        break;
      }
      console.log(`Cota diária sem saldo — a aguardar ${Math.ceil(waitMs / 60000)} min e repetir.`);
      await sleep(waitMs + 5000);
      index -= 1;
      continue;
    }
    await sleep(args.intervalMs);
  }

  await sleep(500);
  await pool.end();
  console.log('Concluído.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
