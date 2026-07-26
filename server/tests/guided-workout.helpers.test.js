/**
 * Helpers Guided Workout (Phase 3)
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Espelha a lógica de parsePrescribedSets do frontend (sem TS)
function parsePrescribedSets(series) {
  if (series == null || series === '') return 3;
  if (typeof series === 'number' && Number.isFinite(series)) {
    return Math.min(20, Math.max(1, Math.round(series)));
  }
  const s = String(series).trim();
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.min(20, Math.max(1, parseInt(range[1], 10)));
  const n = s.match(/(\d+)/);
  if (n) return Math.min(20, Math.max(1, parseInt(n[1], 10)));
  return 3;
}

describe('parsePrescribedSets', () => {
  test('parses plain numbers', () => {
    assert.equal(parsePrescribedSets(4), 4);
    assert.equal(parsePrescribedSets('3'), 3);
  });
  test('parses ranges and x notation', () => {
    assert.equal(parsePrescribedSets('3-4'), 3);
    assert.equal(parsePrescribedSets('4x10'), 4);
  });
  test('defaults', () => {
    assert.equal(parsePrescribedSets(null), 3);
    assert.equal(parsePrescribedSets(''), 3);
  });
});
