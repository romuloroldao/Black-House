const test = require('node:test');
const assert = require('node:assert/strict');

const aiManager = require('../services/ai');
const aiService = require('../services/ai.service');

const { parseVisionModelSpec } = aiManager;

test('parseVisionModelSpec aceita prefixo de provider e modelos com barra', () => {
  assert.deepEqual(parseVisionModelSpec('groq:qwen/qwen3.8-27b', 'gemini'), {
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
  });
  assert.deepEqual(parseVisionModelSpec('gemini-flash-latest', 'gemini'), {
    provider: 'gemini',
    model: 'gemini-flash-latest',
  });
  assert.deepEqual(parseVisionModelSpec(' GEMINI:gemini-3.6-flash ', 'groq'), {
    provider: 'gemini',
    model: 'gemini-3.6-flash',
  });
});

test('getVisionModelChain prefixa fallbacks sem provider e remove duplicados', (t) => {
  const original = process.env.AI_VISION_MODEL_FALLBACKS;
  t.after(() => {
    if (original === undefined) delete process.env.AI_VISION_MODEL_FALLBACKS;
    else process.env.AI_VISION_MODEL_FALLBACKS = original;
  });
  t.mock.method(aiManager, 'getProviderInfo', () => ({
    vision: { provider: 'gemini', model: 'gemini-3.6-flash' },
  }));
  process.env.AI_VISION_MODEL_FALLBACKS = 'gemini-3.6-flash, groq:qwen/qwen3.8-27b,gemini-flash-latest';
  assert.deepEqual(aiService.getVisionModelChain(), [
    'gemini:gemini-3.6-flash',
    'groq:qwen/qwen3.8-27b',
    'gemini:gemini-flash-latest',
  ]);
});

test('analyzeMealPhotoWithModelFallback passa ao próximo modelo após 503 e devolve o primeiro sucesso', async (t) => {
  t.mock.method(aiService, 'getVisionModelChain', () => ['gemini:a', 'groq:b', 'gemini:c']);
  const tried = [];
  t.mock.method(aiService, 'analyzeMealPhoto', async (_b, _m, _s, _u, opts) => {
    tried.push(opts.model);
    assert.equal(opts.feature, 'pose');
    if (opts.model === 'gemini:a') throw Object.assign(new Error('[503 Service Unavailable]'), { status: 503 });
    return { pose: 'frente', model: opts.model };
  });
  const result = await aiService.analyzeMealPhotoWithModelFallback(Buffer.from('x'), 'image/jpeg', 's', 'u', {
    feature: 'pose',
  });
  assert.deepEqual(tried, ['gemini:a', 'groq:b']);
  assert.equal(result.model, 'groq:b');
});

test('deadlineMs limita o timeout de cada modelo e interrompe a cadeia sem tempo restante', async (t) => {
  t.mock.method(aiService, 'getVisionModelChain', () => ['gemini:a', 'gemini:b', 'gemini:c']);
  const realNow = Date.now;
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  t.after(() => {
    Date.now = realNow;
  });
  const timeouts = [];
  t.mock.method(aiService, 'analyzeMealPhoto', async (_b, _m, _s, _u, opts) => {
    timeouts.push([opts.model, opts.timeoutMs, 'deadlineMs' in opts]);
    now += 46_000;
    throw new Error('lento');
  });
  await assert.rejects(
    aiService.analyzeMealPhotoWithModelFallback(Buffer.from('x'), 'image/jpeg', 's', 'u', {
      timeoutMs: 30000,
      deadlineMs: 50000,
    }),
    /lento/,
  );
  assert.deepEqual(timeouts, [['gemini:a', 30000, false]]);
});

test('analyzeMealPhotoWithModelFallback lança o último erro quando toda a cadeia falha', async (t) => {
  t.mock.method(aiService, 'getVisionModelChain', () => ['gemini:a', 'groq:b']);
  t.mock.method(aiService, 'analyzeMealPhoto', async (_b, _m, _s, _u, opts) => {
    throw new Error(`falhou ${opts.model}`);
  });
  await assert.rejects(
    aiService.analyzeMealPhotoWithModelFallback(Buffer.from('x'), 'image/jpeg', 's', 'u'),
    /falhou groq:b/,
  );
});
