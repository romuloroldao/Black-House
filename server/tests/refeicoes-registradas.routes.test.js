/**
 * Testes de integração (rotas) — refeições registadas e imagens de refeição.
 *
 * Sobe um Express real com os routers de produção, mas com:
 * - pool PostgreSQL falso (respostas canned por padrão de SQL);
 * - authenticate falso (tokens de teste → users);
 * - serviço de IA mockado (sem chamadas externas);
 * - rate limiter mockado (pass-through).
 *
 * Cobre: analyze com IA mockada, 403 cross-aluno, GET de imagem sem auth.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('path');

// ---------------------------------------------------------------------------
// Mocks via require.cache (antes de carregar os routers)
// ---------------------------------------------------------------------------

function mockModule(relPath, exportsObj) {
  const resolved = require.resolve(relPath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsObj,
  };
}

const CANNED_ANALYSIS = {
  ok: true,
  status: 'OK',
  nome_sugerido: 'Frango grelhado com arroz',
  confidence: 0.72,
  itens: [
    { nome: 'Arroz branco', quantidade: 150, unidade: 'g', kcal: 190, ptn: 4, cho: 42, lip: 0.4 },
    { nome: 'Frango grelhado', quantidade: 120, unidade: 'g', kcal: 198, ptn: 37, cho: 0, lip: 4.4 },
  ],
  totais: { kcal: 388, ptn: 41, cho: 42, lip: 4.8 },
  uncertainties: [],
  disclaimer: 'Estimativa aproximada. Revise as porções antes de salvar.',
};

mockModule('../services/meal-photo-ai.service', {
  analyzeMealPhoto: async () => ({ ...CANNED_ANALYSIS }),
});

mockModule('../middleware/rate-limiter', new Proxy(
  {},
  {
    // Qualquer limiter pedido vira pass-through.
    get: () => (req, res, next) => next(),
  },
));

const createRefeicoesRegistradasRouter = require('../routes/refeicoes-registradas');
const createUploadsRouter = require('../routes/uploads');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALUNO1 = '11111111-1111-4111-8111-111111111111';
const ALUNO2 = '22222222-2222-4222-8222-222222222222';
const MEAL1 = '33333333-3333-4333-8333-333333333333';

const USERS = {
  'tok-aluno1': { id: 'aaaaaaaa-0000-4000-8000-000000000001', role: 'aluno' },
  'tok-aluno2': { id: 'aaaaaaaa-0000-4000-8000-000000000002', role: 'aluno' },
};

const ALUNO_BY_USER = {
  'aaaaaaaa-0000-4000-8000-000000000001': { id: ALUNO1, nome: 'Aluno Um' },
  'aaaaaaaa-0000-4000-8000-000000000002': { id: ALUNO2, nome: 'Aluno Dois' },
};

const MEALS = {
  [MEAL1]: {
    id: MEAL1,
    aluno_id: ALUNO1,
    nome_sugerido: 'Almoço livre',
    kcal: 388,
    ptn: 41,
    cho: 42,
    lip: 4.8,
    origem: 'AI_ESTIMATE',
  },
};

/** Pool falso: responde por padrão de SQL. */
const fakePool = {
  async query(sql, params = []) {
    const text = String(sql);
    if (text.includes('information_schema.columns')) {
      return { rows: [{ column_name: 'user_id' }] };
    }
    if (text.includes('FROM public.alunos a')) {
      const aluno = ALUNO_BY_USER[params[0]];
      return { rows: aluno ? [{ ...aluno }] : [] };
    }
    if (text.includes('FROM public.refeicoes_registradas WHERE id')) {
      const meal = MEALS[params[0]];
      return { rows: meal ? [{ ...meal }] : [] };
    }
    if (text.includes('FROM public.refeicao_registrada_itens')) {
      return { rows: [] };
    }
    if (text.includes('FROM public.refeicoes_registradas r')) {
      return { rows: Object.values(MEALS).filter((m) => m.aluno_id === params[0]) };
    }
    throw new Error(`fakePool: SQL não mapeado no teste: ${text.slice(0, 80)}`);
  },
  async connect() {
    return {
      async query(sql, params = []) {
        const text = String(sql);
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
        if (text.includes('INSERT INTO public.refeicoes_registradas')) {
          return {
            rows: [
              {
                id: '44444444-4444-4444-8444-444444444444',
                aluno_id: params[0],
                nome_sugerido: params[2],
                origem: params[12],
              },
            ],
          };
        }
        if (text.includes('INSERT INTO public.refeicao_registrada_itens')) {
          return { rows: [{ id: '55555555-5555-4555-8555-555555555555', nome: params[1] }] };
        }
        throw new Error(`fakePool.client: SQL não mapeado: ${text.slice(0, 80)}`);
      },
      release() {},
    };
  },
};

/** Authenticate falso: Bearer token de teste → req.user. */
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

const passthroughGuard = (req, res, next) => next();

// ---------------------------------------------------------------------------
// Servidor de teste
// ---------------------------------------------------------------------------

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/refeicoes-registradas',
    createRefeicoesRegistradasRouter(fakePool, fakeAuthenticate, passthroughGuard),
  );
  app.use('/api/uploads', createUploadsRouter(fakePool, fakeAuthenticate));

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

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('POST /api/refeicoes-registradas/analyze', () => {
  test('devolve análise mockada com disclaimer e imagem_path', async () => {
    const fd = new FormData();
    fd.append('imagem_path', `/api/uploads/storage/meal-photos/${ALUNO1}/foto.jpg`);
    const res = await fetch(`${baseUrl}/api/refeicoes-registradas/analyze`, {
      method: 'POST',
      headers: authHeaders('tok-aluno1'),
      body: fd,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'OK');
    assert.equal(body.itens.length, 2);
    assert.equal(body.imagem_path, `/api/uploads/storage/meal-photos/${ALUNO1}/foto.jpg`);
    assert.ok(String(body.disclaimer).toLowerCase().includes('estimativa'));
  });

  test('sem autenticação → 401', async () => {
    const fd = new FormData();
    fd.append('imagem_path', '/x.jpg');
    const res = await fetch(`${baseUrl}/api/refeicoes-registradas/analyze`, {
      method: 'POST',
      body: fd,
    });
    assert.equal(res.status, 401);
  });

  test('sem imagem nem imagem_path → 400 EMPTY_IMAGE', async () => {
    const fd = new FormData();
    fd.append('nada', 'x');
    const res = await fetch(`${baseUrl}/api/refeicoes-registradas/analyze`, {
      method: 'POST',
      headers: authHeaders('tok-aluno1'),
      body: fd,
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error_code, 'EMPTY_IMAGE');
  });
});

describe('GET /api/refeicoes-registradas/:id — ownership', () => {
  test('dono da refeição → 200 com itens', async () => {
    const res = await fetch(`${baseUrl}/api/refeicoes-registradas/${MEAL1}`, {
      headers: authHeaders('tok-aluno1'),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, MEAL1);
    assert.ok(Array.isArray(body.itens));
  });

  test('outro aluno → 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/refeicoes-registradas/${MEAL1}`, {
      headers: authHeaders('tok-aluno2'),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error_code, 'FORBIDDEN');
  });

  test('sem autenticação → 401', async () => {
    const res = await fetch(`${baseUrl}/api/refeicoes-registradas/${MEAL1}`);
    assert.equal(res.status, 401);
  });
});

describe('POST /api/refeicoes-registradas — salvar', () => {
  test('grava e devolve 201 com origem AI_ESTIMATE quando não editado', async () => {
    const res = await fetch(`${baseUrl}/api/refeicoes-registradas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders('tok-aluno1') },
      body: JSON.stringify({
        nome_sugerido: 'Almoço livre',
        itens: CANNED_ANALYSIS.itens.map((it, i) => ({ ...it, fonte: 'AI', ordem: i })),
        kcal: 388,
        ptn: 41,
        cho: 42,
        lip: 4.8,
        ai_kcal: 388,
        ai_ptn: 41,
        ai_cho: 42,
        ai_lip: 4.8,
        ai_itens_count: 2,
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.origem, 'AI_ESTIMATE');
  });

  test('refeição vazia → 400 EMPTY_MEAL', async () => {
    const res = await fetch(`${baseUrl}/api/refeicoes-registradas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders('tok-aluno1') },
      body: JSON.stringify({ itens: [] }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error_code, 'EMPTY_MEAL');
  });
});

describe('GET /api/uploads/storage/meal-photos/:alunoId/:filename', () => {
  test('sem autenticação → 401', async () => {
    const res = await fetch(
      `${baseUrl}/api/uploads/storage/meal-photos/${ALUNO1}/foto.jpg`,
    );
    assert.equal(res.status, 401);
  });

  test('aluno a pedir foto de outro aluno → 403', async () => {
    const res = await fetch(
      `${baseUrl}/api/uploads/storage/meal-photos/${ALUNO1}/foto.jpg`,
      { headers: authHeaders('tok-aluno2') },
    );
    assert.equal(res.status, 403);
  });

  test('dono, ficheiro inexistente → 404 (autorizado mas sem ficheiro)', async () => {
    const res = await fetch(
      `${baseUrl}/api/uploads/storage/meal-photos/${ALUNO1}/nao-existe.jpg`,
      { headers: authHeaders('tok-aluno1') },
    );
    assert.equal(res.status, 404);
  });
});
