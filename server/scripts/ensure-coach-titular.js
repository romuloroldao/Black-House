#!/usr/bin/env node
/**
 * Garante que um utilizador funciona como coach titular (não assistente/aluno).
 * Uso: node server/scripts/ensure-coach-titular.js ariadne.coach@gmail.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'blackhouse_db',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD,
});

async function ensureCoachTitular(emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw new Error('Email inválido');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT id, email, email_confirmed_at FROM app_auth.users WHERE lower(email) = $1 LIMIT 1',
      [email],
    );
    if (!userRes.rows[0]) {
      throw new Error(`Utilizador não encontrado: ${email}`);
    }
    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO public.user_roles (user_id, role)
       VALUES ($1, 'coach')
       ON CONFLICT (user_id) DO UPDATE SET role = 'coach'`,
      [userId],
    );

    await client.query(
      `INSERT INTO public.coach_profiles (user_id, nome_completo)
       SELECT $1,
              COALESCE(
                NULLIF(TRIM(p.display_name), ''),
                NULLIF(TRIM(cp.nome_completo), ''),
                INITCAP(REPLACE(SPLIT_PART(COALESCE(u.email, ''), '@', 1), '.', ' '))
              )
       FROM app_auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
       LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    await client.query(
      `UPDATE public.coach_team_members
       SET ativo = false
       WHERE member_user_id = $1 AND ativo = true`,
      [userId],
    );

    const alunoRes = await client.query(
      `DELETE FROM public.alunos
       WHERE lower(email) = $1 OR user_id = $2
       RETURNING id, email, nome`,
      [email, userId],
    );

    await client.query(
      `UPDATE app_auth.users
       SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
       WHERE id = $1`,
      [userId],
    );

    await client.query('COMMIT');

    const verify = await pool.query(
      `SELECT u.id, u.email, ur.role, cp.id AS coach_profile_id, cp.nome_completo
       FROM app_auth.users u
       LEFT JOIN public.user_roles ur ON ur.user_id = u.id
       LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    console.log('✅ Coach titular configurado:', verify.rows[0]);
    if (alunoRes.rows.length > 0) {
      console.log('🗑️  Fichas de aluno removidas:', alunoRes.rows);
    } else {
      console.log('ℹ️  Nenhuma ficha de aluno órfã encontrada.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const email = process.argv[2] || 'ariadne.coach@gmail.com';
ensureCoachTitular(email).catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
