#!/usr/bin/env node
/**
 * Aplica migration 20260612 + converte cópias legadas em atribuições por referência.
 *
 * Uso (na raiz do repo, com server/.env configurado):
 *   node server/scripts/migrate-treino-copias-to-overrides.js
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

async function main() {
  const migrationPath = path.resolve(__dirname, '../migrations/20260612_treino_atribuicao_overrides.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  await client.connect();
  console.log('➡️ Aplicando schema de overrides…');
  await client.query(sql);
  console.log('✅ Schema aplicado');

  console.log('➡️ Migrando cópias legadas para overrides…');
  const result = await migrateAllLegacyCopies(client);
  console.log('✅ Migração concluída:', result);
}

main()
  .catch((err) => {
    console.error('❌ Falha:', err.message);
    process.exit(1);
  })
  .finally(() => client.end());
