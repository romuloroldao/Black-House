#!/usr/bin/env node
/**
 * Inventário de fotos para normalização de pose (pré-backfill).
 * Uso: node server/scripts/pose-inventory.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const normalization = require('../services/foto-pose-normalization.service');

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const inv = await normalization.getInventory(pool);
    const estGeminiCalls = inv.pending || 0;
    const costPerCall = Number(process.env.POSE_ESTIMATE_COST_USD) || 0.001;
    console.log('=== Inventário de poses (fotos_alunos) ===');
    console.log(JSON.stringify(inv, null, 2));
    if (inv.metadata_ready) {
      console.log(`\nEstimativa Gemini: ~${estGeminiCalls} chamadas (~$${(estGeminiCalls * costPerCall).toFixed(2)} USD @ $${costPerCall}/call)`);
      const pctUntagged =
        inv.total > 0 ? Math.round(((inv.pending + inv.unknown) / inv.total) * 100) : 0;
      console.log(`Fotos sem classificação definitiva: ~${pctUntagged}%`);
    } else {
      console.log('\n⚠️  Colunas de pose ainda não migradas. Execute server/migrations/20260901_foto_pose_metadata.sql');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
