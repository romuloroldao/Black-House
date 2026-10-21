/**
 * Testes unitários — execução diária Phase 1a (sem DB).
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizePlano, todayIso } = require('../services/refeicao-conclusao.service');
const { mealOrder, sortMealKeys, normalizeKey } = require('../services/proxima-acao.service');

describe('refeicao-conclusao.service helpers', () => {
  test('normalizePlano accepts A-Z and UNICO', () => {
    assert.equal(normalizePlano('a'), 'A');
    assert.equal(normalizePlano('B'), 'B');
    assert.equal(normalizePlano('unico'), 'UNICO');
    assert.equal(normalizePlano(null), 'A');
    assert.equal(normalizePlano('xy'), 'A');
  });

  test('todayIso returns YYYY-MM-DD', () => {
    assert.match(todayIso(new Date('2026-07-26T15:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('proxima-acao meal ordering', () => {
  test('normalizeKey strips accents', () => {
    assert.equal(normalizeKey('Café da Manhã'), 'cafe da manha');
  });

  test('mealOrder ranks breakfast before dinner', () => {
    assert.ok(mealOrder('cafe da manha') < mealOrder('jantar'));
    assert.ok(mealOrder('almoco') < mealOrder('ceia'));
  });

  test('sortMealKeys orders canonically', () => {
    const sorted = sortMealKeys(['jantar', 'cafe', 'almoco']);
    assert.deepEqual(sorted, ['cafe', 'almoco', 'jantar']);
  });
});

describe('proxima-acao exports prefer support', () => {
  test('getProximaAcao is exported', () => {
    const { getProximaAcao } = require('../services/proxima-acao.service');
    assert.equal(typeof getProximaAcao, 'function');
  });
});
