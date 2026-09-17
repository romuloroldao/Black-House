const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { getWeeklyEvolution, invalidateAluno } = require('../services/treino-evolucao.service');

describe('treino-evolucao.service', () => {
  test('returns empty analysis when there are no sessions', async () => {
    const pool = {
      query: async (sql) => {
        if (sql.includes('FROM public.treino_sessoes')) return { rows: [] };
        if (sql.includes('aluno_treino_agenda')) return { rows: [] };
        if (sql.includes('FROM public.treinos')) return { rows: [] };
        return { rows: [] };
      },
    };
    const out = await getWeeklyEvolution(pool, 'aluno-1', { asOf: '2026-08-19', audience: 'aluno' });
    assert.equal(out.empty, true);
    assert.equal(out.confidence, 'none');
    assert.equal(out.aluno_id, 'aluno-1');
  });

  test('cache hits on second call and invalidate clears it', async () => {
    let sessaoQueries = 0;
    const pool = {
      query: async (sql) => {
        if (sql.includes('FROM public.treino_sessoes')) {
          sessaoQueries += 1;
          return { rows: [] };
        }
        return { rows: [] };
      },
    };
    await getWeeklyEvolution(pool, 'aluno-cache', { asOf: '2026-08-19' });
    await getWeeklyEvolution(pool, 'aluno-cache', { asOf: '2026-08-19' });
    assert.equal(sessaoQueries, 1);
    invalidateAluno('aluno-cache');
    await getWeeklyEvolution(pool, 'aluno-cache', { asOf: '2026-08-19' });
    assert.equal(sessaoQueries, 2);
  });
});
