/**
 * Phase 6 — coach rules helpers
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRuleInput,
  formatRulesHint,
  toAgentPayload,
} = require('../services/coach-rules.service');
const { getTool, listToolsForPrompt } = require('../services/agent/tool-registry');

describe('coach-rules.normalizeRuleInput', () => {
  test('accepts valid rule', () => {
    const r = normalizeRuleInput({
      domain: 'nutrition',
      trigger: 'restaurant',
      title: 'Foto no restaurante',
      body: 'Prefere pratos grelhados e regista a foto.',
      priority: 10,
    });
    assert.equal(r.domain, 'nutrition');
    assert.equal(r.trigger, 'restaurant');
  });

  test('rejects long body', () => {
    assert.throws(() =>
      normalizeRuleInput({
        title: 'x',
        body: 'a'.repeat(501),
      }),
    );
  });
});

describe('coach-rules formatting', () => {
  test('formatRulesHint and payload', () => {
    const rows = [
      { id: '1', domain: 'general', trigger: 'always', priority: 1, title: 'Tom', body: 'Sé directo.' },
    ];
    assert.match(formatRulesHint(rows), /Tom/);
    assert.equal(toAgentPayload(rows)[0].title, 'Tom');
  });
});

describe('list_coach_rules tool', () => {
  test('registered as READ', () => {
    assert.ok(listToolsForPrompt().some((t) => t.name === 'list_coach_rules'));
    assert.equal(getTool('list_coach_rules').autonomy, 0);
  });
});
