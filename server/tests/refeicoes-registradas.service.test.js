/**
 * Teste de serviço: origem USER_ADJUSTED vs AI_ESTIMATE
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveOrigem } = require('../services/refeicoes-registradas.service');

describe('refeicoes-registradas.service origem', () => {
  test('AI_ESTIMATE when totals match', () => {
    const o = resolveOrigem({
      itens: [{ fonte: 'AI', kcal: 100, ptn: 10, cho: 10, lip: 5 }],
      totais: { kcal: 100, ptn: 10, cho: 10, lip: 5 },
      aiTotais: { kcal: 100, ptn: 10, cho: 10, lip: 5 },
      aiItensCount: 1,
    });
    assert.equal(o, 'AI_ESTIMATE');
  });

  test('USER_ADJUSTED when user adds item', () => {
    const o = resolveOrigem({
      itens: [
        { fonte: 'AI', kcal: 100, ptn: 10, cho: 10, lip: 5 },
        { fonte: 'USER', kcal: 50, ptn: 5, cho: 5, lip: 2 },
      ],
      totais: { kcal: 150, ptn: 15, cho: 15, lip: 7 },
      aiTotais: { kcal: 100, ptn: 10, cho: 10, lip: 5 },
      aiItensCount: 1,
    });
    assert.equal(o, 'USER_ADJUSTED');
  });

  test('USER_ADJUSTED when totals differ', () => {
    const o = resolveOrigem({
      itens: [{ fonte: 'AI', kcal: 200, ptn: 10, cho: 10, lip: 5 }],
      totais: { kcal: 200, ptn: 10, cho: 10, lip: 5 },
      aiTotais: { kcal: 100, ptn: 10, cho: 10, lip: 5 },
      aiItensCount: 1,
    });
    assert.equal(o, 'USER_ADJUSTED');
  });
});
