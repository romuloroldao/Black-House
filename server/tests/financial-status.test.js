const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  computePaymentStatusFromPayments,
  getStudentPaymentStatus,
} = require('../utils/financial-status');

function makePool(handlers) {
  return {
    query: async (sql, params) => {
      for (const h of handlers) {
        if (h.match(sql, params)) return h.result(sql, params);
      }
      throw new Error(`Unexpected query: ${String(sql).slice(0, 120)}`);
    },
  };
}

describe('financial-status access cache', () => {
  test('computePaymentStatusFromPayments returns CURRENT when no overdue', async () => {
    const pool = makePool([
      {
        match: (sql) => String(sql).includes('FROM public.asaas_payments'),
        result: () => ({ rows: [] }),
      },
    ]);
    const r = await computePaymentStatusFromPayments(pool, 'aluno-1');
    assert.equal(r.payment_status, 'CURRENT');
    assert.equal(r.reason, 'no_overdue_payment');
  });

  test('getStudentPaymentStatus heals stale granted+OVERDUE cache', async () => {
    const pool = makePool([
      {
        match: (sql) => String(sql).includes('FROM public.alunos'),
        result: () => ({
          rows: [{ id: 'aluno-1', coach_id: 'c1', email: 'a@b.com', nome: 'A' }],
        }),
      },
      {
        match: (sql) => String(sql).includes('FROM public.financial_exceptions'),
        result: () => ({ rows: [] }),
      },
      {
        match: (sql) => String(sql).includes('FROM public.student_access_state'),
        result: () => ({
          rows: [{
            payment_status: 'OVERDUE',
            access_status: 'granted',
            in_grace_period: false,
            grace_days_remaining: null,
          }],
        }),
      },
      {
        match: (sql) => String(sql).includes('FROM public.asaas_payments'),
        result: () => ({ rows: [] }),
      },
    ]);

    const r = await getStudentPaymentStatus(pool, { alunoId: 'aluno-1' });
    assert.equal(r.payment_status, 'CURRENT');
    assert.equal(r.reason, 'cache_stale_healed');
  });

  test('non-blocking exception forces CURRENT even with cache', async () => {
    const pool = makePool([
      {
        match: (sql) => String(sql).includes('FROM public.alunos'),
        result: () => ({
          rows: [{ id: 'aluno-1', coach_id: 'c1', email: 'a@b.com', nome: 'A' }],
        }),
      },
      {
        match: (sql) => String(sql).includes('FROM public.financial_exceptions'),
        result: () => ({
          rows: [{ id: 'ex1', tipo: 'isento', ativo: true }],
        }),
      },
    ]);

    const r = await getStudentPaymentStatus(pool, { alunoId: 'aluno-1' });
    assert.equal(r.payment_status, 'CURRENT');
    assert.equal(r.reason, 'financial_exception_isento');
  });
});
