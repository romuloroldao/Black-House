const { calcTmbKcal, calcAgeFromBirthDate } = require('../services/body-metrics.service');

describe('body-metrics.service', () => {
  test('calcTmbKcal masculino', () => {
    const tmb = calcTmbKcal({
      sexo: 'M',
      pesoKg: 82,
      alturaCm: 178,
      idadeAnos: 32,
    });
    expect(tmb).toBe(1869);
  });

  test('calcTmbKcal feminino', () => {
    const tmb = calcTmbKcal({
      sexo: 'F',
      pesoKg: 65,
      alturaCm: 165,
      idadeAnos: 28,
    });
    expect(tmb).toBe(1443);
  });

  test('calcAgeFromBirthDate', () => {
    const age = calcAgeFromBirthDate('1990-06-15');
    expect(age).toBeGreaterThanOrEqual(35);
    expect(age).toBeLessThanOrEqual(36);
  });
});
