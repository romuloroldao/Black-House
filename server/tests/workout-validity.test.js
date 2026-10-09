/**
 * Testes unitários — workout-validity.js
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { parseWorkoutValidityBody } = require('../utils/workout-validity');

// 2026-10-08 22:30 em São Paulo = 2026-10-09 01:30 UTC
const NOW = new Date('2026-10-09T01:30:00Z');

describe('parseWorkoutValidityBody', () => {
  test('aceita data futura e dias de antecedência', () => {
    const r = parseWorkoutValidityBody({ data_expiracao: '2026-11-22', dias_antecedencia_notificacao: '5' }, NOW);
    assert.deepEqual(r, { ok: true, dataExpiracao: '2026-11-22', diasAntecedencia: 5 });
  });

  test('hoje é válido usando o dia civil de São Paulo, não o UTC', () => {
    const r = parseWorkoutValidityBody({ data_expiracao: '2026-10-08' }, NOW);
    assert.equal(r.ok, true);
    assert.equal(r.diasAntecedencia, null);
  });

  test('rejeita data passada', () => {
    const r = parseWorkoutValidityBody({ data_expiracao: '2026-10-07' }, NOW);
    assert.equal(r.ok, false);
    assert.equal(r.error_code, 'DATA_EXPIRACAO_PAST');
  });

  test('rejeita formato inválido e datas inexistentes', () => {
    assert.equal(parseWorkoutValidityBody({ data_expiracao: '22/11/2026' }, NOW).error_code, 'INVALID_DATA_EXPIRACAO');
    assert.equal(parseWorkoutValidityBody({ data_expiracao: '2026-02-30' }, NOW).error_code, 'INVALID_DATA_EXPIRACAO');
  });

  test('exige data', () => {
    assert.equal(parseWorkoutValidityBody({}, NOW).error_code, 'MISSING_DATA_EXPIRACAO');
  });

  test('rejeita antecedência negativa', () => {
    const r = parseWorkoutValidityBody({ data_expiracao: '2026-11-22', dias_antecedencia_notificacao: -1 }, NOW);
    assert.equal(r.error_code, 'INVALID_DIAS_ANTECEDENCIA');
  });
});
