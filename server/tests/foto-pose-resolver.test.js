/**
 * Testes — foto-pose-resolver (funções puras exportadas)
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const resolver = require('../services/foto-pose-resolver');
const crypto = require('crypto');

describe('hashBuffer', () => {
  test('produz SHA-256 hex', () => {
    const buf = Buffer.from('test');
    const expected = crypto.createHash('sha256').update(buf).digest('hex');
    assert.equal(resolver.hashBuffer(buf), expected);
  });
});

describe('buildFotoListSql', () => {
  test('inclui colunas pose quando solicitado', () => {
    const sql = resolver.buildFotoListSql(true);
    assert.match(sql, /pose_efetiva/);
    assert.match(sql, /pose_analysis_status/);
  });

  test('omite colunas pose quando false', () => {
    const sql = resolver.buildFotoListSql(false);
    assert.doesNotMatch(sql, /pose_efetiva/);
  });
});
