const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const poseServicePath = path.resolve(__dirname, '../services/progress-photo-pose.service.js');

let visionImpl = async () => ({ pose: 'lado_direito', confidence: 0.95, people_count: 1 });
require.cache[poseServicePath] = {
  id: poseServicePath,
  filename: poseServicePath,
  loaded: true,
  exports: {
    classifyProgressPhotoPose: (...args) => visionImpl(...args),
    resolveImageBufferFromUrl: async () => Buffer.from('foto-lateral'),
  },
};

const { classifyAndPersistPhoto } = require('../services/foto-pose-normalization.service');

function makePool({ cachedRow = null } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('information_schema.columns')) return { rows: [{ 1: 1 }] };
      if (sql.includes('pose_reclassify_at IS NULL') && sql.includes('content_hash = $1')) {
        return { rows: cachedRow ? [cachedRow] : [] };
      }
      if (sql.includes('RETURNING *')) {
        return { rows: [{ id: params[0], pose_efetiva: params[6], pose_source: params[7] }] };
      }
      return { rows: [], rowCount: 1 };
    },
  };
}

const reclassifyRow = {
  id: 'foto-1',
  url: 'https://example.test/f.jpg',
  descricao: 'lado_esquerdo',
  pose_coach: null,
  pose_aluno: 'lado_esquerdo',
  pose_analysis_status: 'classified',
  pose_reclassify_at: new Date(),
};

const touches = (pool, pattern) => pool.queries.some((q) => pattern.test(q.sql));

test('reclassificação ignora o atalho "já classificada" e limpa a marca', async () => {
  visionImpl = async () => ({ pose: 'lado_direito', confidence: 0.95, people_count: 1 });
  const pool = makePool();
  const saved = await classifyAndPersistPhoto(pool, reclassifyRow);
  assert.equal(saved.pose_efetiva, 'lado_direito');
  assert.ok(touches(pool, /pose_reclassify_at = NULL/));
  assert.ok(!touches(pool, /SELECT pose_analysis_status, content_hash/));
});

test('erro transitório mantém a foto classificada e a marca para nova tentativa', async () => {
  visionImpl = async () => {
    const err = new Error('429 Too Many Requests');
    err.status = 429;
    throw err;
  };
  const pool = makePool();
  const result = await classifyAndPersistPhoto(pool, reclassifyRow);
  assert.equal(result, null);
  assert.ok(!touches(pool, /pose_analysis_status = 'pending'/));
  assert.ok(!touches(pool, /pose_analysis_status = 'failed'/));
  assert.ok(!touches(pool, /pose_reclassify_at = NULL/));
});

test('erro permanente desiste da reclassificação sem marcar falha', async () => {
  visionImpl = async () => {
    throw new Error('Invalid JSON from model');
  };
  const pool = makePool();
  const result = await classifyAndPersistPhoto(pool, reclassifyRow);
  assert.equal(result, null);
  assert.ok(!touches(pool, /pose_analysis_status = 'failed'/));
  assert.ok(touches(pool, /pose_reclassify_at = NULL/));
});

test('foto pendente normal continua a usar markFailed em erro permanente', async () => {
  visionImpl = async () => {
    const err = new Error('Bad request');
    err.status = 400;
    throw err;
  };
  const pool = makePool();
  await classifyAndPersistPhoto(pool, {
    ...reclassifyRow,
    pose_analysis_status: 'pending',
    pose_reclassify_at: null,
  });
  assert.ok(touches(pool, /pose_analysis_status = 'failed'/));
});
