#!/usr/bin/env node
/**
 * Importação inicial Asaas → Black House (conta partilhada ou por coach).
 * Uso: node server/scripts/run-initial-financial-import.js [--coach=UUID]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');
const {
  importCoachFinancialData,
  importSharedAsaasFinancialData,
} = require('../financial/sync/initial-import');
const { usesSharedAsaasAccount } = require('../financial/coach-asaas');

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const coachArg = process.argv.find((a) => a.startsWith('--coach='));
  const coachId = coachArg ? coachArg.split('=')[1] : null;

  try {
    if (coachId) {
      console.log(`➡️  Importação para coach ${coachId}...`);
      await importCoachFinancialData(pool, coachId);
      console.log('✅ Importação concluída para o coach.');
    } else if (usesSharedAsaasAccount()) {
      console.log('➡️  Importação partilhada (conta Asaas única)...');
      const stats = await importSharedAsaasFinancialData(pool);
      console.log('✅ Importação partilhada concluída:');
      console.log(JSON.stringify(stats, null, 2));
    } else {
      const coaches = await pool.query(
        `SELECT DISTINCT coach_id FROM public.alunos WHERE coach_id IS NOT NULL`,
      );
      for (const row of coaches.rows) {
        console.log(`➡️  Importação para coach ${row.coach_id}...`);
        await importCoachFinancialData(pool, row.coach_id);
      }
      console.log('✅ Importação concluída para todos os coaches.');
    }

    const summary = await pool.query(`
      SELECT u.email, a.coach_id,
        (SELECT COUNT(*) FROM public.asaas_customers c WHERE c.coach_id = a.coach_id) AS customers,
        (SELECT COUNT(*) FROM public.asaas_payments p WHERE p.coach_id = a.coach_id) AS payments,
        (SELECT COUNT(*) FROM public.asaas_subscriptions s WHERE s.coach_id = a.coach_id) AS subscriptions
      FROM (SELECT DISTINCT coach_id FROM public.alunos WHERE coach_id IS NOT NULL) a
      JOIN app_auth.users u ON u.id = a.coach_id
      ORDER BY u.email
    `);
    console.log('\n📊 Resumo por coach:');
    for (const row of summary.rows) {
      console.log(
        `   ${row.email}: ${row.customers} clientes, ${row.payments} cobranças, ${row.subscriptions} assinaturas`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
