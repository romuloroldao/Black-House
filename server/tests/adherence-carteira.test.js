/**
 * Phase 7 — carteira de aderência + ranking determinístico da inbox (sem DB).
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeAdherenceAttentionScore,
  isQuedaExecucao7d,
  compareInboxForTriagem,
  SCORE_PENDING_CHECKIN,
  SCORE_MISS_CAP,
  SCORE_DIET_LOW,
  SCORE_WORKOUT_LOW,
} = require('../services/adherence-carteira-score');
const { computeWindowMetrics } = require('../services/behavioral-insight.service');

describe('computeAdherenceAttentionScore', () => {
  test('pesos alinhados: check-in pendente 40, misses×8 cap 40, dieta <40% 20, treino <50% 15', () => {
    assert.equal(
      computeAdherenceAttentionScore({ pendingCheckin: true }).score,
      SCORE_PENDING_CHECKIN,
    );
    assert.equal(computeAdherenceAttentionScore({ missDays: 5 }).score, 40);
    assert.equal(computeAdherenceAttentionScore({ missDays: 6 }).score, SCORE_MISS_CAP);
    assert.equal(computeAdherenceAttentionScore({ mealPct: 39 }).score, SCORE_DIET_LOW);
    assert.equal(computeAdherenceAttentionScore({ mealPct: 40 }).score, 0);
    assert.equal(computeAdherenceAttentionScore({ workoutPct: 49 }).score, SCORE_WORKOUT_LOW);
    assert.equal(computeAdherenceAttentionScore({ workoutPct: 50 }).score, 0);
    assert.equal(
      computeAdherenceAttentionScore({
        pendingCheckin: true,
        missDays: 5,
        mealPct: 10,
        workoutPct: 10,
      }).score,
      40 + 40 + 20 + 15,
    );
  });

  test('null rates não penalizam', () => {
    assert.equal(
      computeAdherenceAttentionScore({ mealPct: null, workoutPct: null, missDays: 0 }).score,
      0,
    );
  });
});

describe('isQuedaExecucao7d', () => {
  test('ignora check-in pendente e detecta queda de execução', () => {
    assert.equal(isQuedaExecucao7d({ pendingCheckin: true, missDays: 0 }), false);
    assert.equal(isQuedaExecucao7d({ mealPct: 20 }), true);
    assert.equal(isQuedaExecucao7d({ workoutPct: 30 }), true);
    assert.equal(isQuedaExecucao7d({ missDays: 1 }), true);
    assert.equal(isQuedaExecucao7d({ mealPct: 80, workoutPct: 80, missDays: 0 }), false);
  });
});

describe('compareInboxForTriagem', () => {
  test('ordena por score, depois prioridade, depois recência — sem LLM', () => {
    const items = [
      { attentionScore: 20, checkinPrioridade: false, createdAt: '2026-08-19T10:00:00.000Z', id: 'c' },
      { attentionScore: 40, checkinPrioridade: false, createdAt: '2026-08-18T10:00:00.000Z', id: 'a' },
      { attentionScore: 40, checkinPrioridade: true, createdAt: '2026-08-17T10:00:00.000Z', id: 'b' },
      { attentionScore: 40, checkinPrioridade: true, createdAt: '2026-08-19T12:00:00.000Z', id: 'd' },
    ];
    const sorted = items.slice().sort(compareInboxForTriagem);
    assert.deepEqual(
      sorted.map((i) => i.id),
      ['d', 'b', 'a', 'c'],
    );
  });
});

describe('computeWindowMetrics (insight 7d reutilizado)', () => {
  test('streak e misses na janela', () => {
    const m = computeWindowMetrics({
      days: 7,
      end: '2026-08-19',
      hasActiveDieta: true,
      mealDays: new Set(['2026-08-19', '2026-08-18', '2026-08-17']),
      workoutCompletedDays: new Set(),
      agendaDias: new Set(),
    });
    assert.equal(m.streak_days, 3);
    assert.equal(m.meal_days, 3);
    assert.equal(m.meal_expected, 7);
    assert.equal(m.miss_days, 4); // dias fechados 18..13: 18 e 17 ok, 16-13 miss = 4? Wait
    // i=0 today 19 meal ok, not counted as miss
    // i=1 18 ok
    // i=2 17 ok
    // i=3 16 miss
    // i=4 15 miss
    // i=5 14 miss
    // i=6 13 miss
    // miss_days = 4 yes
  });
});
