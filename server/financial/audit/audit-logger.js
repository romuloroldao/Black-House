const crypto = require('crypto');
const logger = require('../../utils/logger');

async function logFinancialAudit(pool, {
  coachId = null,
  alunoId = null,
  entityType = null,
  entityId = null,
  action,
  actorType = 'system',
  actorId = null,
  beforeState = null,
  afterState = null,
  metadata = null,
}) {
  try {
    await pool.query(
      `INSERT INTO public.financial_audit_log
        (coach_id, aluno_id, entity_type, entity_id, action, actor_type, actor_id,
         before_state, after_state, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        coachId,
        alunoId,
        entityType,
        entityId,
        action,
        actorType,
        actorId,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
  } catch (err) {
    logger.error('financial.audit.log_failed', { action, error: err.message });
  }
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

module.exports = {
  logFinancialAudit,
  hashPayload,
};
