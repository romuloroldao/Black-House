const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isoDayOfWeek,
  normalizeSessions,
} = require('../services/aluno-treino-agenda.service');

describe('aluno-treino-agenda.service', () => {
  test('isoDayOfWeek: domingo = 7', () => {
    // 2026-07-19 was a Sunday
    assert.equal(isoDayOfWeek(new Date('2026-07-19T15:00:00')), 7);
  });

  test('isoDayOfWeek: segunda = 1', () => {
    assert.equal(isoDayOfWeek(new Date('2026-07-20T15:00:00')), 1);
  });

  test('normalizeSessions permite o mesmo aluno_treino_id em vários dias', () => {
    const same = '11111111-1111-4111-8111-111111111111';
    const sessions = normalizeSessions([
      { dia_semana: 1, aluno_treino_id: same },
      { dia_semana: 3, aluno_treino_id: same },
      { dia_semana: 6, aluno_treino_id: same },
    ]);
    assert.equal(sessions.length, 3);
    assert.deepEqual(
      sessions.map((s) => s.dia_semana),
      [1, 3, 6],
    );
    assert.ok(sessions.every((s) => s.aluno_treino_id === same));
  });

  test('normalizeSessions rejeita dia inválido', () => {
    assert.throws(
      () => normalizeSessions([{ dia_semana: 0, aluno_treino_id: 'x' }]),
      (err) => err.error_code === 'INVALID_DIA_SEMANA',
    );
  });

  test('normalizeSessions deduplica o mesmo dia (última ganha)', () => {
    const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const sessions = normalizeSessions([
      { dia_semana: 2, aluno_treino_id: a },
      { dia_semana: 2, aluno_treino_id: b },
    ]);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].aluno_treino_id, b);
  });

  test('semana vazia (só descanso) é válida', () => {
    assert.deepEqual(normalizeSessions([]), []);
  });
});
