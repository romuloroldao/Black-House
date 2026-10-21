/**
 * Temporal parsing for Daily Agent
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRelativeDay, classifyFastPath } = (() => {
  const temporal = require('../services/agent/temporal');
  const { classifyFastPath } = require('../services/agent/orchestrator');
  return { ...temporal, classifyFastPath };
})();

describe('parseRelativeDay', () => {
  const monday = new Date(2026, 6, 27, 12, 0, 0); // Mon 27 Jul 2026

  test('amanhã from Monday → Tuesday', () => {
    const d = parseRelativeDay('qual é meu treino de amanha?', monday);
    assert.equal(d.offsetDays, 1);
    assert.equal(d.explicit, true);
    assert.equal(d.label, 'amanhã');
    assert.equal(d.diaSemana, 2);
  });

  test('hoje is explicit', () => {
    const d = parseRelativeDay('treino de hoje', monday);
    assert.equal(d.offsetDays, 0);
    assert.equal(d.explicit, true);
  });

  test('quarta-feira resolves forward', () => {
    const d = parseRelativeDay('treino de quarta', monday);
    assert.equal(d.diaSemana, 3);
    assert.equal(d.offsetDays, 2);
    assert.equal(d.explicit, true);
  });

  test('implicit today when no marker', () => {
    const d = parseRelativeDay('qual meu treino', monday);
    assert.equal(d.offsetDays, 0);
    assert.equal(d.explicit, false);
  });
});

describe('classifyFastPath temporal workout', () => {
  test('amanhã maps to workout_day with day offset 1', () => {
    const c = classifyFastPath('qual é meu treino de amanha ?');
    assert.equal(c.mode, 'workout_day');
    assert.equal(c.day.offsetDays, 1);
    assert.equal(c.day.explicit, true);
  });
});
