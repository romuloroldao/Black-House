/**
 * Phase 5 — helpers behavioral insight (sem DB)
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  addDaysIso,
  isoWeekday,
  todayIso,
} = require('../services/behavioral-insight.service');
const { getTool, listToolsForPrompt } = require('../services/agent/tool-registry');

describe('behavioral-insight date helpers', () => {
  test('addDaysIso and isoWeekday', () => {
    assert.equal(addDaysIso('2026-07-26', -1), '2026-07-25');
    assert.equal(isoWeekday('2026-07-26'), 7); // Sunday
    assert.equal(isoWeekday('2026-07-27'), 1); // Monday
    assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('get_behavioral_insight tool', () => {
  test('registered as READ', () => {
    const names = listToolsForPrompt().map((t) => t.name);
    assert.ok(names.includes('get_behavioral_insight'));
    assert.equal(getTool('get_behavioral_insight').autonomy, 0);
  });
});
