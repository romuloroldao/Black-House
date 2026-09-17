/**
 * Evolução do treino — regras determinísticas (sem DB).
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseCarga,
  normalizeExerciseName,
  exerciseKey,
  pickTopSet,
  sessionVolume,
  classifyPair,
  confidenceFrom,
  weekBounds,
  startOfWeekMonday,
  analyzeWeeklyEvolution,
} = require('../services/treino-evolucao.engine');

const SLOT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SLOT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function set(partial) {
  return {
    exercise_name: 'Supino reto',
    exercise_index: 0,
    set_index: 1,
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

describe('parseCarga', () => {
  test('plain number defaults to kg', () => {
    assert.deepEqual(parseCarga('60'), { valor: 60, unidade: 'kg' });
    assert.deepEqual(parseCarga('62,5'), { valor: 62.5, unidade: 'kg' });
  });
  test('detects kg and lb', () => {
    assert.deepEqual(parseCarga('62,5 kg'), { valor: 62.5, unidade: 'kg' });
    assert.deepEqual(parseCarga('132 lb'), { valor: 132, unidade: 'lb' });
    assert.deepEqual(parseCarga('132lbs'), { valor: 132, unidade: 'lb' });
  });
  test('rejects bodyweight and empty', () => {
    assert.equal(parseCarga('BW'), null);
    assert.equal(parseCarga('peso corporal'), null);
    assert.equal(parseCarga('elástico'), null);
    assert.equal(parseCarga(''), null);
    assert.equal(parseCarga(null), null);
  });
});

describe('exercise identity', () => {
  test('slot_key wins over name', () => {
    assert.equal(
      exerciseKey({ slot_key: SLOT_A, exercise_name: 'Supino reto' }),
      `slot:${SLOT_A}`,
    );
  });
  test('normalized name ignores accents and case', () => {
    assert.equal(normalizeExerciseName('Supino Reto'), normalizeExerciseName('supino reto'));
    assert.equal(
      exerciseKey({ exercise_name: 'Rosca Direta' }),
      exerciseKey({ exercise_name: 'rosca  direta' }),
    );
  });
  test('substitution with new slot is a different exercise', () => {
    assert.notEqual(
      exerciseKey({ slot_key: SLOT_A, exercise_name: 'Supino' }),
      exerciseKey({ slot_key: SLOT_B, exercise_name: 'Supino' }),
    );
  });
});

describe('top-set and volume', () => {
  test('uses heaviest set, not last write', () => {
    const top = pickTopSet([
      set({ set_index: 1, carga: '80', repeticoes: 8 }),
      set({ set_index: 2, carga: '80', repeticoes: 8 }),
      set({ set_index: 3, carga: '70', repeticoes: 12 }),
    ]);
    assert.equal(top.carga, 80);
    assert.equal(top.reps, 8);
  });
  test('volume sums all numeric sets', () => {
    const vol = sessionVolume([
      set({ carga: '80', repeticoes: 8 }),
      set({ carga: '80', repeticoes: 8 }),
      set({ carga: '70', repeticoes: 10 }),
    ]);
    assert.equal(vol.volume, 80 * 8 + 80 * 8 + 70 * 10);
  });
  test('mixed units skip volume', () => {
    const vol = sessionVolume([
      set({ carga: '60 kg', repeticoes: 10 }),
      set({ carga: '132 lb', repeticoes: 10 }),
    ]);
    assert.equal(vol.mixed, true);
    assert.equal(vol.volume, null);
  });
});

describe('classifyPair', () => {
  test('load increase', () => {
    const status = classifyPair(
      { top: { numeric: true, carga: 62.5, unidade: 'kg', reps: 10 } },
      { top: { numeric: true, carga: 60, unidade: 'kg', reps: 10 } },
    );
    assert.equal(status, 'subiu_carga');
  });
  test('reps increase at same load', () => {
    const status = classifyPair(
      { top: { numeric: true, carga: 60, unidade: 'kg', reps: 10 } },
      { top: { numeric: true, carga: 60, unidade: 'kg', reps: 8 } },
    );
    assert.equal(status, 'subiu_reps');
  });
  test('stable is not negative', () => {
    const status = classifyPair(
      { top: { numeric: true, carga: 60, unidade: 'kg', reps: 10 } },
      { top: { numeric: true, carga: 60, unidade: 'kg', reps: 10 } },
    );
    assert.equal(status, 'estavel');
  });
  test('new exercise is not a drop', () => {
    const status = classifyPair(
      { top: { numeric: true, carga: 40, unidade: 'kg', reps: 10 } },
      null,
    );
    assert.equal(status, 'novo');
  });
  test('unit change is mixed, not a drop', () => {
    const status = classifyPair(
      { top: { numeric: true, carga: 132, unidade: 'lb', reps: 10 } },
      { top: { numeric: true, carga: 60, unidade: 'kg', reps: 10 } },
    );
    assert.equal(status, 'unidade_mista');
  });
  test('load below last mark', () => {
    const status = classifyPair(
      { top: { numeric: true, carga: 55, unidade: 'kg', reps: 10 } },
      { top: { numeric: true, carga: 60, unidade: 'kg', reps: 10 } },
    );
    assert.equal(status, 'abaixo_ultimo');
  });
});

describe('confidence', () => {
  test('none when no sessions this week', () => {
    assert.equal(confidenceFrom({ sessionsLoggedCurrent: 0, comparableCount: 0, sessionsInLookback: 0, numericShare: 0 }), 'none');
  });
  test('low with a single session', () => {
    assert.equal(confidenceFrom({ sessionsLoggedCurrent: 1, comparableCount: 5, sessionsInLookback: 1, numericShare: 1 }), 'low');
  });
  test('medium with 2 sessions and 3 comparable', () => {
    assert.equal(confidenceFrom({ sessionsLoggedCurrent: 2, comparableCount: 3, sessionsInLookback: 2, numericShare: 0.8 }), 'medium');
  });
  test('high with 4 lookback sessions', () => {
    assert.equal(confidenceFrom({ sessionsLoggedCurrent: 3, comparableCount: 4, sessionsInLookback: 4, numericShare: 0.8 }), 'high');
  });
});

describe('week bounds', () => {
  test('wednesday belongs to monday-sunday week', () => {
    assert.equal(startOfWeekMonday('2026-08-19'), '2026-08-17');
    assert.deepEqual(weekBounds('2026-08-19'), { start: '2026-08-17', end: '2026-08-23' });
  });
});

describe('analyzeWeeklyEvolution — edge cases', () => {
  test('empty log book', () => {
    const out = analyzeWeeklyEvolution({ sessions: [], asOf: '2026-08-19', audience: 'aluno' });
    assert.equal(out.empty, true);
    assert.equal(out.confidence, 'none');
    assert.equal(out.is_fallback, undefined);
    assert.match(out.headline.body, /registrando/i);
    assert.doesNotMatch(out.headline.title, /não evoluiu/i);
  });

  test('current week without logs falls back to last week with sessions', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      audience: 'aluno',
      sessions: [
        session('2026-08-11', [
          set({ carga: '60', repeticoes: 10 }),
          set({ exercise_name: 'Agachamento', carga: '100', repeticoes: 8 }),
        ]),
        session('2026-08-13', [
          set({ carga: '62,5', repeticoes: 10 }),
          set({ exercise_name: 'Agachamento', carga: '105', repeticoes: 8 }),
        ]),
      ],
    });
    assert.equal(out.empty, false);
    assert.equal(out.is_fallback, true);
    assert.equal(out.week.start, '2026-08-10');
    assert.equal(out.requested_week.start, '2026-08-17');
    assert.match(out.fallback_label, /não há treinos/i);
    assert.doesNotMatch(`${out.headline.title} ${out.headline.body}`.toLowerCase(), /não evoluiu|piorou/);
  });

  test('allowFallback false keeps current week empty', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      allowFallback: false,
      sessions: [session('2026-08-11', [set({ carga: '60', repeticoes: 10 })])],
    });
    assert.equal(out.empty, true);
    assert.equal(out.confidence, 'none');
  });

  test('recent starter — current week only, no history', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      sessions: [
        session('2026-08-18', [set({ carga: '40', repeticoes: 10 })]),
      ],
    });
    assert.equal(out.confidence, 'low');
    assert.equal(out.exercises[0].status, 'novo');
    assert.equal(out.headline.tone, 'insufficient');
  });

  test('load increase week vs week', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      sessions: [
        session('2026-08-11', [set({ carga: '60', repeticoes: 10 })]),
        session('2026-08-18', [set({ carga: '62,5', repeticoes: 10 })]),
        session('2026-08-20', [set({ exercise_name: 'Agachamento', carga: '80', repeticoes: 8 })]),
        session('2026-08-13', [set({ exercise_name: 'Agachamento', carga: '80', repeticoes: 8 })]),
        session('2026-08-12', [set({ exercise_name: 'Rosca direta', carga: '20', repeticoes: 10 })]),
        session('2026-08-19', [set({ exercise_name: 'Rosca direta', carga: '20', repeticoes: 12 })]),
      ],
    });
    const supino = out.exercises.find((e) => /supino/i.test(e.name));
    assert.equal(supino.status, 'subiu_carga');
    assert.equal(supino.delta_carga, 2.5);
    assert.equal(out.headline.tone, 'positive');
    assert.match(out.chart_comment.body, /supino/i);
  });

  test('stable load is not classified as stagnation headline', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      sessions: [
        session('2026-08-11', [
          set({ carga: '60', repeticoes: 10 }),
          set({ exercise_name: 'Agachamento', carga: '100', repeticoes: 8 }),
          set({ exercise_name: 'Rosca', carga: '20', repeticoes: 12 }),
        ]),
        session('2026-08-13', [
          set({ carga: '60', repeticoes: 10 }),
          set({ exercise_name: 'Agachamento', carga: '100', repeticoes: 8 }),
          set({ exercise_name: 'Rosca', carga: '20', repeticoes: 12 }),
        ]),
        session('2026-08-18', [
          set({ carga: '60', repeticoes: 10 }),
          set({ exercise_name: 'Agachamento', carga: '100', repeticoes: 8 }),
          set({ exercise_name: 'Rosca', carga: '20', repeticoes: 12 }),
        ]),
        session('2026-08-20', [
          set({ carga: '60', repeticoes: 10 }),
          set({ exercise_name: 'Agachamento', carga: '100', repeticoes: 8 }),
          set({ exercise_name: 'Rosca', carga: '20', repeticoes: 12 }),
        ]),
      ],
    });
    assert.ok(out.exercises.every((e) => e.status === 'estavel'));
    assert.equal(out.headline.tone, 'stable');
    assert.doesNotMatch(out.headline.title.toLowerCase(), /piorou|estagn/);
  });

  test('repeated sessions in the same week are not overwritten', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      sessions: [
        session('2026-08-11', [set({ carga: '60', repeticoes: 10 })]),
        session('2026-08-17', [set({ carga: '60', repeticoes: 10 })]),
        session('2026-08-20', [set({ carga: '65', repeticoes: 8 })]),
      ],
    });
    const supino = out.exercises.find((e) => /supino/i.test(e.name));
    assert.equal(supino.sessions_this_week, 2);
    assert.equal(supino.current.carga, 65);
  });

  test('partial fill analyses only exercises with data', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      sessions: [
        session('2026-08-11', [
          set({ carga: '60', repeticoes: 10 }),
          set({ exercise_name: 'Leg press', carga: '150', repeticoes: 10 }),
        ]),
        session('2026-08-18', [
          set({ carga: '62.5', repeticoes: 10 }),
        ]),
      ],
    });
    assert.ok(out.exercises.some((e) => /supino/i.test(e.name)));
    assert.equal(out.exercises.some((e) => /leg press/i.test(e.name)), false);
  });

  test('substituted exercise (new slot) is novo, not a drop', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      sessions: [
        session('2026-08-11', [set({ slot_key: SLOT_A, exercise_name: 'Supino máquina', carga: '80', repeticoes: 10 })]),
        session('2026-08-18', [set({ slot_key: SLOT_B, exercise_name: 'Supino reto', carga: '60', repeticoes: 10 })]),
        session('2026-08-20', [set({ exercise_name: 'Agachamento', carga: '100', repeticoes: 8 })]),
      ],
    });
    const reto = out.exercises.find((e) => /reto/i.test(e.name));
    assert.equal(reto.status, 'novo');
    assert.equal(out.exercises.some((e) => e.status === 'abaixo_ultimo'), false);
  });

  test('in_progress with series still counts as logged, not missed workout', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      agendaWeekdays: [1, 3, 5],
      sessions: [
        session('2026-08-17', [set({ carga: '60', repeticoes: 10 })], { status: 'in_progress' }),
      ],
    });
    assert.equal(out.consistency.sessions_logged, 1);
    assert.equal(out.consistency.sessions_completed, 0);
    assert.equal(out.consistency.sessions_planned, 3);
    assert.doesNotMatch(JSON.stringify(out.headline).toLowerCase(), /não treinou/);
  });

  test('coach audience keeps full exercise list', () => {
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      audience: 'coach',
      sessions: [
        session('2026-08-11', [set({ carga: '60', repeticoes: 10 })]),
        session('2026-08-18', [set({ carga: '65', repeticoes: 10 })]),
      ],
    });
    assert.equal(out.audience, 'coach');
    assert.ok(out.exercises.length >= 1);
  });

  test('never says the student failed to evolve when data is missing', () => {
    const out = analyzeWeeklyEvolution({ sessions: [], asOf: '2026-08-19' });
    const blob = `${out.headline.title} ${out.headline.body} ${out.insights.map((i) => i.text).join(' ')}`;
    assert.doesNotMatch(blob.toLowerCase(), /não evoluiu|você piorou/);
  });

  test('rotation week does not lead with a load-drop headline', () => {
    const history = [
      set({ carga: '60', repeticoes: 10 }),
      set({ exercise_name: 'Agachamento', carga: '100', repeticoes: 8 }),
      set({ exercise_name: 'Terra', carga: '140', repeticoes: 5 }),
    ];
    const currentCore = [
      set({ carga: '55', repeticoes: 10 }),
      set({ exercise_name: 'Agachamento', carga: '90', repeticoes: 8 }),
      set({ exercise_name: 'Terra', carga: '130', repeticoes: 5 }),
    ];
    const novos = Array.from({ length: 8 }, (_, i) =>
      set({ exercise_name: `Variacao ${i + 1}`, carga: '30', repeticoes: 12 }),
    );
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      audience: 'aluno',
      sessions: [
        session('2026-07-28', history),
        session('2026-08-04', history),
        session('2026-08-11', history),
        session('2026-08-18', [...currentCore, ...novos]),
        session('2026-08-20', currentCore),
      ],
    });
    assert.ok(out.counts.novo >= 8);
    assert.ok(out.counts.abaixo_ultimo >= 3);
    assert.ok(out.confidence === 'medium' || out.confidence === 'high');
    assert.doesNotMatch(out.headline.title.toLowerCase(), /abaixo/);
    assert.match(out.headline.title, /histórico comparável/i);
    assert.equal(out.headline.tone, 'stable');
    assert.equal(out.insights[0].kind, 'dados_insuficientes');
    assert.equal(out.insights.some((i) => i.kind === 'estabilidade'), false);
    assert.ok(out.exercises.filter((e) => e.status === 'novo').length <= 3);
  });

  test('drop among mostly comparable exercises still uses attention headline', () => {
    const prev = [
      set({ carga: '60', repeticoes: 10 }),
      set({ exercise_name: 'Agachamento', carga: '100', repeticoes: 8 }),
      set({ exercise_name: 'Terra', carga: '140', repeticoes: 5 }),
    ];
    const now = [
      set({ carga: '50', repeticoes: 10 }),
      set({ exercise_name: 'Agachamento', carga: '90', repeticoes: 8 }),
      set({ exercise_name: 'Terra', carga: '130', repeticoes: 5 }),
    ];
    const out = analyzeWeeklyEvolution({
      asOf: '2026-08-19',
      sessions: [
        session('2026-07-28', prev),
        session('2026-08-04', prev),
        session('2026-08-11', prev),
        session('2026-08-18', now),
        session('2026-08-20', now),
      ],
    });
    assert.equal(out.headline.tone, 'attention');
    assert.match(out.headline.title.toLowerCase(), /abaixo/);
  });
});
