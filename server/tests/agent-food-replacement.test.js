/**
 * Nutrition Replacement Intelligence — parse, compose, intents.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { classifyFastPath } = require('../services/agent/orchestrator');
const {
  parseSubstitutionRequest,
  matchItemsInMeal,
  scoreFoodMatch,
} = require('../services/agent/food-replacement');
const { composeFoodReplacement } = require('../services/agent/response-composer');
const { getTool } = require('../services/agent/tool-registry');

describe('food replacement intents', () => {
  test('classifies classic substitution triggers', () => {
    assert.equal(classifyFastPath('Quero substituir um alimento').mode, 'substitution');
    assert.equal(classifyFastPath('tem equivalência?').mode, 'substitution');
  });

  test('classifies falta de ingrediente e trocar X por Y', () => {
    assert.equal(classifyFastPath('Não tenho arroz').mode, 'substitution');
    assert.equal(classifyFastPath('Trocar arroz por macarrão').mode, 'substitution');
    assert.equal(classifyFastPath('quero frango em vez de carne').mode, 'substitution');
  });

  test('does not steal workout/progress/weight domains', () => {
    assert.equal(classifyFastPath('Qual meu treino de hoje?').mode, 'workout_day');
    assert.equal(classifyFastPath('Como estou de progresso?').mode, 'behavioral');
    assert.equal(classifyFastPath('Peso 72 kg').mode, 'log_weight');
  });
});

describe('parseSubstitutionRequest', () => {
  test('parses trocar X por Y', () => {
    const p = parseSubstitutionRequest('Trocar arroz por macarrão');
    assert.deepEqual(p.origins, ['arroz']);
    assert.equal(p.destination, 'macarrao');
  });

  test('parses não tenho', () => {
    const p = parseSubstitutionRequest('Não tenho feijão');
    assert.ok(p.origins.includes('feijao'));
    assert.equal(p.destination, null);
  });

  test('parses multi-item', () => {
    const p = parseSubstitutionRequest('Trocar arroz e feijão por batata');
    assert.ok(p.multi);
    assert.ok(p.origins.length >= 2);
  });
});

describe('matchItemsInMeal', () => {
  const items = [
    { id: '1', nome: 'Arroz branco', nome_original: 'Arroz branco', alimento_id: 'a1' },
    { id: '2', nome: 'Feijão carioca', nome_original: 'Feijão carioca', alimento_id: 'a2' },
  ];

  test('matches fuzzy by name', () => {
    const m = matchItemsInMeal(['arroz'], items);
    assert.equal(m.length, 1);
    assert.equal(m[0].id, '1');
  });

  test('returns empty when ambiguous missing food', () => {
    assert.equal(matchItemsInMeal(['abacate'], items).length, 0);
  });

  test('scoreFoodMatch exact > partial', () => {
    assert.ok(scoreFoodMatch('arroz', 'Arroz branco') > scoreFoodMatch('feijao', 'Arroz branco'));
  });
});

describe('composeFoodReplacement', () => {
  const acao = {
    type: 'next_meal',
    description: 'almoco',
    payload: {
      dieta_id: '11111111-1111-1111-1111-111111111111',
      meal_key: 'almoco',
      plano: 'A',
    },
  };

  test('asks when clarification needed', () => {
    const r = composeFoodReplacement({
      acao,
      ask: 'Qual alimento do plano queres trocar?',
    });
    assert.match(r.assistantText, /Qual alimento/);
    assert.ok(r.cards.some((c) => c.primary_action?.args?.target === 'dieta'));
  });

  test('generic prompt when no blocks', () => {
    const r = composeFoodReplacement({ acao, blocks: [] });
    assert.match(r.assistantText, /trocar/i);
  });

  test('composes quantities and clickable list card', () => {
    const r = composeFoodReplacement({
      acao,
      blocks: [
        {
          item: {
            id: '22222222-2222-2222-2222-222222222222',
            nome_original: 'Arroz',
            quantidade: 100,
            unidade: 'g',
          },
          options: [
            {
              alimento_id: '33333333-3333-3333-3333-333333333333',
              nome: 'Macarrão',
              quantidade_equivalente: 85,
              unidade: 'g',
              kcal_equivalente: 130,
            },
            {
              alimento_id: '44444444-4444-4444-4444-444444444444',
              nome: 'Batata',
              quantidade_equivalente: 150,
              unidade: 'g',
              kcal_equivalente: 130,
            },
          ],
          destinationMatch: {
            alimento_id: '33333333-3333-3333-3333-333333333333',
            nome: 'Macarrão',
            quantidade_equivalente: 85,
            unidade: 'g',
            kcal_equivalente: 130,
          },
        },
      ],
    });
    assert.match(r.assistantText, /Arroz/i);
    assert.match(r.assistantText, /Macarr/i);
    assert.match(r.assistantText, /85/);
    const listCard = r.cards.find((c) => Array.isArray(c.items) && c.items.some((i) => i.action?.name === 'apply_substitution'));
    assert.ok(listCard);
    assert.equal(listCard.items[0].name, 'Macarrão');
    assert.equal(listCard.items[0].quantity, '85g');
    assert.equal(listCard.items[0].action.args.quantidade_substituto, 85);
    assert.ok(listCard.items.some((i) => i.name === 'Batata'));
  });
});

describe('search_food tool registered', () => {
  test('tool exists as READ', () => {
    const t = getTool('search_food');
    assert.ok(t);
    assert.equal(t.name, 'search_food');
  });

  test('list_substitutions and apply_substitution still registered', () => {
    assert.ok(getTool('list_substitutions'));
    assert.ok(getTool('apply_substitution'));
  });
});
