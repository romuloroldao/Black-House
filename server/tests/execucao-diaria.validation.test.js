/**
 * Testes de validação — execução diária Phase 1a.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

describe('refeicao-conclusao.service upsertForAluno', () => {
  test('rejects missing dieta_id/meal_key', async () => {
    const svc = require('../services/refeicao-conclusao.service');
    await assert.rejects(
      () => svc.upsertForAluno({}, 'aluno-1', { coach_id: 'c1' }, {}),
      (err) => err.statusCode === 400,
    );
  });

  test('rejects dieta not owned by aluno', async () => {
    const repo = require('../repositories/refeicao-conclusao.repository');
    const original = repo.assertDietaOwnsAluno;
    repo.assertDietaOwnsAluno = async () => false;
    try {
      const svc = require('../services/refeicao-conclusao.service');
      await assert.rejects(
        () =>
          svc.upsertForAluno(
            {},
            'aluno-1',
            { coach_id: 'c1' },
            { dieta_id: 'd1', meal_key: 'almoco', concluido: true },
          ),
        (err) => err.statusCode === 403,
      );
    } finally {
      repo.assertDietaOwnsAluno = original;
    }
  });
});

describe('treino-sessao.service validation', () => {
  test('startOrGetSession requires treino_id', async () => {
    const svc = require('../services/treino-sessao.service');
    await assert.rejects(
      () => svc.startOrGetSession({}, 'aluno-1', {}),
      (err) => err.statusCode === 400,
    );
  });

  test('listCargas requires treino_id', async () => {
    const svc = require('../services/treino-sessao.service');
    await assert.rejects(
      () => svc.listCargas({}, 'aluno-1', null),
      (err) => err.statusCode === 400,
    );
  });
});
