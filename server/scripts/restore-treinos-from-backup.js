#!/usr/bin/env node
/**
 * Restaura exercicios de treinos da biblioteca a partir de backup PostgreSQL.
 * Uso: node server/scripts/restore-treinos-from-backup.js [/caminho/backup.sql.gz]
 *
 * Default: /var/backups/postgresql/backup_20260611_105901.sql.gz
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const backupPath = process.argv[2] || '/var/backups/postgresql/backup_20260611_105901.sql.gz';

function parseLibraryTreinosFromBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup não encontrado: ${filePath}`);
  }
  const raw = execSync(`zcat ${filePath} | awk '/^COPY public.treinos /,/^\\\\.$/'`, {
    maxBuffer: 80 * 1024 * 1024,
  }).toString();
  const lines = raw.split('\n').filter((l) => l && !l.startsWith('COPY') && l !== '\\.');
  return lines
    .map((line) => {
      const p = line.split('\t');
      let exercicios = [];
      try {
        if (p[12] && p[12] !== '\\N') exercicios = JSON.parse(p[12]);
      } catch {
        return null;
      }
      return {
        id: p[0],
        nome: p[1],
        alunoId: p[13] === '\\N' ? null : p[13],
        exercicios,
        numExercicios: parseInt(p[6], 10) || exercicios.length,
      };
    })
    .filter((r) => r && !r.alunoId);
}

async function main() {
  const library = parseLibraryTreinosFromBackup(backupPath);
  console.log(`➡️ ${library.length} treinos na biblioteca no backup`);

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();

  let restored = 0;
  let skipped = 0;
  for (const row of library) {
    const cur = await client.query(
      `SELECT jsonb_array_length(COALESCE(exercicios, '[]'::jsonb)) AS ex FROM public.treinos WHERE id = $1 AND aluno_id IS NULL`,
      [row.id],
    );
    if (cur.rows.length === 0) {
      console.log(`⏭️  ${row.nome}: não existe na biblioteca actual`);
      skipped += 1;
      continue;
    }
    const curEx = Number(cur.rows[0].ex);
    if (curEx >= row.exercicios.length) {
      skipped += 1;
      continue;
    }
    await client.query(
      `UPDATE public.treinos
       SET exercicios = $1::jsonb, num_exercicios = $2, updated_at = now()
       WHERE id = $3 AND aluno_id IS NULL`,
      [JSON.stringify(row.exercicios), row.numExercicios, row.id],
    );
    console.log(`✅ ${row.nome}: restaurado (${curEx} → ${row.exercicios.length} exercícios)`);
    restored += 1;
  }

  console.log(`\nConcluído: ${restored} restaurados, ${skipped} sem alteração.`);
  await client.end();
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
