/**
 * Progressão de cargas do Logbook — agregação por sessão e período.
 */
const repo = require('../repositories/treino-sessao.repository');
const engine = require('./treino-evolucao.engine');

const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map();

const VALID_PERIODS = new Set(['7', '30', '90', '180', 'all']);

function cacheKey(alunoId, period, exerciseKey, asOf) {
  return `${alunoId}:${period}:${exerciseKey || ''}:${asOf}`;
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

function normalizePeriod(raw) {
  const key = raw == null || raw === '' ? '30' : String(raw);
  if (!VALID_PERIODS.has(key)) {
    const err = new Error('period inválido (use 7, 30, 90, 180 ou all)');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return key;
}

async function getLoadProgression(pool, alunoId, { period, exerciseKey, asOf } = {}) {
  if (!alunoId) {
    const err = new Error('aluno_id é obrigatório');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const periodKey = normalizePeriod(period);
  const asOfIso = String(asOf || engine.todayIso()).slice(0, 10);
  const bounds = engine.periodBounds(periodKey, asOfIso);
  const exKey = exerciseKey ? String(exerciseKey) : null;

  const key = cacheKey(alunoId, periodKey, exKey, asOfIso);
  const cached = readCache(key);
  if (cached) return { ...cached, cached: true };

  let startIso = bounds.start;
  if (!startIso) {
    const earliest = await pool.query(
      `SELECT MIN(data_ref)::text AS min_date
       FROM public.treino_sessoes
       WHERE aluno_id = $1`,
      [alunoId],
    );
    startIso = earliest.rows[0]?.min_date || bounds.end;
  }

  const sessions = await repo.listSessoesWithSeriesInRange(pool, alunoId, startIso, bounds.end);
  const analysis = engine.analyzeLoadProgression({
    sessions,
    periodKey,
    asOf: asOfIso,
    exerciseKey: exKey,
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
  getLoadProgression,
  invalidateAluno,
  CACHE_TTL_MS,
  VALID_PERIODS,
};
