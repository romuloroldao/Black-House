const test = require('node:test');
const assert = require('node:assert/strict');

const { setUsagePool, trackAiCall, errorKindOf } = require('../services/ai/usage-log');

function fakePool() {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
}

test('trackAiCall regista sucesso com feature, modalidade e latência', async () => {
  const pool = fakePool();
  setUsagePool(pool);
  const result = await trackAiCall(
    { feature: 'pose', modality: 'vision', provider: 'gemini', model: 'm1' },
    async () => ({ pose: 'frente' }),
  );
  assert.deepEqual(result, { pose: 'frente' });
  await new Promise((r) => setImmediate(r));
  assert.equal(pool.calls.length, 1);
  const [feature, modality, provider, model, status, errorKind, latency] = pool.calls[0].params;
  assert.equal(feature, 'pose');
  assert.equal(modality, 'vision');
  assert.equal(provider, 'gemini');
  assert.equal(model, 'm1');
  assert.equal(status, 'ok');
  assert.equal(errorKind, null);
  assert.ok(Number.isInteger(latency) && latency >= 0);
});

test('trackAiCall regista erro e propaga a exceção original', async () => {
  const pool = fakePool();
  setUsagePool(pool);
  const boom = new Error('[429 Too Many Requests] quota exceeded GenerateRequestsPerDayPerProjectPerModel-FreeTier');
  await assert.rejects(
    trackAiCall({ feature: 'meal_photo', modality: 'vision' }, async () => {
      throw boom;
    }),
    (err) => err === boom,
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(pool.calls[0].params[4], 'error');
  assert.equal(pool.calls[0].params[5], 'quota_daily');
});

test('falha ao gravar não afeta a chamada', async () => {
  setUsagePool({ query: async () => { throw new Error('db down'); } });
  const result = await trackAiCall({ feature: 'agent' }, async () => 42);
  assert.equal(result, 42);
  setUsagePool(null);
});

test('errorKindOf distingue limite por minuto, timeout e configuração', () => {
  assert.equal(errorKindOf(Object.assign(new Error('Rate limit reached'), { status: 429 })), 'rate_limit');
  assert.equal(errorKindOf(Object.assign(new Error('x'), { code: 'AI_TIMEOUT' })), 'timeout');
  assert.equal(errorKindOf(new Error('[404 Not Found] model not found')), 'permanent_config');
});
