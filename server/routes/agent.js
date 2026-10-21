/**
 * Rotas Agent Foundation — portal aluno
 * /api/agent/*
 */

const express = require('express');
const validateRole = require('../middleware/validateRole');
const { agentIntentLimiter } = require('../middleware/rate-limiter');
const agent = require('../services/agent');
const agentRepo = require('../repositories/agent.repository');

function sendError(res, error, fallback = 'Erro no agente') {
  const status = error.statusCode || 500;
  return res.status(status).json({
    error: error.message || fallback,
    error_code: error.code || 'AGENT_ERROR',
  });
}

module.exports = function createAgentRouter(pool, authenticate, domainSchemaGuard, resolveAlunoOrFailWithPayment) {
  const router = express.Router();

  // POST /api/agent/sessions
  router.post(
    '/sessions',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const channel = req.body?.channel === 'api' ? 'api' : 'student_hoje';
        const session = await agent.getOrCreateSession(pool, {
          aluno: req.aluno,
          userId: req.user.id,
          channel,
        });
        return res.status(201).json(session);
      } catch (error) {
        console.error('POST /api/agent/sessions', error);
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/sessions/current
  router.get(
    '/sessions/current',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const session = await agent.getOrCreateSession(pool, {
          aluno: req.aluno,
          userId: req.user.id,
          channel: 'student_hoje',
        });
        return res.json(session);
      } catch (error) {
        console.error('GET /api/agent/sessions/current', error);
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/sessions/:id/messages
  router.get(
    '/sessions/:id/messages',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const session = await agentRepo.getSessionById(pool, req.params.id);
        if (!session || session.aluno_id !== req.aluno.id) {
          return res.status(404).json({ error: 'Sessão não encontrada', error_code: 'NOT_FOUND' });
        }
        const messages = await agentRepo.listMessages(pool, session.id, {
          limit: req.query.limit,
        });
        return res.json({ session_id: session.id, messages });
      } catch (error) {
        console.error('GET /api/agent/sessions/:id/messages', error);
        return sendError(res, error);
      }
    },
  );

  // POST /api/agent/sessions/:id/messages
  router.post(
    '/sessions/:id/messages',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    agentIntentLimiter,
    async (req, res) => {
      try {
        const session = await agentRepo.getSessionById(pool, req.params.id);
        if (!session || session.aluno_id !== req.aluno.id || session.status !== 'open') {
          return res.status(404).json({ error: 'Sessão não encontrada', error_code: 'NOT_FOUND' });
        }

        const content = String(req.body?.content || req.body?.message || '').trim();
        if (!content) {
          return res.status(400).json({
            error: 'content é obrigatório',
            error_code: 'VALIDATION_ERROR',
          });
        }

        let mealKeys = null;
        if (Array.isArray(req.body?.meal_keys)) {
          mealKeys = req.body.meal_keys.map(String);
        }

        const result = await agent.handleStudentMessage(pool, {
          session,
          aluno: req.aluno,
          userId: req.user.id,
          paymentStatus: req.user.payment_status,
          intentRaw: content,
          autonomyMax: 2,
          mealKeys,
        });

        return res.json(result);
      } catch (error) {
        console.error('POST /api/agent/sessions/:id/messages', error);
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/runs/:id
  router.get(
    '/runs/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const run = await agentRepo.getRunById(pool, req.params.id);
        if (!run || run.aluno_id !== req.aluno.id) {
          return res.status(404).json({ error: 'Run não encontrado', error_code: 'NOT_FOUND' });
        }
        const tools = await pool.query(
          `SELECT id, tool_name, autonomy_level, args, result, ok, error_message, latency_ms, created_at
           FROM public.agent_tool_calls WHERE run_id = $1 ORDER BY created_at ASC`,
          [run.id],
        );
        return res.json({ run, tool_calls: tools.rows });
      } catch (error) {
        console.error('GET /api/agent/runs/:id', error);
        return sendError(res, error);
      }
    },
  );

  // POST /api/agent/approvals/:id/decide
  router.post(
    '/approvals/:id/decide',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const approval = await agentRepo.getApprovalById(pool, req.params.id);
        if (!approval) {
          return res.status(404).json({ error: 'Approval não encontrado', error_code: 'NOT_FOUND' });
        }
        const session = await agentRepo.getSessionById(pool, approval.session_id);
        if (!session || session.aluno_id !== req.aluno.id) {
          return res.status(403).json({ error: 'Forbidden', error_code: 'FORBIDDEN' });
        }
        const decision = String(req.body?.status || '').toLowerCase();
        if (!['approved', 'rejected'].includes(decision)) {
          return res.status(400).json({
            error: 'status deve ser approved ou rejected',
            error_code: 'VALIDATION_ERROR',
          });
        }
        const updated = await agentRepo.decideApproval(pool, approval.id, {
          status: decision,
          decidedBy: req.user.id,
        });
        if (!updated) {
          return res.status(409).json({
            error: 'Approval já decidido',
            error_code: 'ALREADY_DECIDED',
          });
        }
        // Envio real de mensagem fica para Phase 2/3 com HITL completo
        return res.json({
          approval: updated,
          note:
            decision === 'approved'
              ? 'Aprovado. Envio ao chat do coach será ligado na Phase 2.'
              : 'Descartado.',
        });
      } catch (error) {
        console.error('POST /api/agent/approvals/:id/decide', error);
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/tools — catálogo (debug / client)
  router.get(
    '/tools',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (_req, res) => {
      return res.json({ tools: agent.listToolsForPrompt() });
    },
  );

  return router;
};
