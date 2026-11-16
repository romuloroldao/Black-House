const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  fingerprintItems,
  eligibleForVariation,
  buildTemplateVariations,
  validateVariation,
  mealKeyFromRefeicao,
} = require('../services/refeicao-variacao/core');

const frango = {
  alimento_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  nome: 'Peito de frango',
  quantidade: 150,
  unidade_quantidade: 'g',
  refeicao: 'Almoço',
};
const arroz = {
  alimento_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  nome: 'Arroz',
  quantidade: 100,
  unidade_quantidade: 'g',
  refeicao: 'Almoço',
};

describe('variações de refeição', () => {
  test('impressão ignora a ordem e o nome da refeição', () => {
    const a = fingerprintItems([frango, arroz]);
    const b = fingerprintItems([
      { ...arroz, refeicao: 'Jantar' },
      { ...frango, quantidade: 150 },
    ]);
    assert.equal(a, b);
  });

  test('quantidade diferente muda a impressão', () => {
    assert.notEqual(
      fingerprintItems([frango, arroz]),
      fingerprintItems([{ ...frango, quantidade: 160 }, arroz]),
    );
  });

  test('substituto da ficha não entra na impressão', () => {
    const comSub = fingerprintItems([
      frango,
      arroz,
      { ...arroz, alimento_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', refeicao: 'Almoço (Substituto)' },
    ]);
    assert.equal(comSub, fingerprintItems([frango, arroz]));
  });

  test('uma opção com porção diferente é recusada', () => {
    const [ok] = buildTemplateVariations([frango, arroz]);
    assert.equal(validateVariation([frango, arroz], ok).ok, true);
    const adulterada = {
      ...ok,
      itens: ok.itens.map((item) => (
        item.alimento_id === frango.alimento_id ? { ...item, quantidade: 200 } : item
      )),
    };
    assert.equal(validateVariation([frango, arroz], adulterada).ok, false);
  });

  test('ingrediente extra no texto é recusado', () => {
    const [ok] = buildTemplateVariations([frango, arroz]);
    const extra = { ...ok, preparo: `${ok.preparo} Finalize com azeite.` };
    assert.equal(validateVariation([frango, arroz], extra).reason, 'INGREDIENTE_EXTRA');
  });

  test('refeição com um alimento não gera variação', () => {
    assert.equal(eligibleForVariation([frango]), false);
    assert.equal(eligibleForVariation([frango, arroz]), true);
  });

  test('chave da refeição tira o plano do rótulo', () => {
    assert.equal(mealKeyFromRefeicao('Almoço (Plano A)'), 'almoco');
  });
});
