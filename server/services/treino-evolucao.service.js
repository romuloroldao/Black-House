/**
 * Agrega logs de treino e devolve a leitura semanal.
 * Cálculo no engine; aqui só I/O, cache curto e prescrição.
 */
const repo = require('../repositories/treino-sessao.repository');
const engine = require('./treino-evolucao.engine');

const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map();

function cacheKey(alunoId, weekStart, audience) {
  return `${alunoId}:${weekStart}:${audience}`;
}

function invalidateAluno(alunoId) {
  const prefix = `${alunoId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

async function prescribedSetsByTreino(pool, treinoIds) {
  const ids = [...new Set((treinoIds || []).filter(Boolean))];
  const map = {};
  if (ids.length === 0) return map;
  const r = await pool.query(
    `SELECT id, exercicios FROM public.treinos WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  for (const row of r.rows) {
    const list = Array.isArray(row.exercicios) ? row.exercicios : [];
    let total = 0;
    for (const ex of list) {
      total += engine.parsePrescribedSets(ex?.series ?? ex?.sets);
    }
    map[row.id] = total;
  }
  return map;
}

async function agendaWeekdays(pool, alunoId) {
  try {
    const r = await pool.query(
      `SELECT DISTINCT dia_semana FROM public.aluno_treino_agenda WHERE aluno_id = $1`,
      [alunoId],
    );
    return r.rows.map((row) => Number(row.dia_semana)).filter((n) => n >= 1 && n <= 7);
  } catch (_) {
    return [];
  }
}

async function getWeeklyEvolution(pool, alunoId, { asOf, audience = 'aluno' } = {}) {
  if (!alunoId) {
    const err = new Error('aluno_id é obrigatório');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const asOfIso = String(asOf || engine.todayIso()).slice(0, 10);
  const week = engine.weekBounds(asOfIso);
  const role = audience === 'coach' ? 'coach' : 'aluno';
  const key = cacheKey(alunoId, week.start, role);
  const cached = readCache(key);
  if (cached) return { ...cached, cached: true };

  const lookbackStart = engine.addDaysIso(week.start, -21);
  const sessions = await repo.listSessoesWithSeriesInRange(pool, alunoId, lookbackStart, week.end);
  const [agenda, prescribed] = await Promise.all([
    agendaWeekdays(pool, alunoId),
    prescribedSetsByTreino(
      pool,
      sessions.map((s) => s.treino_id),
    ),
  ]);

  const analysis = engine.analyzeWeeklyEvolution({
    sessions,
    agendaWeekdays: agenda,
    prescribedSetsByTreino: prescribed,
    asOf: asOfIso,
    audience: role,
  });

  const payload = {
    aluno_id: alunoId,
    gerado_em: new Date().toISOString(),
    cached: false,
    ...analysis,
  };
  cache.set(key, { at: Date.now(), value: payload });
  return payload;
}

module.exports = {
  getWeeklyEvolution,
  invalidateAluno,
  CACHE_TTL_MS,
};
