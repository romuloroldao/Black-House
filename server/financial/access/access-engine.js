const { getStudentPaymentStatus } = require('../../utils/financial-status');
const { logFinancialAudit } = require('../audit/audit-logger');
const { getAuthUserIdForAluno } = require('../../utils/aluno-auth-user');
const logger = require('../../utils/logger');

async function getCoachFinancialPolicy(pool, coachId) {
  const result = await pool.query(
    'SELECT * FROM public.coach_financial_policies WHERE coach_id = $1 LIMIT 1',
    [coachId],
  );
  if (result.rows[0]) return result.rows[0];

  const inserted = await pool.query(
    `INSERT INTO public.coach_financial_policies (coach_id)
     VALUES ($1)
     ON CONFLICT (coach_id) DO NOTHING
     RETURNING *`,
    [coachId],
  );
  return inserted.rows[0] || {
    grace_period_days: 0,
    auto_block_enabled: true,
    block_on_statuses: ['OVERDUE', 'PENDING_AFTER_DUE_DATE'],
    unblock_on_statuses: ['RECEIVED', 'CONFIRMED'],
  };
}

async function recalculateStudentAccess(pool, alunoId, { notificationService = null } = {}) {
  const alunoResult = await pool.query(
    'SELECT id, coach_id, email, nome FROM public.alunos WHERE id = $1 LIMIT 1',
    [alunoId],
  );
  const aluno = alunoResult.rows[0];
  if (!aluno) return null;

  const policy = await getCoachFinancialPolicy(pool, aluno.coach_id);
  const financial = await getStudentPaymentStatus(pool, { alunoId });

  let paymentStatus = financial.payment_status;
  let accessStatus = 'granted';
  let inGracePeriod = false;
  let graceDaysRemaining = null;

  if (policy.auto_block_enabled) {
    if (paymentStatus === 'OVERDUE' || paymentStatus === 'PENDING_AFTER_DUE_DATE') {
      const overdueResult = await pool.query(
        `SELECT MIN(due_date) AS oldest_due
         FROM public.asaas_payments
         WHERE aluno_id = $1
           AND deleted_at IS NULL
           AND (status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE))`,
        [alunoId],
      );
      const oldestDue = overdueResult.rows[0]?.oldest_due;
      if (oldestDue) {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(oldestDue).getTime()) / (1000 * 60 * 60 * 24),
        );
        const grace = Number(policy.grace_period_days) || 0;
        if (daysOverdue <= grace) {
          inGracePeriod = true;
          graceDaysRemaining = grace - daysOverdue;
          accessStatus = 'granted';
        } else {
          accessStatus = 'blocked';
        }
      }
    }
  }

  const prev = await pool.query(
    'SELECT * FROM public.student_access_state WHERE aluno_id = $1 LIMIT 1',
    [alunoId],
  );
  const prevRow = prev.rows[0];

  const result = await pool.query(
    `INSERT INTO public.student_access_state
      (aluno_id, coach_id, access_status, payment_status, in_grace_period,
       grace_days_remaining, blocked_at, unblocked_at, last_calculated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (aluno_id) DO UPDATE SET
       coach_id = EXCLUDED.coach_id,
       access_status = EXCLUDED.access_status,
       payment_status = EXCLUDED.payment_status,
       in_grace_period = EXCLUDED.in_grace_period,
       grace_days_remaining = EXCLUDED.grace_days_remaining,
       blocked_at = CASE
         WHEN EXCLUDED.access_status = 'blocked' AND public.student_access_state.access_status <> 'blocked'
         THEN NOW() ELSE public.student_access_state.blocked_at END,
       unblocked_at = CASE
         WHEN EXCLUDED.access_status = 'granted' AND public.student_access_state.access_status = 'blocked'
         THEN NOW() ELSE public.student_access_state.unblocked_at END,
       last_calculated_at = NOW()
     RETURNING *`,
    [
      alunoId,
      aluno.coach_id,
      accessStatus,
      paymentStatus,
      inGracePeriod,
      graceDaysRemaining,
      accessStatus === 'blocked' ? new Date() : null,
      accessStatus === 'granted' ? new Date() : null,
    ],
  );

  const state = result.rows[0];

  if (prevRow?.access_status !== state.access_status) {
    await logFinancialAudit(pool, {
      coachId: aluno.coach_id,
      alunoId,
      entityType: 'access',
      action: state.access_status === 'blocked' ? 'access_blocked' : 'access_unblocked',
      beforeState: prevRow,
      afterState: state,
    });
  }

  if (notificationService) {
    try {
      const authUserId = await getAuthUserIdForAluno(pool, alunoId);
      if (authUserId) {
        notificationService.ws?.emitToUser(authUserId, 'payment_status_changed', {
          payment_status: paymentStatus,
          access_status: accessStatus,
          in_grace_period: inGracePeriod,
          grace_days_remaining: graceDaysRemaining,
        });
      }
    } catch (err) {
      logger.warn('financial.access.ws_notify_failed', { alunoId, error: err.message });
    }
  }

  return state;
}

module.exports = {
  getCoachFinancialPolicy,
  recalculateStudentAccess,
};
