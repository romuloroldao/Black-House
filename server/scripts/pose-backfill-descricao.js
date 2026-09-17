#!/usr/bin/env node
/**
 * Plano B — backfill imediato de pose_efetiva a partir de descricao legada.
 * Usado quando a visão Gemini está com quota limitada e o coach precisa do comparativo.
 *
 * Só aplica quando:
 * - descricao tem tag válida (frente/costas/lados)
 * - sem correção do coach
 * - pose_efetiva ainda desconhecida ou análise pending/failed
 *
 * Uso: node server/scripts/pose-backfill-descricao.js [--dry-run]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const VALID = ['frente', 'costas', 'lado_esquerdo', 'lado_direito'];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM public.fotos_alunos
       WHERE pose_coach IS NULL
         AND descricao = ANY($1::text[])
         AND (pose_efetiva IS NULL OR pose_efetiva = 'desconhecido')
         AND pose_analysis_status IN ('pending', 'failed')`,
      [VALID],
    );
    const eligible = countRes.rows[0]?.n || 0;
    console.log(`Fotos elegíveis para backfill legado: ${eligible}`);

    if (dryRun || eligible === 0) {
      if (dryRun) console.log('(dry-run — nenhuma alteração)');
      return;
    }

    const result = await pool.query(
      `UPDATE public.fotos_alunos
       SET
         pose_efetiva = descricao,
         pose_source = 'legacy_descricao',
         pose_aluno = COALESCE(pose_aluno, descricao),
         pose_analysis_status = 'classified',
         pose_analyzed_at = COALESCE(pose_analyzed_at, created_at, now())
       WHERE pose_coach IS NULL
         AND descricao = ANY($1::text[])
         AND (pose_efetiva IS NULL OR pose_efetiva = 'desconhecido')
         AND pose_analysis_status IN ('pending', 'failed')`,
      [VALID],
    );
    console.log(`Backfill concluído: ${result.rowCount} fotos actualizadas.`);

    const inv = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE pose_analysis_status = 'classified')::int AS classified,
         COUNT(*) FILTER (WHERE pose_efetiva = 'desconhecido')::int AS unknown,
         COUNT(*) FILTER (WHERE pose_source = 'legacy_descricao')::int AS legacy
       FROM public.fotos_alunos`,
    );
    console.log('Estado:', inv.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
