/**
 * Categorias pessoais de alimentos do profissional — /api/food-categories
 * Leitura: coach, admin, assistente e aluno (vê as categorias do seu coach).
 * Escrita: coach, admin e assistente com permissão de escrita na equipa.
 */

const express = require('express');
const { validateUUIDParam } = require('../utils/uuid-validator');
const validateRole = require('../middleware/validateRole');
const svc = require('../services/coach-food-categories.service');

module.exports = function createFoodCategoriesRouter(pool, authenticate, domainSchemaGuard) {
  const router = express.Router();
  const readRoles = ['coach', 'admin', 'assistant', 'aluno'];
  const writeRoles = ['coach', 'admin', 'assistant'];

  async function attachOwner(req, res, next) {
    try {
      const requested = typeof req.query.coach_id === 'string' ? req.query.coach_id : null;
      req.categoryOwner = await svc.resolveCategoryOwner(pool, req.user, requested);
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  function requireWrite(req, res, next) {
    if (!req.categoryOwner?.ownerId || !req.categoryOwner.canWrite) {
      return res.status(403).json({ error: 'Sem permissão para alterar categorias', error_code: 'FORBIDDEN' });
    }
    next();
  }

  function sendError(res, error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, error_code: error.code_ || 'FOOD_CATEGORIES_ERROR' });
  }

  router.get('/', authenticate, domainSchemaGuard, validateRole(readRoles), attachOwner, async (req, res) => {
    try {
      const { ownerId, canWrite } = req.categoryOwner;
      if (!ownerId) return res.json({ categories: [], can_edit: false });
      const categories = await svc.listCategories(pool, ownerId);
      res.json({ categories, can_edit: canWrite });
    } catch (error) {
      // Migração 20261109_coach_food_categories ainda não aplicada: a lista completa continua a funcionar sem categorias.
      if (error.code === '42P01') return res.json({ categories: [], can_edit: false, unavailable: true });
      sendError(res, error);
    }
  });

  router.post(
    '/',
    authenticate,
    domainSchemaGuard,
    validateRole(writeRoles),
    attachOwner,
    requireWrite,
    async (req, res) => {
      try {
        const category = await svc.createCategory(pool, req.categoryOwner.ownerId, req.body || {});
        res.status(201).json(category);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  // DELETE /api/food-categories/items — tira alimentos de qualquer categoria (body: { alimento_ids })
  router.delete(
    '/items',
    authenticate,
    domainSchemaGuard,
    validateRole(writeRoles),
    attachOwner,
    requireWrite,
    async (req, res) => {
      try {
        const out = await svc.unassignFoods(pool, req.categoryOwner.ownerId, req.body?.alimento_ids);
        res.json(out);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  router.patch(
    '/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(writeRoles),
    validateUUIDParam('id'),
    attachOwner,
    requireWrite,
    async (req, res) => {
      try {
        const category = await svc.updateCategory(pool, req.categoryOwner.ownerId, req.params.id, req.body || {});
        res.json(category);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  router.delete(
    '/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(writeRoles),
    validateUUIDParam('id'),
    attachOwner,
    requireWrite,
    async (req, res) => {
      try {
        const out = await svc.deleteCategory(pool, req.categoryOwner.ownerId, req.params.id);
        res.json(out);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  // PUT /api/food-categories/:id/items — coloca/move alimentos (body: { alimento_ids })
  router.put(
    '/:id/items',
    authenticate,
    domainSchemaGuard,
    validateRole(writeRoles),
    validateUUIDParam('id'),
    attachOwner,
    requireWrite,
    async (req, res) => {
      try {
        const out = await svc.assignFoods(pool, req.categoryOwner.ownerId, req.params.id, req.body?.alimento_ids);
        res.json(out);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  return router;
};
