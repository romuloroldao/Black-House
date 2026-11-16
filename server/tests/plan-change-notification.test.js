const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PlanChangeNotificationService,
  presentStatus,
  COPY,
} = require('../services/plan-change-notification.service');
const { buildStudentNotificationEmail } = require('../utils/student-notification-email-templates');

function fakePool(handler = () => ({ rows: [] })) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      return handler(sql, params);
    },
  };
}

test('cópia aprovada para dieta e treino, com link para o módulo', () => {
  assert.equal(
    COPY.dieta.mensagem,
    'Seu profissional realizou uma atualização no seu plano alimentar. Acesse sua dieta para conferir as alterações.',
  );
  assert.equal(COPY.dieta.link, 'diet');
  assert.equal(COPY.treino.mensagem, 'Seu treino foi atualizado. Confira as novas orientações na plataforma.');
  assert.equal(COPY.treino.link, 'workouts');
});

test('templates de e-mail existem para dieta_atualizada e treino_atualizado', () => {
  for (const tipo of ['dieta_atualizada', 'treino_atualizado']) {
    const built = buildStudentNotificationEmail(tipo, { alunoNome: 'Ana' });
    assert.ok(built, tipo);
    assert.match(built.subject, /atualizado/);
    assert.ok(built.htmlPayload.ctaUrl);
    assert.ok(built.text.includes(tipo === 'dieta_atualizada' ? COPY.dieta.mensagem : COPY.treino.mensagem));
  }
});

test('schedule ignora domínio inválido ou aluno ausente sem consultar o banco', async () => {
  const pool = fakePool();
  const svc = new PlanChangeNotificationService(pool);
  assert.equal(await svc.schedule({ dominio: 'outro', alunoId: 'a' }), null);
  assert.equal(await svc.schedule({ dominio: 'dieta', alunoId: null }), null);
  assert.equal(pool.calls.length, 0);
});

test('schedule faz upsert na linha pendente (dedupe por aluno+domínio)', async () => {
  const pool = fakePool(() => ({ rows: [{ id: 'p1', due_at: 'x', change_count: 2 }] }));
  const svc = new PlanChangeNotificationService(pool);
  const row = await svc.schedule({ dominio: 'dieta', alunoId: 'a1', entityId: 'd1', source: 't' });
  assert.equal(row.change_count, 2);
  assert.match(pool.calls[0].sql, /ON CONFLICT \(aluno_id, dominio\) WHERE status = 'pending'/);
});

test('schedule nunca lança: falha do aviso não pode falhar a gravação', async () => {
  const pool = fakePool(() => {
    throw new Error('db down');
  });
  const svc = new PlanChangeNotificationService(pool);
  assert.equal(await svc.schedule({ dominio: 'treino', alunoId: 'a1' }), null);
});

test('presentStatus: e-mail só conta como enviado quando email_queue confirmou', () => {
  const base = { id: '1', dominio: 'dieta', status: 'sent', in_app_status: 'created', email_status: 'queued' };
  assert.equal(presentStatus({ ...base, email_queue_status: 'pending' }).email, 'queued');
  assert.equal(presentStatus({ ...base, email_queue_status: 'failed' }).email, 'queued');
  assert.equal(presentStatus({ ...base, email_queue_status: 'sent' }).email, 'sent_to_provider');
  assert.equal(presentStatus({ ...base, email_queue_status: 'dead' }).email, 'failed');
  assert.equal(presentStatus({ ...base, email_queue_status: null }).email, 'unknown');
});

test('presentStatus: leitura vem de notificacoes.lida', () => {
  const base = { id: '1', dominio: 'treino', status: 'sent', in_app_status: 'created', email_status: 'skipped_preference' };
  assert.equal(presentStatus({ ...base, notificacao_lida: false }).in_app, 'created');
  assert.equal(presentStatus({ ...base, notificacao_lida: true }).in_app, 'read');
  assert.equal(presentStatus(base).email, 'skipped_preference');
});
