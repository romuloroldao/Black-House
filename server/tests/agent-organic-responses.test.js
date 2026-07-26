/**
 * Testes do compositor + intents orgânicos do Daily Agent.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { classifyFastPath } = require('../services/agent/orchestrator');
const {
  composeRestDay,
  composeNextWorkout,
  composeMeal,
  composeNextAction,
  mealLabel,
} = require('../services/agent/response-composer');
const { getTool } = require('../services/agent/tool-registry');

describe('organic intents', () => {
  test('classifies próximo treino', () => {
    assert.equal(classifyFastPath('qual é o meu proximo treino ?').mode, 'next_workout');
    assert.equal(classifyFastPath('Quando eu treino?').mode, 'next_workout');
  });

  test('classifies treino de hoje still as workout_day', () => {
    assert.equal(classifyFastPath('Qual meu treino de hoje?').mode, 'workout_day');
  });

  test('classifies o que como as next_meal', () => {
    assert.equal(classifyFastPath('O que eu como agora?').mode, 'next_meal');
  });

  test('classifies late and resume separately', () => {
    assert.equal(classifyFastPath('Estou atrasado.').mode, 'late');
    assert.equal(classifyFastPath('Voltei.').mode, 'resume');
  });
});

describe('response composer', () => {
  test('mealLabel maps almoco', () => {
    assert.equal(mealLabel('almoco'), 'almoço');
  });

  test('composeRestDay includes next workout', () => {
    const r = composeRestDay({
      dayPhrase: 'hoje',
      nextWorkout: {
        day_label: 'amanhã',
        dia_semana_nome: 'segunda-feira',
        detalhe: { id: 't1', nome: 'Treino A' },
      },
      proximaAcao: {
        type: 'next_meal',
        description: 'almoco',
        payload: { dieta_id: 'd1', meal_key: 'almoco', plano: 'A' },
      },
    });
    assert.match(r.assistantText, /descanso/i);
    assert.match(r.assistantText, /Treino A/);
    assert.match(r.assistantText, /almo/i);
    assert.ok(r.cards.length >= 1);
  });

  test('composeNextWorkout for tomorrow', () => {
    const r = composeNextWorkout({
      todayRest: true,
      nextWorkout: {
        offset_days: 1,
        day_label: 'amanhã',
        detalhe: { id: 't1', nome: 'Full Body' },
      },
    });
    assert.match(r.assistantText, /descanso/i);
    assert.match(r.assistantText, /Full Body/);
    assert.equal(r.cards[0].title, 'Full Body');
  });

  test('composeMeal idle offers photo', () => {
    const r = composeMeal({ acao: { type: 'idle' } });
    assert.ok(r.cards.some((c) => c.primary_action?.args?.target === 'meal_photo'));
  });

  test('composeNextAction late tone', () => {
    const r = composeNextAction({
      tone: 'late',
      acao: {
        type: 'today_workout',
        title: 'Treino B',
        description: 'Iniciar',
        payload: { treino_id: 'x' },
      },
    });
    assert.match(r.assistantText, /Sem problema/i);
    assert.match(r.assistantText, /Treino B/);
  });
});

describe('new tools registered', () => {
  test('get_next_workout exists', () => {
    assert.ok(getTool('get_next_workout'));
    assert.ok(getTool('get_week_agenda'));
  });
});
