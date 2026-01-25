// ============================================================================
// ROTAS: ALIMENTOS (/api/alimentos)
// ============================================================================
// Backend real para alimentos (VPS)
// ============================================================================

const express = require('express');
const { validateUUIDParam } = require('../utils/uuid-validator');
const validateRole = require('../middleware/validateRole');
const { adaptFood } = require('../adapters/foodAdapter');

module.exports = function createAlimentosRouter(pool, authenticate, domainSchemaGuard) {
    const router = express.Router();

    // GET /api/alimentos - Listar alimentos (coach e aluno)
    router.get('/', authenticate, domainSchemaGuard, validateRole(['coach', 'aluno']), async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT 
                    id,
                    nome,
                    origem_ptn,
                    tipo_id,
                    quantidade_referencia_g,
                    kcal_por_referencia,
                    ptn_por_referencia,
                    cho_por_referencia,
                    lip_por_referencia,
                    info_adicional,
                    autor,
                    created_at
                 FROM public.alimentos
                 ORDER BY nome ASC`
            );
            res.json(result.rows.map(adaptFood));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/alimentos/:id - Obter alimento por ID (coach e aluno)
    router.get('/:id', authenticate, domainSchemaGuard, validateRole(['coach', 'aluno']), validateUUIDParam('id'), async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT 
                    id,
                    nome,
                    origem_ptn,
                    tipo_id,
                    quantidade_referencia_g,
                    kcal_por_referencia,
                    ptn_por_referencia,
                    cho_por_referencia,
                    lip_por_referencia,
                    info_adicional,
                    autor,
                    created_at
                 FROM public.alimentos
                 WHERE id = $1`,
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Alimento não encontrado' });
            }

            res.json(adaptFood(result.rows[0]));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/alimentos - Criar alimento (coach)
    router.post('/', authenticate, domainSchemaGuard, validateRole(['coach']), async (req, res) => {
        try {
            const payload = req.body || {};
            const nome = payload.nome || payload.name;
            const origem_ptn = payload.origem_ptn || payload.origin || 'mista';
            const tipo_id = payload.tipo_id ?? null;
            const quantidade_referencia_g = payload.quantidade_referencia_g ?? payload.portion ?? 100;
            const kcal_por_referencia = payload.kcal_por_referencia ?? payload.calories ?? 0;
            const ptn_por_referencia = payload.ptn_por_referencia ?? payload.protein ?? 0;
            const cho_por_referencia = payload.cho_por_referencia ?? payload.carbs ?? 0;
            const lip_por_referencia = payload.lip_por_referencia ?? payload.fat ?? 0;
            const info_adicional = payload.info_adicional ?? null;
            const autor = payload.autor ?? null;

            if (!nome) {
                return res.status(400).json({ error: 'nome é obrigatório' });
            }

            const result = await pool.query(
                `INSERT INTO public.alimentos (
                    nome,
                    origem_ptn,
                    tipo_id,
                    quantidade_referencia_g,
                    kcal_por_referencia,
                    ptn_por_referencia,
                    cho_por_referencia,
                    lip_por_referencia,
                    info_adicional,
                    autor
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 RETURNING 
                    id,
                    nome,
                    origem_ptn,
                    tipo_id,
                    quantidade_referencia_g,
                    kcal_por_referencia,
                    ptn_por_referencia,
                    cho_por_referencia,
                    lip_por_referencia,
                    info_adicional,
                    autor,
                    created_at`,
                [
                    nome,
                    origem_ptn,
                    tipo_id || null,
                    quantidade_referencia_g ?? 100,
                    kcal_por_referencia ?? 0,
                    ptn_por_referencia ?? 0,
                    cho_por_referencia ?? 0,
                    lip_por_referencia ?? 0,
                    info_adicional || null,
                    autor || null
                ]
            );

            res.status(201).json(adaptFood(result.rows[0]));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // PATCH /api/alimentos/:id - Atualizar alimento (coach)
    router.patch('/:id', authenticate, domainSchemaGuard, validateRole(['coach']), validateUUIDParam('id'), async (req, res) => {
        try {
            const payload = req.body || {};
            const fieldMap = {
                nome: payload.nome ?? payload.name,
                origem_ptn: payload.origem_ptn ?? payload.origin,
                tipo_id: payload.tipo_id,
                quantidade_referencia_g: payload.quantidade_referencia_g ?? payload.portion,
                kcal_por_referencia: payload.kcal_por_referencia ?? payload.calories,
                ptn_por_referencia: payload.ptn_por_referencia ?? payload.protein,
                cho_por_referencia: payload.cho_por_referencia ?? payload.carbs,
                lip_por_referencia: payload.lip_por_referencia ?? payload.fat,
                info_adicional: payload.info_adicional,
                autor: payload.autor
            };
            const fields = Object.keys(fieldMap);
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;

            for (const field of fields) {
                if (fieldMap[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex}`);
                    queryParams.push(fieldMap[field]);
                    paramIndex++;
                }
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }

            queryParams.push(req.params.id);
            const result = await pool.query(
                `UPDATE public.alimentos
                 SET ${updateFields.join(', ')}
                 WHERE id = $${paramIndex}
                 RETURNING 
                    id,
                    nome,
                    origem_ptn,
                    tipo_id,
                    quantidade_referencia_g,
                    kcal_por_referencia,
                    ptn_por_referencia,
                    cho_por_referencia,
                    lip_por_referencia,
                    info_adicional,
                    autor,
                    created_at`,
                queryParams
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Alimento não encontrado' });
            }

            res.json(adaptFood(result.rows[0]));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /api/alimentos/:id - Remover alimento (coach)
    router.delete('/:id', authenticate, domainSchemaGuard, validateRole(['coach']), validateUUIDParam('id'), async (req, res) => {
        try {
            const result = await pool.query(
                'DELETE FROM public.alimentos WHERE id = $1 RETURNING id',
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Alimento não encontrado' });
            }

            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
