const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { calcTmbKcal, calcAgeFromBirthDate } = require('../services/body-metrics.service');

describe('body-metrics.service', () => {
  test('calcTmbKcal masculino', () => {
    const tmb = calcTmbKcal({
      sexo: 'M',
      pesoKg: 82,
      alturaCm: 178,
      idadeAnos: 32,
    });
    assert.equal(tmb, 1869);
  });

  test('calcTmbKcal feminino', () => {
    const tmb = calcTmbKcal({
      sexo: 'F',
      pesoKg: 65,
      alturaCm: 165,
      idadeAnos: 28,
    });
    // Harris-Benedict: 655.1 + 9.563*65 + 1.85*165 - 4.676*28 ≈ 1451
    assert.equal(tmb, 1451);
  });

  test('calcAgeFromBirthDate', () => {
    const age = calcAgeFromBirthDate('1990-06-15');
    assert.ok(age >= 35);
    assert.ok(age <= 36);
  });
});
