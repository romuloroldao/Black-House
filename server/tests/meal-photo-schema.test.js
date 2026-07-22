const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseMealPhotoAnalysis,
  sumItemMacros,
} = require('../schemas/meal-photo-schema');

describe('meal-photo-schema', () => {
  test('parse OK response with items', () => {
    const r = parseMealPhotoAnalysis({
      status: 'OK',
      nome_sugerido: 'Arroz e frango',
      confidence: 0.8,
      itens: [
        {
          nome: 'Arroz',
          quantidade: 150,
          unidade: 'g',
          kcal: 195,
          ptn: 4,
          cho: 42,
          lip: 0.5,
        },
      ],
      totais: { kcal: 195, ptn: 4, cho: 42, lip: 0.5 },
      uncertainties: ['Óleo não determinado'],
    });
    assert.equal(r.status, 'OK');
    assert.equal(r.itens.length, 1);
    assert.equal(r.totais.kcal, 195);
    assert.equal(r.uncertainties[0], 'Óleo não determinado');
  });

  test('rejects invalid status', () => {
    assert.throws(() =>
      parseMealPhotoAnalysis({
        status: 'HACKED',
        items: [],
      }),
    );
  });

  test('sums totals from items when missing', () => {
    const r = parseMealPhotoAnalysis({
      status: 'OK',
      items: [
        { nome: 'A', quantidade: 50, kcal: 100, ptn: 10, cho: 5, lip: 2 },
        { nome: 'B', quantidade: 50, kcal: 50, ptn: 5, cho: 5, lip: 1 },
      ],
    });
    assert.equal(r.totais.kcal, 150);
    assert.equal(r.totais.ptn, 15);
  });

  test('sumItemMacros', () => {
    const t = sumItemMacros([
      { kcal: 10, ptn: 1, cho: 2, lip: 3 },
      { kcal: 5, ptn: 1, cho: 1, lip: 1 },
    ]);
    assert.deepEqual(t, { kcal: 15, ptn: 2, cho: 3, lip: 4 });
  });

  test('malformed non-object throws', () => {
    assert.throws(() => parseMealPhotoAnalysis(null));
  });
});
