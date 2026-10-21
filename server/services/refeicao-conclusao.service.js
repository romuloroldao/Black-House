/**
 * Serviço: conclusões de refeições do plano.
 */
const crypto = require('crypto');
const repo = require('../repositories/refeicao-conclusao.repository');

function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizePlano(plano) {
  if (plano == null || plano === '') return 'A';
  const s = String(plano).trim().toUpperCase();
  if (s === 'UNICO') return 'UNICO';
  if (/^[A-Z]$/.test(s)) return s;
  return 'A';
}

function stableUuid(seed) {
  const hash = crypto.createHash('sha256').update(String(seed)).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function recordMealAdherence(pool, { alunoId, coachId, dataRef, mealKey, dietaId, concluido }) {
  if (!coachId || !concluido) return;
  try {
    const entityId = `${alunoId}:${dataRef}:${mealKey}`;
    const flowCycleId = stableUuid(`meal_daily:${entityId}`);
    await pool.query(
      `INSERT INTO public.task_adherence_events (
         domain, entity_id, aluno_id, coach_id, flow_cycle_id, outcome, metadata
       ) VALUES (
         'meal_daily'::public.task_domain, $1, $2, $3, $4::uuid, 'completed', $5::jsonb
       )
       ON CONFLICT (domain, entity_id, flow_cycle_id, outcome) DO NOTHING`,
      [
        entityId,
        alunoId,
        coachId,
        flowCycleId,
        JSON.stringify({ dieta_id: dietaId, meal_key: mealKey, data_ref: dataRef }),
      ],
    );
  } catch (err) {
    console.warn('recordMealAdherence skipped:', err.message);
  }
}

async function listForAluno(pool, alunoId, { date } = {}) {
  const dataRef = date || todayIso();
  return repo.listByAlunoAndDate(pool, alunoId, dataRef);
}

async function upsertForAluno(pool, alunoId, alunoRow, body) {
  const dietaId = body.dieta_id;
  const mealKey = String(body.meal_key || '').trim();
  if (!dietaId || !mealKey) {
    const err = new Error('dieta_id e meal_key são obrigatórios');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const owns = await repo.assertDietaOwnsAluno(pool, dietaId, alunoId);
  if (!owns) {
    const err = new Error('Dieta não pertence a este aluno');
    err.statusCode = 403;
    err.code = 'DIETA_FORBIDDEN';
    throw err;
  }

  const dataRef = body.data_ref || todayIso();
  const plano = normalizePlano(body.plano);
  const concluido = body.concluido !== false;

  const row = await repo.upsertConclusao(pool, {
    aluno_id: alunoId,
    dieta_id: dietaId,
    data_ref: dataRef,
    meal_key: mealKey,
    plano,
    concluido,
    origem: body.origem === 'agent' || body.origem === 'import' ? body.origem : 'ui',
    metadata: body.metadata || {},
  });

  await recordMealAdherence(pool, {
    alunoId,
    coachId: alunoRow?.coach_id,
    dataRef,
    mealKey,
    dietaId,
    concluido,
  });

  return row;
}

module.exports = {
  todayIso,
  normalizePlano,
  listForAluno,
  upsertForAluno,
};
