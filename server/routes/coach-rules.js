/**
 * Rotas Coach Knowledge — Phase 6
 * /api/coach/rules
 */

const express = require('express');
const validateRole = require('../middleware/validateRole');
const coachRules = require('../services/coach-rules.service');

function sendError(res, error, fallback = 'Erro nas regras do coach') {
  const status = error.statusCode || 500;
  return res.status(status).json({
    error: error.message || fallback,
    error_code: error.code || 'COACH_RULES_ERROR',
  });
}

module.exports = function createCoachRulesRouter(pool, authenticate, domainSchemaGuard, resolveCoachOrFail) {
  const router = express.Router();

  router.get(
    '/',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const includeInactive = String(req.query.include_inactive || '') === '1';
        const coachId = req.coach_id || req.coach?.user_id || req.coach?.id || req.user.id;
        const items = await coachRules.listForCoach(pool, coachId, {
          includeInactive,
        });
        return res.json({ items, gerado_em: new Date().toISOString() });
      } catch (error) {
        console.error('GET /api/coach/rules', error);
        return sendError(res, error);
      }
    },
  );

  router.post(
    '/',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const coachId = req.coach_id || req.coach?.user_id || req.coach?.id || req.user.id;
        const row = await coachRules.createForCoach(pool, coachId, req.body || {});
        return res.status(201).json(row);
      } catch (error) {
        console.error('POST /api/coach/rules', error);
        return sendError(res, error);
      }
    },
  );

  router.patch(
    '/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const coachId = req.coach_id || req.coach?.user_id || req.coach?.id || req.user.id;
        const row = await coachRules.updateForCoach(pool, coachId, req.params.id, req.body || {});
        return res.json(row);
      } catch (error) {
        console.error('PATCH /api/coach/rules/:id', error);
        return sendError(res, error);
      }
    },
  );

  router.delete(
    '/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const coachId = req.coach_id || req.coach?.user_id || req.coach?.id || req.user.id;
        const result = await coachRules.deleteForCoach(pool, coachId, req.params.id);
        return res.json(result);
      } catch (error) {
        console.error('DELETE /api/coach/rules/:id', error);
        return sendError(res, error);
      }
    },
  );

  return router;
};
