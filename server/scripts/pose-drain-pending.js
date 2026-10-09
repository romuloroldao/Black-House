#!/usr/bin/env node
/**
 * Drena o backlog histórico de pose (pending/failed) via Vision.
 * Overrides só neste processo — não alteram o .env permanente do job.
 *
 * Free-tier: cada modelo Gemini tem RPD próprio (~20). Rodamos um pool de
 * modelos com cota e, se todos esgotarem, dormimos até ao próximo dia UTC.
 *
 * Uso:
 *   npm run pose:drain
 *   POSE_DRAIN_BATCH_SIZE=1 npm run pose:drain
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DRAIN_MODEL_POOL = (
  process.env.POSE_DRAIN_MODEL_POOL ||
  [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
  ].join(',')
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

process.env.POSE_DAILY_CLASSIFY_LIMIT = process.env.POSE_DRAIN_DAILY_LIMIT || '10000';
process.env.POSE_JOB_BATCH_SIZE = process.env.POSE_DRAIN_BATCH_SIZE || '1';
process.env.AI_VISION_MODEL = process.env.POSE_DRAIN_MODEL || DRAIN_MODEL_POOL[0];
process.env.AI_VISION_MODEL_FALLBACKS =
  process.env.POSE_DRAIN_FALLBACKS || DRAIN_MODEL_POOL.slice(1).join(',');

const { Pool } = require('pg');
const normalization = require('../services/foto-pose-normalization.service');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function msUntilNextUtcDay(extraMs = 5 * 60 * 1000) {
  const now = Date.now();
  const next = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate() + 1,
    0,
    0,
    30,
  );
  return Math.max(60_000, next - now + extraMs);
}

function parseArgs(argv) {
  const opts = {
    maxBatches: 0,
    idleMs: Number(process.env.POSE_DRAIN_IDLE_MS) || 4000,
    waitForQuota: process.env.POSE_DRAIN_WAIT_QUOTA !== '0',
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--max-batches=')) {
      opts.maxBatches = Number(arg.split('=')[1]) || 0;
    } else if (arg.startsWith('--idle-ms=')) {
      opts.idleMs = Math.max(0, Number(arg.split('=')[1]) || 0);
    } else if (arg === '--no-wait-quota') {
      opts.waitForQuota = false;
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

  const started = Date.now();
  let batchIndex = 0;
  let totalProcessed = 0;
  let totalClaimed = 0;
  let consecutiveEmpty = 0;
  let consecutiveTransientOnly = 0;
  let backoffMs = 20000;
  let dayRotations = 0;

  try {
    const before = await normalization.getInventory(pool);
    console.log('=== Drain pose — antes ===');
    console.log(JSON.stringify(before, null, 2));
    console.log(
      `Overrides: BATCH=${normalization.BATCH_LIMIT} DAILY_LIMIT=${process.env.POSE_DAILY_CLASSIFY_LIMIT}`,
    );
    console.log(
      `Vision pool: primary=${process.env.AI_VISION_MODEL} fallbacks=${process.env.AI_VISION_MODEL_FALLBACKS}`,
    );

    const reset = await normalization.resetFailedPhotos(pool, {});
    console.log('\n=== Reset failed → pending ===');
    console.log(JSON.stringify(reset, null, 2));

    for (;;) {
      if (opts.maxBatches > 0 && batchIndex >= opts.maxBatches) {
        console.log(`\nParado por --max-batches=${opts.maxBatches}`);
        break;
      }

      batchIndex += 1;
      const batch = await normalization.processBatch(pool);
      totalProcessed += batch.processed || 0;
      totalClaimed += batch.total || 0;

      const line = {
        batch: batchIndex,
        processed: batch.processed || 0,
        claimed: batch.total || 0,
        transient: batch.transient_deferred || 0,
        skipped_daily_limit: Boolean(batch.skipped_daily_limit),
        cumulative_processed: totalProcessed,
      };
      console.log(`Lote ${batchIndex}:`, line);

      if (batch.skipped_daily_limit) {
        console.error('\nLimite POSE_DAILY_CLASSIFY_LIMIT atingido.');
        if (!opts.waitForQuota) break;
        const waitMs = msUntilNextUtcDay();
        console.log(`Aguardando próximo dia UTC (~${Math.round(waitMs / 60000)} min)...`);
        await sleep(waitMs);
        consecutiveTransientOnly = 0;
        backoffMs = 20000;
        dayRotations += 1;
        continue;
      }

      if (!batch.total) {
        consecutiveEmpty += 1;
        consecutiveTransientOnly = 0;
        if (consecutiveEmpty >= 2) break;
        await sleep(opts.idleMs);
        continue;
      }
      consecutiveEmpty = 0;

      if (batch.transient_deferred > 0 && (batch.processed || 0) === 0) {
        consecutiveTransientOnly += 1;
        if (consecutiveTransientOnly >= 8) {
          if (!opts.waitForQuota) {
            console.error(
              `\nParado: ${consecutiveTransientOnly} lotes só transitórios (cota Gemini esgotada).`,
            );
            break;
          }
          dayRotations += 1;
          const waitMs = msUntilNextUtcDay();
          console.error(
            `\nCota dos modelos esgotada. Dia ${dayRotations}: dormir ~${Math.round(waitMs / 60000)} min até reset UTC.`,
          );
          await sleep(waitMs);
          consecutiveTransientOnly = 0;
          backoffMs = 20000;
          continue;
        }
        console.log(`Backoff ${backoffMs}ms (rate-limit / erro transitório)`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 1.5, 90000);
      } else {
        consecutiveTransientOnly = 0;
        backoffMs = 20000;
        if (opts.idleMs > 0) await sleep(opts.idleMs);
      }

      if (batchIndex % 25 === 0) {
        const mid = await normalization.getInventory(pool);
        console.log(`Checkpoint lote ${batchIndex}:`, mid);
      }
    }

    const after = await normalization.getInventory(pool);
    const elapsedSec = Math.round((Date.now() - started) / 1000);
    console.log('\n=== Drain pose — depois ===');
    console.log(JSON.stringify(after, null, 2));
    console.log('\nMétricas processo:', normalization.getMetrics());
    console.log(
      `Resumo: batches=${batchIndex} claimed=${totalClaimed} classified_ok=${totalProcessed} day_rotations=${dayRotations} elapsed=${elapsedSec}s`,
    );

    const pendingLeft = after.pending || 0;
    const processingLeft = after.processing || 0;
    if (pendingLeft > 0 || processingLeft > 0) {
      console.error(
        `\nBacklog incompleto: pending=${pendingLeft} processing=${processingLeft} failed=${after.failed || 0}`,
      );
      process.exitCode = 2;
    } else {
      console.log('\nBacklog drenado: pending=0 processing=0');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
