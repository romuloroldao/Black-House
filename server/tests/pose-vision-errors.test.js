/**
 * Testes — classificação de erros da API de visão.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyVisionError,
  isRetryableVisionError,
  shouldBurnAttempt,
} = require('../utils/pose-vision-errors');

describe('classifyVisionError', () => {
  test('429 é transitório', () => {
    const err = new Error('[429 Too Many Requests] quota');
    assert.equal(classifyVisionError(err), 'transient');
    assert.equal(isRetryableVisionError(err), true);
    assert.equal(shouldBurnAttempt(err), false);
  });

  test('503 é transitório', () => {
    const err = new Error('[503 Service Unavailable] overloaded');
    assert.equal(classifyVisionError(err), 'transient');
  });

  test('404 model not found é config permanente', () => {
    const err = new Error('[404 Not Found] models/gemini-2.5-flash is no longer available');
    assert.equal(classifyVisionError(err), 'permanent_config');
    assert.equal(shouldBurnAttempt(err), true);
  });

  test('401 é auth permanente', () => {
    const err = new Error('[401] invalid api key');
    assert.equal(classifyVisionError(err), 'permanent_auth');
  });
});
