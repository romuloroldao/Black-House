#!/usr/bin/env node
/**
 * Remove cópias legadas de treinos: reponta atribuições ao template, grava overrides, apaga cópias.
 * Idempotente — cópias já migradas são ignoradas.
 *
 * Uso: npm run db:cleanup-treinos
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { migrateAllLegacyCopies } = require('../services/effective-workout.service');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function countCopies() {
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM public.treinos WHERE aluno_id IS NOT NULL`,
  );
  return r.rows[0]?.n ?? 0;
}

async function simpleRepointAndDelete(client) {
  const upd = await client.query(`
    UPDATE public.alunos_treinos at
    SET treino_id = t.template_origem_id
    FROM public.treinos t
    WHERE at.treino_id = t.id
      AND t.aluno_id IS NOT NULL
      AND t.template_origem_id IS NOT NULL
  `);
  const del = await client.query(
    `DELETE FROM public.treinos WHERE aluno_id IS NOT NULL RETURNING id`,
  );
  return { repointed: upd.rowCount ?? 0, deleted: del.rowCount ?? 0 };
}

async function main() {
  const schemaPath = path.resolve(__dirname, '../migrations/20260613_treino_biblioteca_apenas.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  await client.connect();

  const antes = await countCopies();
  console.log(`➡️ Cópias por aluno na biblioteca (antes): ${antes}`);

  try {
    console.log('➡️ Garantindo tabelas de overrides…');
    await client.query(sql);
  } catch (schemaErr) {
    console.warn('⚠️ Schema overrides (opcional):', schemaErr.message);
  }

  if (antes > 0) {
    console.log('➡️ Repontando atribuições ao template e removendo cópias…');
    try {
      const result = await migrateAllLegacyCopies(client);
      console.log('   Migração com overrides:', result);
    } catch (migrateErr) {
      console.warn('⚠️ Migração com overrides falhou, fallback simples:', migrateErr.message);
      const fallback = await simpleRepointAndDelete(client);
      console.log('   Fallback repoint/delete:', fallback);
    }

    const restantes = await countCopies();
    if (restantes > 0) {
      console.log('➡️ Fallback final: repoint + delete…');
      const fallback = await simpleRepointAndDelete(client);
      console.log('   Resultado:', fallback);
    }
  } else {
    console.log('✅ Nenhuma cópia legada encontrada.');
  }

  const depois = await countCopies();
  const biblioteca = await client.query(
    `SELECT COUNT(*)::int AS n FROM public.treinos WHERE aluno_id IS NULL`,
  );

  console.log(`✅ Cópias restantes: ${depois}`);
  console.log(`✅ Treinos na biblioteca: ${biblioteca.rows[0]?.n ?? 0}`);

  if (depois > 0) {
    console.warn('⚠️ Ainda existem cópias. Verifique vínculos órfãos ou permissões.');
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('❌ Falha:', err.message);
    process.exit(1);
  })
  .finally(() => client.end());
