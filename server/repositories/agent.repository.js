/**
 * Persistência das tabelas agent_*
 */

async function createSession(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.agent_sessions (
       aluno_id, coach_id, user_id, channel, metadata
     ) VALUES ($1, $2, $3, COALESCE($4, 'student_hoje'), COALESCE($5::jsonb, '{}'::jsonb))
     RETURNING *`,
    [
      row.aluno_id,
      row.coach_id || null,
      row.user_id,
      row.channel || 'student_hoje',
      row.metadata != null ? JSON.stringify(row.metadata) : '{}',
    ],
  );
  return r.rows[0];
}

async function getOpenSession(pool, { userId, alunoId, channel = 'student_hoje' }) {
  const r = await pool.query(
    `SELECT * FROM public.agent_sessions
     WHERE user_id = $1 AND aluno_id = $2 AND channel = $3 AND status = 'open'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, alunoId, channel],
  );
  return r.rows[0] || null;
}

async function getSessionById(pool, sessionId) {
  const r = await pool.query(
    `SELECT * FROM public.agent_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );
  return r.rows[0] || null;
}

async function touchSession(pool, sessionId) {
  await pool.query(
    `UPDATE public.agent_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );
}

async function insertMessage(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.agent_messages (session_id, role, content, payload, run_id)
     VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb), $5)
     RETURNING *`,
    [
      row.session_id,
      row.role,
      row.content ?? null,
      row.payload != null ? JSON.stringify(row.payload) : '{}',
      row.run_id || null,
    ],
  );
  return r.rows[0];
}

async function listMessages(pool, sessionId, { limit = 50 } = {}) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 50));
  const r = await pool.query(
    `SELECT * FROM public.agent_messages
     WHERE session_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [sessionId, lim],
  );
  return r.rows;
}

async function createRun(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.agent_runs (
       session_id, aluno_id, intent_raw, autonomy_max, context_snapshot
     ) VALUES ($1, $2, $3, COALESCE($4, 2), COALESCE($5::jsonb, '{}'::jsonb))
     RETURNING *`,
    [
      row.session_id,
      row.aluno_id,
      row.intent_raw || null,
      row.autonomy_max ?? 2,
      row.context_snapshot != null ? JSON.stringify(row.context_snapshot) : '{}',
    ],
  );
  return r.rows[0];
}

async function finishRun(pool, runId, patch) {
  const r = await pool.query(
    `UPDATE public.agent_runs SET
       status = COALESCE($2, status),
       intent_classified = COALESCE($3, intent_classified),
       provider = COALESCE($4, provider),
       model = COALESCE($5, model),
       tokens_in = COALESCE($6, tokens_in),
       tokens_out = COALESCE($7, tokens_out),
       cost_estimate_usd = COALESCE($8, cost_estimate_usd),
       latency_ms = COALESCE($9, latency_ms),
       error_code = COALESCE($10, error_code),
       error_message = COALESCE($11, error_message),
       finished_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      runId,
      patch.status || null,
      patch.intent_classified || null,
      patch.provider || null,
      patch.model || null,
      patch.tokens_in ?? null,
      patch.tokens_out ?? null,
      patch.cost_estimate_usd ?? null,
      patch.latency_ms ?? null,
      patch.error_code || null,
      patch.error_message || null,
    ],
  );
  return r.rows[0];
}

async function getRunById(pool, runId) {
  const r = await pool.query(
    `SELECT * FROM public.agent_runs WHERE id = $1 LIMIT 1`,
    [runId],
  );
  return r.rows[0] || null;
}

async function insertToolCall(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.agent_tool_calls (
       run_id, tool_name, autonomy_level, args, result, ok, error_message, latency_ms
     ) VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb), $5::jsonb, $6, $7, $8)
     RETURNING *`,
    [
      row.run_id,
      row.tool_name,
      row.autonomy_level,
      row.args != null ? JSON.stringify(row.args) : '{}',
      row.result != null ? JSON.stringify(row.result) : null,
      row.ok === true,
      row.error_message || null,
      row.latency_ms ?? null,
    ],
  );
  return r.rows[0];
}

async function insertDecision(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.agent_decisions (run_id, kind, reason, payload)
     VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb))
     RETURNING *`,
    [
      row.run_id,
      row.kind,
      row.reason || null,
      row.payload != null ? JSON.stringify(row.payload) : '{}',
    ],
  );
  return r.rows[0];
}

async function createApproval(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.agent_approvals (run_id, session_id, action_type, payload)
     VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb))
     RETURNING *`,
    [
      row.run_id || null,
      row.session_id,
      row.action_type,
      row.payload != null ? JSON.stringify(row.payload) : '{}',
    ],
  );
  return r.rows[0];
}

async function getApprovalById(pool, id) {
  const r = await pool.query(
    `SELECT * FROM public.agent_approvals WHERE id = $1 LIMIT 1`,
    [id],
  );
  return r.rows[0] || null;
}

async function decideApproval(pool, id, { status, decidedBy }) {
  const r = await pool.query(
    `UPDATE public.agent_approvals
     SET status = $2, decided_by = $3, decided_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, status, decidedBy || null],
  );
  return r.rows[0] || null;
}

module.exports = {
  createSession,
  getOpenSession,
  getSessionById,
  touchSession,
  insertMessage,
  listMessages,
  createRun,
  finishRun,
  getRunById,
  insertToolCall,
  insertDecision,
  createApproval,
  getApprovalById,
  decideApproval,
};
