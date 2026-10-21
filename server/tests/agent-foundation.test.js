/**
 * Testes Agent Foundation — policy + fast path.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { assertToolAllowed, AUTONOMY } = require('../services/agent/policy');
const { classifyFastPath, cardFromAction } = require('../services/agent/orchestrator');
const { getTool, listToolsForPrompt } = require('../services/agent/tool-registry');

describe('agent policy', () => {
  test('allows read under autonomy 2', () => {
    const tool = { name: 'get_next_action', autonomy: AUTONOMY.READ };
    const r = assertToolAllowed({ tool, autonomyMax: 2, accessBlocked: false });
    assert.equal(r.allowed, true);
  });

  test('denies high impact', () => {
    const tool = getTool('modify_diet');
    const r = assertToolAllowed({ tool, autonomyMax: 2, accessBlocked: false });
    assert.equal(r.allowed, false);
    assert.equal(r.decision, 'refuse_high_impact');
  });

  test('denies write when access blocked', () => {
    const tool = getTool('complete_meal');
    const r = assertToolAllowed({ tool, autonomyMax: 2, accessBlocked: true });
    assert.equal(r.allowed, false);
    assert.equal(r.decision, 'deny_blocked_access');
  });

  test('requires approval for draft_message', () => {
    const tool = getTool('draft_message_to_coach');
    const r = assertToolAllowed({ tool, autonomyMax: 2, accessBlocked: false });
    assert.equal(r.allowed, false);
    assert.equal(r.needsApproval, true);
  });
});

describe('agent fast path', () => {
  test('classifies complete', () => {
    assert.equal(classifyFastPath('Concluí.').mode, 'complete');
  });

  test('classifies restaurant', () => {
    assert.equal(classifyFastPath('Estou num restaurante').mode, 'restaurant');
  });

  test('classifies refuse high impact', () => {
    assert.equal(classifyFastPath('Altera minha dieta para low carb').mode, 'refuse_high_impact');
  });

  test('classifies next action', () => {
    assert.equal(classifyFastPath('O que faço agora?').mode, 'next_action');
  });

  test('classifies ask weight', () => {
    assert.equal(classifyFastPath('Quero registar o peso.').mode, 'ask_weight');
  });

  test('classifies log weight with number', () => {
    const r = classifyFastPath('Registar peso 78.5 kg');
    assert.equal(r.mode, 'log_weight');
    assert.equal(r.peso_kg, 78.5);
  });

  test('classifies open progress', () => {
    assert.equal(classifyFastPath('Quero ver minha evolução.').mode, 'open_progress');
  });

  test('classifies checkin', () => {
    assert.equal(classifyFastPath('Preciso fazer o check-in.').mode, 'open_checkin');
  });

  test('cardFromAction builds meal card', () => {
    const card = cardFromAction({
      type: 'next_meal',
      description: 'almoco',
      payload: { dieta_id: '00000000-0000-4000-8000-000000000001', meal_key: 'almoco', plano: 'A' },
    });
    assert.equal(card.primary_action.name, 'complete_meal');
  });
});

describe('tool registry', () => {
  test('lists tools without high impact by default', () => {
    const tools = listToolsForPrompt();
    assert.ok(tools.some((t) => t.name === 'complete_meal'));
    assert.ok(!tools.some((t) => t.name === 'modify_diet'));
  });

  test('getTool finds open_ui', () => {
    assert.equal(getTool('open_ui').autonomy, AUTONOMY.WRITE_LOW);
  });
});
