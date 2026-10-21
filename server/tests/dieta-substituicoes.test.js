/**
 * Phase 4 — validação do serviço de substituições (sem DB).
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlano } = require('../services/refeicao-substituicao.service');

describe('refeicao-substituicao.normalizePlano', () => {
  test('defaults and letters', () => {
    assert.equal(normalizePlano(null), 'A');
    assert.equal(normalizePlano('b'), 'B');
    assert.equal(normalizePlano('UNICO'), 'UNICO');
  });
});

describe('agent tools catalogue includes substitution WRITE', () => {
  test('apply_substitution and clear_substitution registered', () => {
    const { listToolsForPrompt, getTool } = require('../services/agent/tool-registry');
    const names = listToolsForPrompt().map((t) => t.name);
    assert.ok(names.includes('list_substitutions'));
    assert.ok(names.includes('apply_substitution'));
    assert.ok(names.includes('clear_substitution'));
    assert.equal(getTool('apply_substitution').autonomy, 2);
  });
});
