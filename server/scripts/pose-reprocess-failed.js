#!/usr/bin/env node
/**
 * Repõe fotos com pose_analysis_status=failed para pending e opcionalmente processa um lote.
 *
 * Uso:
 *   node server/scripts/pose-reprocess-failed.js [--dry-run]
 *   node server/scripts/pose-reprocess-failed.js --aluno-id=UUID
 *   node server/scripts/pose-reprocess-failed.js --process-batch=5
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const normalization = require('../services/foto-pose-normalization.service');

function parseArgs(argv) {
  const opts = { dryRun: false, alunoId: null, processBatch: 0 };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--aluno-id=')) opts.alunoId = arg.split('=')[1];
    else if (arg.startsWith('--process-batch=')) {
      opts.processBatch = Number(arg.split('=')[1]) || 0;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const before = await normalization.getInventory(pool);
    console.log('=== Antes ===');
    console.log(JSON.stringify(before, null, 2));

    const reset = await normalization.resetFailedPhotos(pool, {
      alunoId: opts.alunoId,
      dryRun: opts.dryRun,
    });
    console.log('\n=== Reset failed → pending ===');
    console.log(JSON.stringify(reset, null, 2));

    if (!opts.dryRun && opts.processBatch > 0) {
      let totalProcessed = 0;
      for (let i = 0; i < opts.processBatch; i += 1) {
        const batch = await normalization.processBatch(pool);
        totalProcessed += batch.processed || 0;
        console.log(`Lote ${i + 1}:`, batch);
        if (!batch.total) break;
      }
      console.log(`\nTotal classificadas nesta execução: ${totalProcessed}`);
    }

    if (!opts.dryRun) {
      const after = await normalization.getInventory(pool);
      console.log('\n=== Depois ===');
      console.log(JSON.stringify(after, null, 2));
      console.log('\nMétricas:', normalization.getMetrics());
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
