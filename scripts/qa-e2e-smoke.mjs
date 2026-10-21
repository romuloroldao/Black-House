#!/usr/bin/env node
/**
 * QA E2E smoke — Black House (coach + aluno)
 * Gera JWT localmente (mesmo segredo da API) para testes autenticados.
 */
import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const API = process.env.VITE_API_URL || process.env.API_URL || 'https://api.blackhouse.app.br';
const JWT_SECRET = process.env.JWT_SECRET;
const { Pool } = pg;

if (!JWT_SECRET) {
  console.error('JWT_SECRET missing');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function mintToken(userId, role, payment_status = 'CURRENT') {
  return jwt.sign({ userId, role, payment_status }, JWT_SECRET, { expiresIn: '2h' });
}

async function api(token, method, endpoint, body) {
  const url = endpoint.startsWith('http') ? endpoint : `${API}${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const started = Date.now();
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text.slice(0, 200) };
    }
    return { ok: res.ok, status: res.status, ms: Date.now() - started, json };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - started, error: err.message };
  }
}

async function resolveUser(email) {
  const r = await pool.query(
    `SELECT u.id, u.email, u.email_confirmed_at, ur.role
     FROM app_auth.users u
     JOIN public.user_roles ur ON ur.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
    [email],
  );
  return r.rows[0] || null;
}

async function pickStudentWithData(coachUserId) {
  const r = await pool.query(
    `SELECT a.id, a.nome, u.email, u.email_confirmed_at,
       (SELECT COUNT(*) FROM public.dietas d WHERE d.aluno_id = a.id AND d.ativa = true) AS dietas,
       (SELECT COUNT(*) FROM public.alunos_treinos at WHERE at.aluno_id = a.id) AS treinos
     FROM public.alunos a
     JOIN app_auth.users u ON u.id = a.user_id
     JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'aluno'
     WHERE a.coach_id = (SELECT id FROM public.coach_profiles WHERE user_id = $1 LIMIT 1)
       AND u.email_confirmed_at IS NOT NULL
     ORDER BY dietas DESC, treinos DESC
     LIMIT 1`,
    [coachUserId],
  );
  return r.rows[0] || null;
}

const results = [];

function record(area, name, pass, detail = '') {
  results.push({ area, name, pass, detail });
  const icon = pass ? '✓' : '✗';
  console.log(`${icon} [${area}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function runCoachTests(token, coachEmail) {
  const area = 'coach-api';
  const checks = [
    ['GET /auth/user', 'GET', '/auth/user'],
    ['GET /api/me', 'GET', '/api/me'],
    ['GET alunos by coach', 'GET', '/api/alunos/by-coach'],
    ['GET checkins pendentes count', 'GET', '/api/weekly-checkins/pendentes/count'],
    ['GET weekly-checkins', 'GET', '/api/weekly-checkins'],
    ['GET videos', 'GET', '/api/videos'],
    ['GET educational-contents', 'GET', '/api/educational-contents'],
    ['GET treinos', 'GET', '/api/treinos'],
    ['GET conversas', 'GET', '/api/conversas'],
    ['GET notificacoes', 'GET', '/api/notificacoes'],
    ['GET alimentos', 'GET', '/api/alimentos?limit=5'],
  ];
  for (const [name, method, ep] of checks) {
    const r = await api(token, method, ep);
    record(area, name, r.ok, r.ok ? `${r.status} (${r.ms}ms)` : `${r.status} ${r.error || JSON.stringify(r.json)?.slice(0, 80)}`);
  }

  const brokenNome = await pool.query(
    `SELECT cp.nome FROM public.coach_profiles cp WHERE cp.user_id = (SELECT id FROM app_auth.users WHERE email = $1 LIMIT 1) LIMIT 1`,
    [coachEmail],
  ).catch((e) => ({ error: e.message }));
  record(
    'coach-data',
    'coach_profiles.nome column (bug check-in notify)',
    !!brokenNome.error,
    brokenNome.error ? brokenNome.error.slice(0, 60) : 'column exists unexpectedly',
  );
}

async function runStudentTests(token, alunoId) {
  const area = 'aluno-api';
  const checks = [
    ['GET /auth/user', 'GET', '/auth/user'],
    ['GET /api/me', 'GET', '/api/me'],
    ['GET aluno hoje', 'GET', '/api/alunos/hoje'],
    ['GET dietas', 'GET', `/api/dietas?aluno_id=${alunoId}`],
    ['GET treinos aluno', 'GET', `/api/alunos-treinos?aluno_id=${alunoId}`],
    ['GET weekly-checkins', 'GET', '/api/weekly-checkins'],
    ['GET videos', 'GET', '/api/videos'],
    ['GET educational-contents', 'GET', '/api/educational-contents'],
    ['GET conversas', 'GET', '/api/conversas'],
    ['GET notificacoes', 'GET', '/api/notificacoes'],
    ['GET relatorios', 'GET', '/api/relatorios'],
  ];
  for (const [name, method, ep] of checks) {
    const r = await api(token, method, ep);
    record(area, name, r.ok, r.ok ? `${r.status} (${r.ms}ms)` : `${r.status} ${r.error || JSON.stringify(r.json)?.slice(0, 80)}`);
  }
}

async function runPublicSmoke() {
  const area = 'public';
  for (const [name, ep, expect] of [
    ['health', '/health', 200],
    ['auth routes need creds', '/api/me', 401],
    ['checkins pendentes auth', '/api/weekly-checkins/pendentes/count', 401],
  ]) {
    const r = await fetch(`${API}${ep}`);
    record(area, name, r.status === expect, `status ${r.status}`);
  }
}

async function main() {
  console.log(`\n=== Black House QA E2E Smoke ===\nAPI: ${API}\n`);

  await runPublicSmoke();

  const coachEmail = 'romulo.roldao@gmail.com';
  const coach = await resolveUser(coachEmail);
  if (!coach) {
    record('setup', 'coach user', false, coachEmail);
  } else {
    record('setup', 'coach user', true, coach.email);
    const coachToken = mintToken(coach.id, coach.role);
    await runCoachTests(coachToken, coach.email);

    const student = await pickStudentWithData(coach.id);
    if (!student) {
      record('setup', 'student with data', false, 'none found for coach');
    } else {
      record('setup', 'student with data', true, `${student.nome} (${student.email})`);
      const studentUser = await resolveUser(student.email);
      const studentToken = mintToken(studentUser.id, 'aluno', 'CURRENT');
      await runStudentTests(studentToken, student.id);

      const ederlon = await pool.query(
        `SELECT COUNT(*)::int AS checkins FROM public.weekly_checkins WHERE aluno_id = '307d42bd-01d8-466f-90e2-8712ad5a4ae5'`,
      );
      record(
        'regression',
        'Ederlon Barbosa tem check-ins',
        ederlon.rows[0].checkins > 0,
        `${ederlon.rows[0].checkins} check-ins na BD`,
      );
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== Resumo: ${results.length - failed.length}/${results.length} OK, ${failed.length} falhas ===\n`);

  const outPath = path.join(__dirname, '..', 'docs', 'arquivo', '2026-06-07-qa-e2e-resultado.json');
  await import('fs').then(({ writeFileSync }) =>
    writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), api: API, results }, null, 2)),
  );
  console.log(`Resultado JSON: ${outPath}`);

  await pool.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
