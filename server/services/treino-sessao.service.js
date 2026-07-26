/**
 * Serviço: sessões de treino e logs de séries/cargas.
 */
const crypto = require('crypto');
const repo = require('../repositories/treino-sessao.repository');

function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function stableUuid(seed) {
  const hash = crypto.createHash('sha256').update(String(seed)).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function validationError(message, code = 'VALIDATION_ERROR') {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function forbiddenError(message, code = 'FORBIDDEN') {
  const err = new Error(message);
  err.statusCode = 403;
  err.code = code;
  return err;
}

function notFoundError(message, code = 'NOT_FOUND') {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = code;
  return err;
}

async function recordWorkoutAdherence(pool, { alunoId, coachId, dataRef, treinoId, sessaoId }) {
  if (!coachId) return;
  try {
    const entityId = `${alunoId}:${dataRef}:${treinoId}`;
    const flowCycleId = stableUuid(`workout_daily:${entityId}`);
    await pool.query(
      `INSERT INTO public.task_adherence_events (
         domain, entity_id, aluno_id, coach_id, flow_cycle_id, outcome, metadata
       ) VALUES (
         'workout_daily'::public.task_domain, $1, $2, $3, $4::uuid, 'completed', $5::jsonb
       )
       ON CONFLICT (domain, entity_id, flow_cycle_id, outcome) DO NOTHING`,
      [
        entityId,
        alunoId,
        coachId,
        flowCycleId,
        JSON.stringify({ treino_id: treinoId, sessao_id: sessaoId, data_ref: dataRef }),
      ],
    );
  } catch (err) {
    console.warn('recordWorkoutAdherence skipped:', err.message);
  }
}

async function getDayPayload(pool, alunoId, { date, treinoId } = {}) {
  const dataRef = date || todayIso();
  let sessoes = await repo.listSessoesByAlunoAndDate(pool, alunoId, dataRef);
  if (treinoId) {
    sessoes = sessoes.filter((s) => s.treino_id === treinoId);
  }
  const enriched = [];
  for (const s of sessoes) {
    const series = await repo.listSeriesBySessao(pool, s.id);
    const completedIndexes = Array.isArray(s.metadata?.completedIndexes)
      ? s.metadata.completedIndexes
      : series
          .filter((x) => x.concluido)
          .map((x) => x.exercise_index)
          .filter((v, i, a) => a.indexOf(v) === i);
    enriched.push({
      ...s,
      series,
      completed_indexes: completedIndexes,
      series_count: series.length,
    });
  }
  return { data_ref: dataRef, sessoes: enriched, gerado_em: new Date().toISOString() };
}

async function startOrGetSession(pool, alunoId, body) {
  const treinoId = body.treino_id;
  if (!treinoId) throw validationError('treino_id é obrigatório');

  const vinculo = await repo.assertTreinoAtribuido(pool, alunoId, treinoId);
  if (!vinculo) throw forbiddenError('Treino não atribuído a este aluno', 'TREINO_FORBIDDEN');

  const dataRef = body.data_ref || todayIso();
  const sessao = await repo.upsertSessao(pool, {
    aluno_id: alunoId,
    aluno_treino_id: body.aluno_treino_id || vinculo.aluno_treino_id,
    treino_id: treinoId,
    data_ref: dataRef,
    status: 'in_progress',
    origem: body.origem === 'agent' ? 'agent' : 'ui',
    metadata: body.metadata || {},
  });

  const series = await repo.listSeriesBySessao(pool, sessao.id);
  return {
    ...sessao,
    series,
    completed_indexes: Array.isArray(sessao.metadata?.completedIndexes)
      ? sessao.metadata.completedIndexes
      : [],
  };
}

async function patchSession(pool, alunoId, alunoRow, sessaoId, body) {
  const existing = await repo.getSessaoById(pool, sessaoId);
  if (!existing || existing.aluno_id !== alunoId) {
    throw notFoundError('Sessão não encontrada');
  }

  const patch = {};
  if (body.status != null) {
    if (!['in_progress', 'completed', 'abandoned'].includes(body.status)) {
      throw validationError('status inválido');
    }
    patch.status = body.status;
  }
  if (body.metadata != null || body.completed_indexes != null) {
    const meta = { ...(existing.metadata || {}), ...(body.metadata || {}) };
    if (Array.isArray(body.completed_indexes)) {
      meta.completedIndexes = body.completed_indexes.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    }
    patch.metadata = meta;
  }

  const updated = await repo.updateSessao(pool, sessaoId, alunoId, patch);
  if (updated?.status === 'completed') {
    await recordWorkoutAdherence(pool, {
      alunoId,
      coachId: alunoRow?.coach_id,
      dataRef: updated.data_ref,
      treinoId: updated.treino_id,
      sessaoId: updated.id,
    });
  }
  return updated;
}

async function upsertSerieLog(pool, alunoId, sessaoId, body) {
  const existing = await repo.getSessaoById(pool, sessaoId);
  if (!existing || existing.aluno_id !== alunoId) {
    throw notFoundError('Sessão não encontrada');
  }

  const exerciseIndex = Number(body.exercise_index);
  if (!Number.isFinite(exerciseIndex) || exerciseIndex < 0) {
    throw validationError('exercise_index inválido');
  }
  const exerciseName = String(body.exercise_name || '').trim() || `Exercício ${exerciseIndex + 1}`;
  const setIndex = body.set_index != null ? Number(body.set_index) : 1;

  const serie = await repo.upsertSerie(pool, {
    sessao_id: sessaoId,
    aluno_id: alunoId,
    exercise_index: exerciseIndex,
    exercise_name: exerciseName,
    set_index: Number.isFinite(setIndex) && setIndex >= 1 ? setIndex : 1,
    carga: body.carga != null ? String(body.carga) : null,
    repeticoes: body.repeticoes != null && body.repeticoes !== '' ? Number(body.repeticoes) : null,
    rpe: body.rpe != null && body.rpe !== '' ? Number(body.rpe) : null,
    dor: body.dor != null && body.dor !== '' ? Number(body.dor) : null,
    concluido: body.concluido !== false,
    origem: body.origem === 'agent' ? 'agent' : 'ui',
    metadata: body.metadata || {},
  });

  // completedIndexes é autoritativo via PATCH (UI/agente) — não derivar de cada série
  // (um exercício tem várias séries; a 1ª não marca o exercício como completo).
  return serie;
}

async function listCargas(pool, alunoId, treinoId) {
  if (!treinoId) throw validationError('treino_id é obrigatório');
  const rows = await repo.listCargasHistorico(pool, alunoId, treinoId);
  // Agrupa por data no formato compatível com o frontend local
  const byDate = new Map();
  for (const row of rows) {
    const dateKey = String(row.data_ref).slice(0, 10);
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        date: dateKey,
        treinoId,
        exercises: [],
      });
    }
    const session = byDate.get(dateKey);
    const existing = session.exercises.find((e) => e.exerciseIndex === row.exercise_index);
    if (existing) {
      if (row.carga) existing.pesoUsado = row.carga;
    } else {
      session.exercises.push({
        exerciseIndex: row.exercise_index,
        exerciseName: row.exercise_name,
        pesoUsado: row.carga || '',
      });
    }
  }
  return [...byDate.values()].slice(0, 24);
}

module.exports = {
  todayIso,
  getDayPayload,
  startOrGetSession,
  patchSession,
  upsertSerieLog,
  listCargas,
};
