/**
 * Rotas de execução diária (aluno) — Phase 1a
 * /api/alunos/me/refeicao-conclusoes
 * /api/alunos/me/treino-sessoes
 * /api/alunos/me/treino-cargas
 * /api/alunos/me/proxima-acao
 */

const express = require('express');
const validateRole = require('../middleware/validateRole');
const refeicaoService = require('../services/refeicao-conclusao.service');
const treinoService = require('../services/treino-sessao.service');
const { getProximaAcao } = require('../services/proxima-acao.service');

function sendServiceError(res, error, fallback = 'Erro interno') {
  const status = error.statusCode || 500;
  return res.status(status).json({
    error: error.message || fallback,
    error_code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
  });
}

module.exports = function createExecucaoDiariaRouter(pool, authenticate, domainSchemaGuard, resolveAlunoOrFailWithPayment) {
  const router = express.Router();

  // GET /api/alunos/me/refeicao-conclusoes
  router.get(
    '/refeicao-conclusoes',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const rows = await refeicaoService.listForAluno(pool, req.aluno.id, {
          date: req.query.date ? String(req.query.date).slice(0, 10) : undefined,
        });
        return res.json({
          data_ref: req.query.date ? String(req.query.date).slice(0, 10) : refeicaoService.todayIso(),
          items: rows,
          gerado_em: new Date().toISOString(),
        });
      } catch (error) {
        console.error('GET refeicao-conclusoes', error);
        return sendServiceError(res, error);
      }
    },
  );

  // PUT /api/alunos/me/refeicao-conclusoes
  router.put(
    '/refeicao-conclusoes',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const row = await refeicaoService.upsertForAluno(pool, req.aluno.id, req.aluno, req.body || {});
        return res.json(row);
      } catch (error) {
        console.error('PUT refeicao-conclusoes', error);
        return sendServiceError(res, error);
      }
    },
  );

  // GET /api/alunos/me/treino-sessoes
  router.get(
    '/treino-sessoes',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const payload = await treinoService.getDayPayload(pool, req.aluno.id, {
          date: req.query.date ? String(req.query.date).slice(0, 10) : undefined,
          treinoId: req.query.treino_id || undefined,
        });
        return res.json(payload);
      } catch (error) {
        console.error('GET treino-sessoes', error);
        return sendServiceError(res, error);
      }
    },
  );

  // POST /api/alunos/me/treino-sessoes
  router.post(
    '/treino-sessoes',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const sessao = await treinoService.startOrGetSession(pool, req.aluno.id, req.body || {});
        return res.status(201).json(sessao);
      } catch (error) {
        console.error('POST treino-sessoes', error);
        return sendServiceError(res, error);
      }
    },
  );

  // PATCH /api/alunos/me/treino-sessoes/:id
  router.patch(
    '/treino-sessoes/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const updated = await treinoService.patchSession(
          pool,
          req.aluno.id,
          req.aluno,
          req.params.id,
          req.body || {},
        );
        return res.json(updated);
      } catch (error) {
        console.error('PATCH treino-sessoes', error);
        return sendServiceError(res, error);
      }
    },
  );

  // PUT /api/alunos/me/treino-sessoes/:id/series
  router.put(
    '/treino-sessoes/:id/series',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const serie = await treinoService.upsertSerieLog(
          pool,
          req.aluno.id,
          req.params.id,
          req.body || {},
        );
        return res.json(serie);
      } catch (error) {
        console.error('PUT treino-sessoes series', error);
        return sendServiceError(res, error);
      }
    },
  );

  // GET /api/alunos/me/treino-cargas?treino_id=
  router.get(
    '/treino-cargas',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const sessions = await treinoService.listCargas(pool, req.aluno.id, req.query.treino_id);
        return res.json({ sessions, gerado_em: new Date().toISOString() });
      } catch (error) {
        console.error('GET treino-cargas', error);
        return sendServiceError(res, error);
      }
    },
  );

  // GET /api/alunos/me/proxima-acao
  router.get(
    '/proxima-acao',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        let mealKeys = null;
        if (req.query.meal_keys) {
          mealKeys = String(req.query.meal_keys)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
        const acao = await getProximaAcao(pool, {
          aluno: req.aluno,
          userId: req.user.id,
          mealKeys,
        });
        return res.json(acao);
      } catch (error) {
        console.error('GET proxima-acao', error);
        return sendServiceError(res, error);
      }
    },
  );

  const substService = require('../services/refeicao-substituicao.service');

  // GET /api/alunos/me/refeicao-substituicoes
  router.get(
    '/refeicao-substituicoes',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const items = await substService.listForAluno(pool, req.aluno.id, {
          date: req.query.date ? String(req.query.date).slice(0, 10) : undefined,
          dietaId: req.query.dieta_id || undefined,
        });
        return res.json({
          data_ref: req.query.date
            ? String(req.query.date).slice(0, 10)
            : substService.todayIso(),
          items,
          gerado_em: new Date().toISOString(),
        });
      } catch (error) {
        console.error('GET refeicao-substituicoes', error);
        return sendServiceError(res, error);
      }
    },
  );

  // PUT /api/alunos/me/refeicao-substituicoes — aplicar override do dia
  router.put(
    '/refeicao-substituicoes',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const row = await substService.applyForAluno(pool, req.aluno.id, req.body || {});
        return res.json(row);
      } catch (error) {
        console.error('PUT refeicao-substituicoes', error);
        return sendServiceError(res, error);
      }
    },
  );

  // DELETE /api/alunos/me/refeicao-substituicoes — repor item original do plano
  router.delete(
    '/refeicao-substituicoes',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFailWithPayment,
    async (req, res) => {
      try {
        const body = {
          ...(req.body || {}),
          item_dieta_id: req.body?.item_dieta_id || req.query.item_dieta_id,
          plano: req.body?.plano || req.query.plano,
          data_ref: req.body?.data_ref || req.query.date || req.query.data_ref,
        };
        const result = await substService.clearForAluno(pool, req.aluno.id, body);
        return res.json(result);
      } catch (error) {
        console.error('DELETE refeicao-substituicoes', error);
        return sendServiceError(res, error);
      }
    },
  );

  return router;
};
