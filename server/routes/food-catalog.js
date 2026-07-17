/**
 * Rotas do Catálogo Inteligente de Alimentos — /api/food-catalog
 */

const express = require('express');
const { validateUUIDParam } = require('../utils/uuid-validator');
const validateRole = require('../middleware/validateRole');
const FoodCatalogRepository = require('../repositories/food-catalog.repository');
const FoodCatalogService = require('../services/food-catalog.service');

module.exports = function createFoodCatalogRouter(pool, authenticate, domainSchemaGuard) {
    const router = express.Router();
    const repository = new FoodCatalogRepository(pool);
    const service = new FoodCatalogService(repository);
    const readRoles = ['coach', 'admin'];
    const writeRoles = ['coach', 'admin'];

    function actorFromReq(req) {
        return {
            id: req.user?.id ?? null,
            role: req.user?.role ?? null,
        };
    }

    // GET /api/food-catalog/quality-report
    router.get(
        '/quality-report',
        authenticate,
        domainSchemaGuard,
        validateRole(readRoles),
        async (req, res) => {
            try {
                const report = await service.qualityReport();
                res.json(report);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },
    );

    // GET /api/food-catalog/tipos
    router.get(
        '/tipos',
        authenticate,
        domainSchemaGuard,
        validateRole(readRoles),
        async (req, res) => {
            try {
                const tipos = await service.listTipos();
                res.json(tipos);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },
    );

    // POST /api/food-catalog/check-duplicate
    router.post(
        '/check-duplicate',
        authenticate,
        domainSchemaGuard,
        validateRole(writeRoles),
        async (req, res) => {
            try {
                const nome = req.body?.nome ?? req.body?.name;
                const excludeId = req.body?.excludeId ?? req.body?.exclude_id ?? null;
                if (!nome || !String(nome).trim()) {
                    return res.status(400).json({ error: 'nome é obrigatório' });
                }
                const result = await service.checkDuplicate(String(nome), excludeId);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },
    );

    // GET /api/food-catalog/duplicates
    router.get(
        '/duplicates',
        authenticate,
        domainSchemaGuard,
        validateRole(readRoles),
        async (req, res) => {
            try {
                const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
                const groups = await service.listDuplicates(limit);
                res.json(groups);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },
    );

    // POST /api/food-catalog/:id/merge
    router.post(
        '/:id/merge',
        authenticate,
        domainSchemaGuard,
        validateRole(writeRoles),
        validateUUIDParam('id'),
        async (req, res) => {
            try {
                const sourceIds = req.body?.sourceIds ?? req.body?.source_ids ?? [];
                if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
                    return res.status(400).json({ error: 'sourceIds é obrigatório (array)' });
                }
                const result = await service.merge(req.params.id, sourceIds, actorFromReq(req));
                res.json(result);
            } catch (error) {
                const status = error.message.includes('não encontrado') ? 404 : 400;
                res.status(status).json({ error: error.message });
            }
        },
    );

    // GET /api/food-catalog — listagem paginada
    router.get('/', authenticate, domainSchemaGuard, validateRole(readRoles), async (req, res) => {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || Number(req.query.page_size) || 25));

            const result = await service.list({
                q: req.query.q,
                status: req.query.status,
                tipoId: req.query.tipo_id ?? req.query.categoria,
                scope: req.query.scope,
                flags: req.query.flags,
                sort: req.query.sort,
                order: req.query.order,
                page,
                pageSize,
            });
            res.json(result);
        } catch (error) {
            console.error('[food-catalog] GET / list failed:', {
                q: req.query.q,
                message: error.message,
            });
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/food-catalog — criar
    router.post('/', authenticate, domainSchemaGuard, validateRole(writeRoles), async (req, res) => {
        try {
            const result = await service.create(req.body, actorFromReq(req));
            res.status(201).json(result);
        } catch (error) {
            const status = error.message.includes('obrigat') ? 400 : 500;
            res.status(status).json({ error: error.message });
        }
    });

    // GET /api/food-catalog/:id
    router.get(
        '/:id',
        authenticate,
        domainSchemaGuard,
        validateRole(readRoles),
        validateUUIDParam('id'),
        async (req, res) => {
            try {
                const alimento = await service.getById(req.params.id);
                if (!alimento) return res.status(404).json({ error: 'Alimento não encontrado' });
                res.json(alimento);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },
    );

    // GET /api/food-catalog/:id/usage
    router.get(
        '/:id/usage',
        authenticate,
        domainSchemaGuard,
        validateRole(readRoles),
        validateUUIDParam('id'),
        async (req, res) => {
            try {
                const usage = await service.getUsage(req.params.id);
                res.json(usage);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },
    );

    // GET /api/food-catalog/:id/history
    router.get(
        '/:id/history',
        authenticate,
        domainSchemaGuard,
        validateRole(readRoles),
        validateUUIDParam('id'),
        async (req, res) => {
            try {
                const history = await service.getHistory(req.params.id, {
                    page: Number(req.query.page) || 1,
                    pageSize: Number(req.query.pageSize) || 50,
                });
                res.json(history);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },
    );

    // GET /api/food-catalog/:id/versions
    router.get(
        '/:id/versions',
        authenticate,
        domainSchemaGuard,
        validateRole(readRoles),
        validateUUIDParam('id'),
        async (req, res) => {
            try {
                const versions = await service.getVersions(req.params.id);
                res.json(versions);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },
    );

    // PATCH /api/food-catalog/:id
    router.patch(
        '/:id',
        authenticate,
        domainSchemaGuard,
        validateRole(writeRoles),
        validateUUIDParam('id'),
        async (req, res) => {
            try {
                const result = await service.update(req.params.id, req.body, actorFromReq(req));
                res.json(result);
            } catch (error) {
                const status =
                    error.message.includes('não encontrado') ? 404
                        : error.message.includes('obrigat') || error.message.includes('motivo') ? 400
                            : 500;
                res.status(status).json({ error: error.message });
            }
        },
    );

    return router;
};
