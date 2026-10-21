/**
 * Progressão de cargas (Logbook) — regras determinísticas.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyTrend,
  analyzeLoadProgression,
  periodBounds,
  exerciseKey,
} = require('../services/treino-evolucao.engine');

const SLOT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function set(partial) {
  return {
    exercise_name: 'Supino reto',
    exercise_index: 0,
    set_index: 1,
    slot_key: SLOT_A,
    carga: '60',
    repeticoes: 10,
    ...partial,
  };
}

function session(date, series, extra = {}) {
  return {
    id: `s-${date}`,
    data_ref: date,
    treino_id: 'treino-a',
    status: 'completed',
    series,
    ...extra,
  };
}

describe('classifyTrend', () => {
  test('dados insuficientes com menos de 2 cargas', () => {
    assert.equal(classifyTrend([{ carga: 60, unidade: 'kg' }]), 'dados_insuficientes');
    assert.equal(classifyTrend([]), 'dados_insuficientes');
  });

  test('evoluindo quando delta > LOAD_EPS', () => {
    const points = [
      { carga: 60, unidade: 'kg' },
      { carga: 67.5, unidade: 'kg' },
    ];
    assert.equal(classifyTrend(points), 'evoluindo');
  });

  test('em queda quando delta < -LOAD_EPS', () => {
    const points = [
      { carga: 70, unidade: 'kg' },
      { carga: 60, unidade: 'kg' },
    ];
    assert.equal(classifyTrend(points), 'em_queda');
  });

  test('estável quando delta dentro da tolerância', () => {
    const points = [
      { carga: 65, unidade: 'kg' },
      { carga: 65, unidade: 'kg' },
      { carga: 65.02, unidade: 'kg' },
    ];
    assert.equal(classifyTrend(points), 'estavel');
  });

  test('unidades mistas → dados insuficientes', () => {
    const points = [
      { carga: 60, unidade: 'kg' },
      { carga: 132, unidade: 'lb' },
    ];
    assert.equal(classifyTrend(points), 'dados_insuficientes');
  });
});

describe('periodBounds', () => {
  test('30 dias inclui start e end', () => {
    const p = periodBounds('30', '2026-09-01');
    assert.equal(p.end, '2026-09-01');
    assert.equal(p.start, '2026-08-03');
    assert.equal(p.days, 30);
  });

  test('all sem start', () => {
    const p = periodBounds('all', '2026-09-01');
    assert.equal(p.start, null);
    assert.equal(p.days, null);
  });
});

describe('analyzeLoadProgression', () => {
  test('agrupa por slot_key e usa top-set por sessão', () => {
    const result = analyzeLoadProgression({
      periodKey: '30',
      asOf: '2026-09-02',
      sessions: [
        session('2026-08-05', [
          set({ set_index: 1, carga: '60', repeticoes: 10 }),
          set({ set_index: 2, carga: '60', repeticoes: 8 }),
        ]),
        session('2026-08-12', [set({ set_index: 1, carga: '62,5', repeticoes: 8 })]),
        session('2026-08-19', [set({ set_index: 1, carga: '65', repeticoes: 8 })]),
        session('2026-08-26', [set({ set_index: 1, carga: '65', repeticoes: 8 })]),
        session('2026-09-02', [set({ set_index: 1, carga: '67,5', repeticoes: 8 })]),
      ],
    });

    assert.equal(result.empty, false);
    assert.equal(result.exercises.length, 1);
    const ex = result.exercises[0];
    assert.equal(ex.key, exerciseKey({ slot_key: SLOT_A, exercise_name: 'Supino reto' }));
    assert.equal(ex.points.length, 5);
    assert.equal(ex.points[0].carga, 60);
    assert.equal(ex.points[4].carga, 67.5);
    assert.equal(ex.trend, 'evoluindo');
    assert.equal(ex.delta_carga, 7.5);
    assert.equal(ex.series_count, undefined);
    assert.equal(ex.points[0].series_count, 2);
  });

  test('filtra por período', () => {
    const result = analyzeLoadProgression({
      periodKey: '7',
      asOf: '2026-09-02',
      sessions: [
        session('2026-08-01', [set({ carga: '50' })]),
        session('2026-09-01', [set({ carga: '60' })]),
      ],
    });
    assert.equal(result.exercises[0].points.length, 1);
  });

  test('empty quando sem cargas numéricas', () => {
    const result = analyzeLoadProgression({
      sessions: [session('2026-09-01', [set({ carga: 'BW', repeticoes: 10 })])],
    });
    assert.equal(result.empty, true);
  });

  test('filtra exercise_key', () => {
    const slotB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const result = analyzeLoadProgression({
      exerciseKey: `slot:${SLOT_A}`,
      sessions: [
        session('2026-09-01', [
          set({ slot_key: SLOT_A, carga: '60' }),
          set({
            slot_key: slotB,
            exercise_name: 'Agachamento',
            carga: '100',
          }),
        ]),
      ],
    });
    assert.equal(result.exercises.length, 1);
    assert.equal(result.selected_exercise.key, `slot:${SLOT_A}`);
  });

  test('summary para evolução', () => {
    const result = analyzeLoadProgression({
      periodKey: '30',
      asOf: '2026-09-02',
      sessions: [
        session('2026-08-05', [set({ carga: '60' })]),
        session('2026-09-02', [set({ carga: '67,5' })]),
      ],
    });
    assert.ok(result.summary);
    assert.match(result.summary.body, /aumentou a carga/);
  });
});
