/**
 * Testes de integração — rotas de pose em fotos-alunos
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

mockModule('../services/progress-photo-pose.service', {
  classifyProgressPhotoPose: async () => ({
    pose: 'frente',
    confidence: 0.91,
    reason: 'Rosto visível',
    source: 'vision',
    people_count: 1,
    suitable_for_compare: true,
  }),
  resolveImageBufferFromUrl: async () => Buffer.from('fake'),
});

mockModule('../middleware/rate-limiter', new Proxy({}, { get: () => (_req, _res, next) => next() }));

const createFotosAlunosPoseRouter = require('../routes/fotos-alunos-pose');

const ALUNO1 = '11111111-1111-4111-8111-111111111111';
const FOTO1 = '33333333-3333-4333-8333-333333333333';
const COACH1 = 'aaaaaaaa-0000-4000-8000-000000000002';

const USERS = {
  'tok-coach': { id: COACH1, role: 'coach' },
  'tok-aluno': { id: 'aaaaaaaa-0000-4000-8000-000000000001', role: 'aluno' },
};

let hasMeta = true;

const fakePool = {
  async query(sql, params = []) {
    const text = String(sql);
    if (text.includes('information_schema.columns') && text.includes('pose_efetiva')) {
      return { rows: hasMeta ? [{ '?': 1 }] : [] };
    }
    if (text.includes('FROM public.alunos') && text.includes('coach_id = $2')) {
      return { rows: [{ '?': 1 }] };
    }
    if (text.includes('FROM public.alunos a') && text.includes('coach')) {
      return { rows: [{ id: ALUNO1, coach_id: COACH1 }] };
    }
    if (text.includes('FROM public.fotos_alunos f') && text.includes('WHERE f.id')) {
      return {
        rows: [
          {
            id: FOTO1,
            aluno_id: ALUNO1,
            url: `/api/uploads/storage/progress-photos/${ALUNO1}/foto.jpg`,
            descricao: null,
            coach_id: COACH1,
            pose_coach: null,
            pose_analysis_attempts: 0,
          },
        ],
      };
    }
    if (text.includes('UPDATE public.fotos_alunos SET') && text.includes('pose_coach')) {
      return {
        rows: [
          {
            id: params[0],
            pose_coach: params[1],
            pose_efetiva: params[6],
            pose_source: params[7],
            descricao: params[8],
          },
        ],
      };
    }
    if (text.includes('pose_analysis_status = \'processing\'')) {
      return { rows: [] };
    }
    if (text.includes('pose_analysis_status = \'pending\'')) {
      return { rows: [] };
    }
    if (text.includes('FOR UPDATE SKIP LOCKED')) {
      return { rows: [] };
    }
    if (text.includes('COUNT(*)::int AS total')) {
      return { rows: [{ total: 1, pending: 0, classified: 1, metadata_ready: true }] };
    }
    throw new Error(`fakePool: SQL não mapeado: ${text.slice(0, 120)}`);
  },
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

const requireAlunoWhenStudent = () => (req, _res, next) => {
  req.aluno = { id: ALUNO1 };
  next();
};

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createFotosAlunosPoseRouter(fakePool, fakeAuthenticate, (_req, _res, next) => next(), requireAlunoWhenStudent),
  );
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
});

describe('PATCH /api/fotos-alunos/:id/pose', () => {
  test('coach pode corrigir pose', async () => {
    const res = await fetch(`${baseUrl}/api/fotos-alunos/${FOTO1}/pose`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer tok-coach',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pose: 'costas' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pose_coach, 'costas');
    assert.equal(body.pose_source, 'coach');
  });

  test('aluno não pode corrigir pose → 403', async () => {
    const res = await fetch(`${baseUrl}/api/fotos-alunos/${FOTO1}/pose`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer tok-aluno',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pose: 'frente' }),
    });
    assert.equal(res.status, 403);
  });
});

describe('POST /api/fotos-alunos/classify-pose', () => {
  test('classifica por foto_id', async () => {
    const res = await fetch(`${baseUrl}/api/fotos-alunos/classify-pose`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok-aluno',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ foto_id: FOTO1 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pose, 'frente');
    assert.equal(body.confidence, 0.91);
  });
});
