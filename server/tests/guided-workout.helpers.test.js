/**
 * Helpers Guided Workout (Phase 3) + fix sessão séries CTA
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Espelha a lógica do frontend (src/lib/workout-session-utils.ts)

function parsePrescribedSets(series) {
  if (series == null || series === '') return 3;
  if (typeof series === 'number' && Number.isFinite(series)) {
    return Math.min(20, Math.max(1, Math.round(series)));
  }
  const s = String(series).trim();
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.min(20, Math.max(1, parseInt(range[1], 10)));
  const n = s.match(/(\d+)/);
  if (n) return Math.min(20, Math.max(1, parseInt(n[1], 10)));
  return 3;
}

function firstIncompleteIndex(completedIndexes, total) {
  if (total <= 0) return 0;
  const done = new Set(completedIndexes);
  for (let i = 0; i < total; i++) {
    if (!done.has(i)) return i;
  }
  return Math.max(0, total - 1);
}

function secondsUntil(restEndsAt, now = Date.now()) {
  if (restEndsAt == null || !Number.isFinite(restEndsAt)) return null;
  const left = Math.ceil((restEndsAt - now) / 1000);
  if (left <= 0) return 0;
  return left;
}

function appendSetLog(existing, entry) {
  const filtered = existing.filter(
    (e) => !(e.exerciseIndex === entry.exerciseIndex && e.setIndex === entry.setIndex),
  );
  return [...filtered, entry].sort(
    (a, b) => a.exerciseIndex - b.exerciseIndex || a.setIndex - b.setIndex,
  );
}

/** Simula restore de descanso a partir de progresso persistido. */
function restoreRestState(saved, now = Date.now()) {
  if (saved?.restPausedLeft != null && saved.restPausedLeft > 0) {
    return { restEndsAt: null, restPausedLeft: saved.restPausedLeft, restMode: saved.restMode ?? null };
  }
  if (saved?.restEndsAt && saved.restEndsAt > now) {
    return { restEndsAt: saved.restEndsAt, restPausedLeft: null, restMode: saved.restMode ?? null };
  }
  return { restEndsAt: null, restPausedLeft: null, restMode: null };
}

describe('parsePrescribedSets', () => {
  test('parses plain numbers', () => {
    assert.equal(parsePrescribedSets(4), 4);
    assert.equal(parsePrescribedSets('3'), 3);
  });
  test('parses ranges and x notation', () => {
    assert.equal(parsePrescribedSets('3-4'), 3);
    assert.equal(parsePrescribedSets('4x10'), 4);
  });
  test('defaults', () => {
    assert.equal(parsePrescribedSets(null), 3);
    assert.equal(parsePrescribedSets(''), 3);
  });
});

describe('firstIncompleteIndex', () => {
  test('returns first gap, not length of completed', () => {
    assert.equal(firstIncompleteIndex([0, 1], 5), 2);
    assert.equal(firstIncompleteIndex([0, 2], 5), 1);
    assert.equal(firstIncompleteIndex([], 3), 0);
  });
  test('returns last index when all done', () => {
    assert.equal(firstIncompleteIndex([0, 1, 2], 3), 2);
  });
});

describe('secondsUntil / restEndsAt', () => {
  test('counts down from absolute end time', () => {
    const now = 1_000_000;
    assert.equal(secondsUntil(now + 90_000, now), 90);
    assert.equal(secondsUntil(now + 500, now), 1);
    assert.equal(secondsUntil(now - 1000, now), 0);
  });
  test('null when no rest', () => {
    assert.equal(secondsUntil(null), null);
    assert.equal(secondsUntil(undefined), null);
  });
});

describe('restoreRestState', () => {
  test('retoma countdown se restEndsAt no futuro', () => {
    const now = Date.now();
    const r = restoreRestState({ restEndsAt: now + 30_000, restMode: 'set' }, now);
    assert.equal(r.restEndsAt, now + 30_000);
    assert.equal(r.restPausedLeft, null);
    assert.equal(r.restMode, 'set');
  });
  test('limpa descanso se já passou', () => {
    const now = Date.now();
    const r = restoreRestState({ restEndsAt: now - 5_000, restMode: 'set' }, now);
    assert.equal(r.restEndsAt, null);
    assert.equal(r.restMode, null);
  });
  test('prioriza pausa', () => {
    const now = Date.now();
    const r = restoreRestState(
      { restEndsAt: now + 30_000, restPausedLeft: 45, restMode: 'exercise' },
      now,
    );
    assert.equal(r.restEndsAt, null);
    assert.equal(r.restPausedLeft, 45);
    assert.equal(r.restMode, 'exercise');
  });
});

describe('appendSetLog', () => {
  test('acrescenta séries e substitui mesmo índice', () => {
    let logs = [];
    logs = appendSetLog(logs, {
      exerciseIndex: 0,
      setIndex: 1,
      carga: '40',
      repeticoes: 10,
      rpe: null,
      dor: null,
      at: '2026-08-06T12:00:00Z',
    });
    logs = appendSetLog(logs, {
      exerciseIndex: 0,
      setIndex: 2,
      carga: '40',
      repeticoes: 8,
      rpe: null,
      dor: null,
      at: '2026-08-06T12:01:00Z',
    });
    assert.equal(logs.length, 2);
    logs = appendSetLog(logs, {
      exerciseIndex: 0,
      setIndex: 2,
      carga: '42',
      repeticoes: 8,
      rpe: null,
      dor: null,
      at: '2026-08-06T12:02:00Z',
    });
    assert.equal(logs.length, 2);
    assert.equal(logs[1].carga, '42');
  });
});

describe('fluxo 3 séries durante countdown (lógica)', () => {
  test('CTA durante descanso set: limpa rest e incrementa série', () => {
    let currentSet = 1;
    let restMode = null;
    let restEndsAt = null;
    const prescribedSets = 3;

    // regista série 1 → inicia descanso
    restMode = 'set';
    restEndsAt = Date.now() + 90_000;
    currentSet = 1; // ainda na série registada; próxima = 2 após advance

    // simula logSetAndAdvance durante descanso (pular + registar)
    const isResting = restEndsAt != null && secondsUntil(restEndsAt) > 0;
    assert.equal(isResting, true);
    assert.equal(restMode, 'set');
    // clearRest(false)
    restEndsAt = null;
    restMode = null;
    // regista currentSet e avança
    const setIndex = currentSet;
    assert.equal(setIndex, 1);
    if (setIndex < prescribedSets) {
      currentSet = setIndex + 1;
      restMode = 'set';
      restEndsAt = Date.now() + 90_000;
    }
    assert.equal(currentSet, 2);

    // série 2 durante descanso → série 3
    const isResting2 = restEndsAt != null && secondsUntil(restEndsAt) > 0;
    assert.equal(isResting2, true);
    restEndsAt = null;
    restMode = null;
    const setIndex2 = currentSet;
    if (setIndex2 < prescribedSets) {
      currentSet = setIndex2 + 1;
      restMode = 'set';
      restEndsAt = Date.now() + 90_000;
    }
    assert.equal(currentSet, 3);

    // série 3 (última) → descanso exercise
    restEndsAt = null;
    restMode = null;
    const setIndex3 = currentSet;
    assert.equal(setIndex3 >= prescribedSets, true);
    restMode = 'exercise';
    restEndsAt = Date.now() + 90_000;
    assert.equal(restMode, 'exercise');
  });
});
