/**
 * Testes de integração — GET /api/alunos/:alunoId/logbook-progressao
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

function mockModule(relPath, exportsObj) {
  const resolved = require.resolve(relPath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsObj,
  };
}

const ALUNO1 = '11111111-1111-4111-8111-111111111111';
const ALUNO2 = '22222222-2222-4222-8222-222222222222';
const COACH_USER = 'bbbbbbbb-0000-4000-8000-000000000001';

const MOCK_PROGRESSAO = {
  aluno_id: ALUNO1,
  empty: false,
  source: 'logbook',
  period: { key: '30', days: 30, start: '2026-08-03', end: '2026-09-01' },
  exercises: [{ key: 'slot:aaa', name: 'Supino reto', trend: 'evoluindo' }],
};

let accessMatrix = {};
let lastCall = null;

mockModule('../services/logbook-progressao.service', {
  getLoadProgression: async (pool, alunoId, opts) => {
    lastCall = { alunoId, opts };
    return { ...MOCK_PROGRESSAO, aluno_id: alunoId };
  },
  invalidateAluno: () => {},
});

mockModule('../services/coach-team.service', {
  resolveCoachScope: async (_pool, userId, role) => ({
    userId,
    role,
    coachIds: [COACH_USER],
    isAdmin: role === 'admin',
  }),
  assertCoachCanAccessAluno: async (_pool, _scope, alunoId) => Boolean(accessMatrix[alunoId]),
  listTeamMembers: async () => [],
  addTeamMember: async () => {},
  removeTeamMember: async () => {},
});

mockModule('../middleware/rate-limiter', new Proxy({}, { get: () => (_req, _res, next) => next() }));

const createApiRouter = require('../routes/api');

const USERS = {
  'tok-coach': { id: COACH_USER, role: 'coach' },
  'tok-aluno1': { id: 'aaaaaaaa-0000-4000-8000-000000000001', role: 'aluno' },
  'tok-admin': { id: 'cccccccc-0000-4000-8000-000000000001', role: 'admin' },
};

function fakeAuthenticate(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token ? USERS[token] : null;
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado', error_code: 'UNAUTHENTICATED' });
  }
  req.user = user;
  return next();
}

const passthroughGuard = (_req, _res, next) => next();

const fakePool = {
  query: async () => ({ rows: [] }),
  connect: async () => ({
    query: async () => ({ rows: [] }),
    release: () => {},
  }),
};

let server;
let baseUrl;

before(async () => {
  accessMatrix = { [ALUNO1]: true, [ALUNO2]: false };
  lastCall = null;

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(fakePool, fakeAuthenticate, passthroughGuard));

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
});

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

describe('GET /api/alunos/:alunoId/logbook-progressao', () => {
  test('coach com acesso recebe payload', async () => {
    const res = await fetch(`${baseUrl}/api/alunos/${ALUNO1}/logbook-progressao?period=30`, {
      headers: authHeaders('tok-coach'),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'logbook');
    assert.equal(lastCall.opts.period, '30');
  });

  test('coach sem acesso recebe 403', async () => {
    const res = await fetch(`${baseUrl}/api/alunos/${ALUNO2}/logbook-progressao`, {
      headers: authHeaders('tok-coach'),
    });
    assert.equal(res.status, 403);
  });

  test('aluno não pode aceder rota de coach', async () => {
    const res = await fetch(`${baseUrl}/api/alunos/${ALUNO1}/logbook-progressao`, {
      headers: authHeaders('tok-aluno1'),
    });
    assert.equal(res.status, 403);
  });

  test('admin acede sem assertCoachCanAccessAluno', async () => {
    const res = await fetch(`${baseUrl}/api/alunos/${ALUNO2}/logbook-progressao`, {
      headers: authHeaders('tok-admin'),
    });
    assert.equal(res.status, 200);
  });
});
