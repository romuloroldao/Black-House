#!/usr/bin/env node
/**
 * Avalia src/lib/pose-classify.ts contra os rótulos actuais de fotos_alunos (só leitura).
 *
 * Uso:
 *   node scripts/pose-landmarks-eval.js --landmarks /root/benchmark-visao/landmarks-lite.jsonl \
 *     [--out /root/benchmark-visao/mediapipe-eval-lite.jsonl]
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { loadTsModule } = require('./lib/load-ts');

const { classifyPoseFromLandmarks } = loadTsModule(
  path.resolve(__dirname, '..', '..', 'src', 'lib', 'pose-classify.ts'),
);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const POSES = ['frente', 'costas', 'lado_esquerdo', 'lado_direito', 'desconhecido', 'invalido'];
const LATERAL = new Set(['lado_esquerdo', 'lado_direito']);

function toLandmarks(pose) {
  return pose.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));
}

function pct(n, d) {
  return d ? `${((100 * n) / d).toFixed(1)}%` : '—';
}

function confusion(rows, labelKey) {
  const m = {};
  for (const r of rows) {
    const label = r[labelKey] || 'null';
    m[label] = m[label] || {};
    m[label][r.predicted] = (m[label][r.predicted] || 0) + 1;
  }
  return m;
}

function printConfusion(title, m) {
  console.log(`\n${title} (linhas = rótulo, colunas = MediaPipe)`);
  const header = ['rótulo'.padEnd(14), ...POSES.map((p) => p.slice(0, 10).padStart(11))].join('');
  console.log(header);
  for (const label of Object.keys(m).sort()) {
    const cells = POSES.map((p) => String(m[label][p] || 0).padStart(11));
    console.log([label.padEnd(14), ...cells].join(''));
  }
}

async function main() {
  const landmarksFile = arg('landmarks');
  if (!landmarksFile) throw new Error('--landmarks obrigatório');
  const outFile = arg('out');

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  const { rows: labels } = await pool.query(
    `SELECT id, pose_efetiva, pose_source, pose_vision, pose_vision_confidence, pose_aluno, pose_coach
     FROM public.fotos_alunos`,
  );
  await pool.end();
  const byId = new Map(labels.map((l) => [String(l.id), l]));

  const results = [];
  for (const line of fs.readFileSync(landmarksFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line);
    const label = byId.get(String(rec.id));
    if (!label || rec.error) continue;
    const out = classifyPoseFromLandmarks(rec.poses.map(toLandmarks), {
      width: rec.width,
      height: rec.height,
    });
    results.push({
      id: rec.id,
      predicted: out.pose,
      confidence: out.confidence,
      reason: out.reason,
      ms: rec.ms,
      pose_efetiva: label.pose_efetiva,
      pose_source: label.pose_source,
      pose_vision: label.pose_vision,
      pose_vision_confidence: label.pose_vision_confidence == null ? null : Number(label.pose_vision_confidence),
      pose_aluno: label.pose_aluno,
      pose_coach: label.pose_coach,
    });
  }

  const n = results.length;
  const agree = results.filter((r) => r.predicted === r.pose_efetiva).length;
  console.log(`Fotos avaliadas: ${n}`);
  console.log(`Concordância total com pose_efetiva: ${agree} (${pct(agree, n)})`);

  const byClass = {};
  for (const r of results) {
    const c = (byClass[r.pose_efetiva] = byClass[r.pose_efetiva] || { n: 0, ok: 0 });
    c.n += 1;
    if (r.predicted === r.pose_efetiva) c.ok += 1;
  }
  console.log('\nPor classe (rótulo actual):');
  for (const [k, v] of Object.entries(byClass).sort()) {
    console.log(`  ${String(k).padEnd(14)} ${String(v.ok).padStart(4)}/${String(v.n).padEnd(4)} ${pct(v.ok, v.n)}`);
  }

  const frontBack = results.filter(
    (r) => ['frente', 'costas'].includes(r.pose_efetiva) && r.pose_source === 'vision' && r.pose_vision_confidence >= 0.85,
  );
  const fbOk = frontBack.filter((r) => r.predicted === r.pose_efetiva).length;
  console.log(`\nFrente/costas com visão confiante (>=0.85): ${fbOk}/${frontBack.length} (${pct(fbOk, frontBack.length)})`);

  const laterals = results.filter((r) => LATERAL.has(r.pose_efetiva));
  const latPredLat = laterals.filter((r) => LATERAL.has(r.predicted));
  const latSame = latPredLat.filter((r) => r.predicted === r.pose_efetiva).length;
  console.log(
    `\nLaterais (rótulo actual): ${laterals.length}; MediaPipe diz lateral em ${latPredLat.length} (${pct(latPredLat.length, laterals.length)})`,
  );
  console.log(
    `  Mesmo lado do rótulo actual: ${latSame}/${latPredLat.length} (${pct(latSame, latPredLat.length)}) — rótulos actuais seguem convenção ambígua`,
  );
  for (const src of ['vision', 'legacy_descricao']) {
    const sub = latPredLat.filter((r) => r.pose_source === src);
    const same = sub.filter((r) => r.predicted === r.pose_efetiva).length;
    console.log(`  fonte=${src}: mesmo lado ${same}/${sub.length} (${pct(same, sub.length)})`);
  }
  const coach = results.filter((r) => r.pose_coach);
  console.log(`\nCorrigidas pelo coach: ${coach.map((r) => `${r.pose_coach}->${r.predicted}`).join(', ') || 'nenhuma'}`);

  printConfusion('Matriz de confusão', confusion(results, 'pose_efetiva'));

  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`\nTempo por foto (servidor, CPU): p50 ${ms[Math.floor(n * 0.5)]} ms, p95 ${ms[Math.floor(n * 0.95)]} ms`);

  if (outFile) {
    fs.writeFileSync(outFile, results.map((r) => JSON.stringify(r)).join('\n') + '\n', { mode: 0o600 });
    console.log(`\nResultados por foto: ${outFile}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
