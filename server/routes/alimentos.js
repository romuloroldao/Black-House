// ============================================================================
// ROTAS: ALIMENTOS (/api/alimentos)
// ============================================================================
// Backend real para alimentos (VPS)
// ============================================================================

const express = require('express');
const { validateUUIDParam } = require('../utils/uuid-validator');
const validateRole = require('../middleware/validateRole');
const { adaptFood } = require('../adapters/foodAdapter');
const { normalizeOrigemPtn, auditAlimentosNutricao, kcalFromMacros, roundNutrient } = require('../utils/nutrition-alimento-utils');
const {
    listarSubstituicoesIsocaloricas,
    kcalPorPorcao,
    calcularQuantidadeEquivalente,
} = require('../utils/food-equivalence');

const FOOD_SELECT = `SELECT 
                    a.id,
                    a.nome,
                    a.origem_ptn,
                    a.tipo_id,
                    t.nome_tipo AS tipo_nome,
                    t.macro_predominante,
                    t.equiv_livre,
                    a.quantidade_referencia_g,
                    a.kcal_por_referencia,
                    a.ptn_por_referencia,
                    a.cho_por_referencia,
                    a.lip_por_referencia,
                    COALESCE(a.alcool_por_referencia, 0)::numeric AS alcool_por_referencia,
                    a.info_adicional,
                    a.autor,
                    a.created_at
                 FROM public.alimentos a
                 LEFT JOIN public.tipos_alimentos t ON t.id = a.tipo_id`;

module.exports = function createAlimentosRouter(pool, authenticate, domainSchemaGuard) {
    const router = express.Router();
    const foodReadRoles = ['coach', 'admin', 'aluno'];
    const foodWriteRoles = ['coach', 'admin'];

    function numOr(raw, fallback) {
        if (raw === undefined || raw === null || raw === '') {
            return fallback;
        }
        const n = Number(raw);
        return Number.isFinite(n) ? n : fallback;
    }

    // GET /api/alimentos - Listar alimentos (coach e aluno)
    router.get('/', authenticate, domainSchemaGuard, validateRole(foodReadRoles), async (req, res) => {
        try {
            const result = await pool.query(
                `${FOOD_SELECT} ORDER BY a.nome ASC`
            );
            res.json(result.rows.map(adaptFood));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/alimentos/nutrition-audit — auditoria kcal vs macros (coach); ANTES de /:id
    router.get(
        '/nutrition-audit',
        authenticate,
        domainSchemaGuard,
        validateRole(foodWriteRoles),
        async (req, res) => {
            try {
                const rawTol = req.query.tolerancePct;
                const tolerancePct =
                    rawTol !== undefined && rawTol !== '' && !Number.isNaN(Number(rawTol))
                        ? Number(rawTol)
                        : 12;
                const maxItems =
                    req.query.maxItems !== undefined && !Number.isNaN(Number(req.query.maxItems))
                        ? Math.min(2000, Math.max(1, Number(req.query.maxItems)))
                        : undefined;

                const result = await pool.query(
                    `SELECT id, nome,
                            kcal_por_referencia, ptn_por_referencia,
                            cho_por_referencia, lip_por_referencia,
                            COALESCE(alcool_por_referencia, 0)::numeric AS alcool_por_referencia
                     FROM public.alimentos`
                );
                const audit = auditAlimentosNutricao(result.rows, {
                    tolerancePct,
                    ...(maxItems !== undefined ? { maxItems } : {})
                });
                res.json(audit);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    // GET /api/alimentos/grupos-equivalencia — grupos para substituição (coach e aluno)
    router.get(
        '/grupos-equivalencia',
        authenticate,
        domainSchemaGuard,
        validateRole(foodReadRoles),
        async (req, res) => {
            try {
                const result = await pool.query(
                    `SELECT t.id, t.nome_tipo, t.macro_predominante, t.equiv_livre, t.ordem_exibicao,
                            COUNT(a.id)::int AS total_alimentos
                     FROM public.tipos_alimentos t
                     LEFT JOIN public.alimentos a ON a.tipo_id = t.id
                     GROUP BY t.id, t.nome_tipo, t.macro_predominante, t.equiv_livre, t.ordem_exibicao
                     ORDER BY t.ordem_exibicao ASC, t.nome_tipo ASC`
                );
                res.json(result.rows);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    // GET /api/alimentos/:id/substituicoes?quantidade=100&unidade=g&limit=50
    router.get(
        '/:id/substituicoes',
        authenticate,
        domainSchemaGuard,
        validateRole(foodReadRoles),
        validateUUIDParam('id'),
        async (req, res) => {
            try {
                const quantidade = Number(req.query.quantidade) || 100;
                const unidade = String(req.query.unidade || 'g').toLowerCase();
                const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

                const refRes = await pool.query(`${FOOD_SELECT} WHERE a.id = $1`, [req.params.id]);
                if (refRes.rows.length === 0) {
                    return res.status(404).json({ error: 'Alimento não encontrado' });
                }
                const foodRef = refRes.rows[0];

                if (Number(foodRef.kcal_por_referencia) <= 0 || foodRef.equiv_livre) {
                    return res.json({
                        referencia: adaptFood(foodRef),
                        kcalReferencia: 0,
                        substituicoes: [],
                        mensagem: 'Este alimento pertence a um grupo livre ou sem calorias — substituição isocalórica não se aplica.',
                    });
                }

                const grupoRes = await pool.query(
                    `${FOOD_SELECT} WHERE a.tipo_id = $1 AND a.id <> $2 ORDER BY a.nome ASC`,
                    [foodRef.tipo_id, req.params.id]
                );

                const substituicoes = listarSubstituicoesIsocaloricas(
                    foodRef,
                    quantidade,
                    unidade,
                    grupoRes.rows,
                    { limit }
                ).map((s) => ({
                    alimento: adaptFood(s.alimento),
                    quantidadeEquivalente: s.quantidadeEquivalente,
                    kcalReferencia: s.kcalReferencia,
                    kcalEquivalente: s.kcalEquivalente,
                    formula: s.formula,
                }));

                res.json({
                    referencia: adaptFood(foodRef),
                    quantidadeReferencia: quantidade,
                    unidadeReferencia: unidade,
                    kcalReferencia: Math.round(kcalPorPorcao(foodRef, quantidade, unidade) * 10) / 10,
                    substituicoes,
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    // GET /api/alimentos/:id - Obter alimento por ID (coach e aluno)
    router.get('/:id', authenticate, domainSchemaGuard, validateRole(foodReadRoles), validateUUIDParam('id'), async (req, res) => {
        try {
            const result = await pool.query(
                `${FOOD_SELECT} WHERE a.id = $1`,
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
    router.post('/', authenticate, domainSchemaGuard, validateRole(foodWriteRoles), async (req, res) => {
        try {
            const payload = req.body || {};
            const nome = payload.nome || payload.name;
            const origem_ptn = normalizeOrigemPtn(
                payload.origem_ptn ?? payload.origin ?? null
            );
            const tipo_id = payload.tipo_id ?? null;
            const quantidade_referencia_g = numOr(
                payload.quantidade_referencia_g ?? payload.portion,
                100
            );
            const ptn_por_referencia = roundNutrient(
                numOr(payload.ptn_por_referencia ?? payload.protein, 0),
                2
            );
            const cho_por_referencia = roundNutrient(
                numOr(payload.cho_por_referencia ?? payload.carbs, 0),
                2
            );
            const lip_por_referencia = roundNutrient(
                numOr(payload.lip_por_referencia ?? payload.fat, 0),
                2
            );
            const alcool_por_referencia = roundNutrient(
                numOr(payload.alcool_por_referencia ?? payload.alcohol, 0),
                2
            );
            const info_adicional = payload.info_adicional ?? null;
            const autor = payload.autor ?? null;

            if (!nome) {
                return res.status(400).json({ error: 'nome é obrigatório' });
            }

            if (
                ptn_por_referencia < 0 ||
                cho_por_referencia < 0 ||
                lip_por_referencia < 0 ||
                alcool_por_referencia < 0
            ) {
                return res.status(400).json({ error: 'Macros e álcool não podem ser negativos' });
            }

            const kcal_por_referencia = roundNutrient(
                kcalFromMacros(
                    ptn_por_referencia,
                    cho_por_referencia,
                    lip_por_referencia,
                    alcool_por_referencia
                ),
                1
            );

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
                    alcool_por_referencia,
                    info_adicional,
                    autor
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
                    alcool_por_referencia,
                    info_adicional,
                    autor,
                    created_at`,
                [
                    nome,
                    origem_ptn,
                    tipo_id || null,
                    quantidade_referencia_g ?? 100,
                    kcal_por_referencia,
                    ptn_por_referencia,
                    cho_por_referencia,
                    lip_por_referencia,
                    alcool_por_referencia,
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
    router.patch('/:id', authenticate, domainSchemaGuard, validateRole(foodWriteRoles), validateUUIDParam('id'), async (req, res) => {
        try {
            const payload = req.body || {};
            const patchKeys = [
                'nome',
                'name',
                'origem_ptn',
                'origin',
                'tipo_id',
                'quantidade_referencia_g',
                'portion',
                'ptn_por_referencia',
                'protein',
                'cho_por_referencia',
                'carbs',
                'lip_por_referencia',
                'fat',
                'alcool_por_referencia',
                'alcohol',
                'info_adicional',
                'autor'
            ];
            const hasPatch = patchKeys.some((k) => payload[k] !== undefined);
            if (!hasPatch) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }

            const cur = await pool.query(
                `SELECT nome, origem_ptn, tipo_id, quantidade_referencia_g,
                        kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia,
                        COALESCE(alcool_por_referencia, 0)::numeric AS alcool_por_referencia,
                        info_adicional, autor
                 FROM public.alimentos WHERE id = $1`,
                [req.params.id]
            );
            if (cur.rows.length === 0) {
                return res.status(404).json({ error: 'Alimento não encontrado' });
            }

            const m = { ...cur.rows[0] };

            if (payload.nome !== undefined || payload.name !== undefined) {
                const v = payload.nome ?? payload.name;
                if (v != null && String(v).trim() !== '') {
                    m.nome = String(v).trim();
                }
            }
            if (payload.origem_ptn !== undefined || payload.origin !== undefined) {
                m.origem_ptn = normalizeOrigemPtn(payload.origem_ptn ?? payload.origin);
            }
            if (payload.tipo_id !== undefined) {
                m.tipo_id = payload.tipo_id;
            }
            if (payload.quantidade_referencia_g !== undefined || payload.portion !== undefined) {
                m.quantidade_referencia_g = numOr(
                    payload.quantidade_referencia_g ?? payload.portion,
                    Number(m.quantidade_referencia_g) || 100
                );
            }
            if (payload.ptn_por_referencia !== undefined || payload.protein !== undefined) {
                m.ptn_por_referencia = roundNutrient(
                    numOr(payload.ptn_por_referencia ?? payload.protein, Number(m.ptn_por_referencia)),
                    2
                );
            }
            if (payload.cho_por_referencia !== undefined || payload.carbs !== undefined) {
                m.cho_por_referencia = roundNutrient(
                    numOr(payload.cho_por_referencia ?? payload.carbs, Number(m.cho_por_referencia)),
                    2
                );
            }
            if (payload.lip_por_referencia !== undefined || payload.fat !== undefined) {
                m.lip_por_referencia = roundNutrient(
                    numOr(payload.lip_por_referencia ?? payload.fat, Number(m.lip_por_referencia)),
                    2
                );
            }
            if (payload.alcool_por_referencia !== undefined || payload.alcohol !== undefined) {
                m.alcool_por_referencia = roundNutrient(
                    numOr(payload.alcool_por_referencia ?? payload.alcohol, Number(m.alcool_por_referencia)),
                    2
                );
            }
            if (payload.info_adicional !== undefined) {
                m.info_adicional = payload.info_adicional;
            }
            if (payload.autor !== undefined) {
                m.autor = payload.autor;
            }

            const ptn = Number(m.ptn_por_referencia);
            const cho = Number(m.cho_por_referencia);
            const lip = Number(m.lip_por_referencia);
            const alc = Number(m.alcool_por_referencia);

            if (ptn < 0 || cho < 0 || lip < 0 || alc < 0) {
                return res.status(400).json({ error: 'Macros e álcool não podem ser negativos' });
            }

            m.kcal_por_referencia = roundNutrient(kcalFromMacros(ptn, cho, lip, alc), 1);

            const result = await pool.query(
                `UPDATE public.alimentos
                 SET nome = $1,
                     origem_ptn = $2,
                     tipo_id = $3,
                     quantidade_referencia_g = $4,
                     kcal_por_referencia = $5,
                     ptn_por_referencia = $6,
                     cho_por_referencia = $7,
                     lip_por_referencia = $8,
                     alcool_por_referencia = $9,
                     info_adicional = $10,
                     autor = $11
                 WHERE id = $12
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
                    alcool_por_referencia,
                    info_adicional,
                    autor,
                    created_at`,
                [
                    m.nome,
                    m.origem_ptn,
                    m.tipo_id,
                    m.quantidade_referencia_g,
                    m.kcal_por_referencia,
                    m.ptn_por_referencia,
                    m.cho_por_referencia,
                    m.lip_por_referencia,
                    m.alcool_por_referencia,
                    m.info_adicional,
                    m.autor,
                    req.params.id
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Alimento não encontrado' });
            }

            const row = result.rows[0];
            const withTipo = await pool.query(`${FOOD_SELECT} WHERE a.id = $1`, [row.id]);

            res.json(adaptFood(withTipo.rows[0]));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /api/alimentos/:id - Remover alimento (coach)
    router.delete('/:id', authenticate, domainSchemaGuard, validateRole(foodWriteRoles), validateUUIDParam('id'), async (req, res) => {
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
