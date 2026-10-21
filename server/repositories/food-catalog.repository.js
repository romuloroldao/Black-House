/**
 * Food Catalog Repository — acesso PostgreSQL ao catálogo de alimentos.
 */

const { normalizeFoodName } = require('../utils/food-normalize');

const FOOD_SELECT = `
  SELECT
    a.id,
    a.nome,
    a.nome_normalizado,
    a.origem_ptn,
    a.tipo_id,
    t.nome_tipo AS tipo_nome,
    t.macro_predominante,
    t.equiv_livre,
    a.quantidade_referencia_g,
    a.unidade_referencia,
    a.kcal_por_referencia,
    a.ptn_por_referencia,
    a.cho_por_referencia,
    a.lip_por_referencia,
    COALESCE(a.alcool_por_referencia, 0)::numeric AS alcool_por_referencia,
    COALESCE(a.fibra_por_referencia, 0)::numeric AS fibra_por_referencia,
    COALESCE(a.acucar_por_referencia, 0)::numeric AS acucar_por_referencia,
    COALESCE(a.sodio_por_referencia_mg, 0)::numeric AS sodio_por_referencia_mg,
    a.info_adicional,
    a.autor,
    a.created_at,
    a.updated_at,
    a.status,
    a.scope,
    a.coach_id,
    a.versao_actual,
    a.merged_into_id,
    a.qualidade_score,
    a.flags_qualidade
  FROM public.alimentos a
  LEFT JOIN public.tipos_alimentos t ON t.id = a.tipo_id
`;

class FoodCatalogRepository {
    constructor(pool) {
        this.pool = pool;
        this.query = pool.query.bind(pool);
    }

    async list({
        q,
        status,
        tipoId,
        scope,
        flags,
        sort = 'nome',
        order = 'asc',
        page = 1,
        pageSize = 25,
    }) {
        const conditions = ['1=1'];
        const params = [];
        let paramIdx = 1;

        if (status) {
            conditions.push(`a.status = $${paramIdx++}`);
            params.push(status);
        } else {
            conditions.push(`COALESCE(a.status, 'active') IN ('active', 'draft')`);
        }

        if (tipoId) {
            conditions.push(`a.tipo_id = $${paramIdx++}`);
            params.push(tipoId);
        }

        if (scope) {
            conditions.push(`a.scope = $${paramIdx++}`);
            params.push(scope);
        }

        if (q && String(q).trim()) {
            const term = String(q).trim();
            const norm = normalizeFoodName(term);
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) {
                conditions.push(`a.id = $${paramIdx++}::uuid`);
                params.push(term);
            } else {
                conditions.push(`(
                    a.nome ILIKE $${paramIdx}
                    OR COALESCE(a.nome_normalizado, '') ILIKE $${paramIdx + 1}
                    OR COALESCE(t.nome_tipo, '') ILIKE $${paramIdx}
                )`);
                params.push(`%${term}%`, `%${norm}%`);
                paramIdx += 2;
            }
        }

        if (flags) {
            const flagList = String(flags).split(',').map((f) => f.trim()).filter(Boolean);
            if (flagList.length > 0) {
                conditions.push(`a.flags_qualidade ?| $${paramIdx++}`);
                params.push(flagList);
            }
        }

        const sortMap = {
            nome: 'a.nome',
            kcal: 'a.kcal_por_referencia',
            updated_at: 'a.updated_at',
            qualidade_score: 'a.qualidade_score',
            created_at: 'a.created_at',
        };
        const sortCol = sortMap[sort] || sortMap.nome;
        const sortDir = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

        const where = conditions.join(' AND ');
        const countRes = await this.query(
            `SELECT COUNT(*)::int AS total
             FROM public.alimentos a
             LEFT JOIN public.tipos_alimentos t ON t.id = a.tipo_id
             WHERE ${where}`,
            params,
        );
        const total = countRes.rows[0]?.total ?? 0;

        const offset = (Math.max(1, page) - 1) * pageSize;
        const listParams = [...params, pageSize, offset];

        const result = await this.query(
            `${FOOD_SELECT}
             WHERE ${where}
             ORDER BY ${sortCol} ${sortDir} NULLS LAST
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            listParams,
        );

        return {
            items: result.rows,
            pagination: {
                page: Math.max(1, page),
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize) || 1,
            },
        };
    }

    async findById(id) {
        const result = await this.query(`${FOOD_SELECT} WHERE a.id = $1`, [id]);
        return result.rows[0] || null;
    }

    async findByNormalizedName(nomeNormalizado, coachId = null) {
        const result = await this.query(
            `SELECT id, nome, status FROM public.alimentos
             WHERE nome_normalizado = $1
               AND COALESCE(coach_id, '00000000-0000-0000-0000-000000000000'::uuid)
                 = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
               AND status IN ('active', 'draft')
             LIMIT 1`,
            [nomeNormalizado, coachId],
        );
        return result.rows[0] || null;
    }

    async findSimilar(nomeNormalizado, limit = 5, excludeId = null) {
        const pattern = `%${nomeNormalizado}%`;
        const params = [pattern, limit];
        let excludeSql = '';
        if (excludeId) {
            excludeSql = ' AND a.id <> $3';
            params.push(excludeId);
        }
        const result = await this.query(
            `${FOOD_SELECT}
             WHERE COALESCE(a.status, 'active') IN ('active', 'draft')
               AND (
                 COALESCE(a.nome_normalizado, '') ILIKE $1
                 OR a.nome ILIKE $1
               )
               ${excludeSql}
             ORDER BY a.nome ASC
             LIMIT $2`,
            params,
        );
        return result.rows.map((row) => ({
            ...row,
            similarity_score: null,
        }));
    }

    async getUsage(alimentoId) {
        const result = await this.query(
            `SELECT
                COUNT(DISTINCT i.dieta_id)::int AS dietas,
                COUNT(i.id)::int AS itens,
                COUNT(DISTINCT d.aluno_id)::int AS alunos
             FROM public.itens_dieta i
             JOIN public.dietas d ON d.id = i.dieta_id
             WHERE i.alimento_id = $1`,
            [alimentoId],
        );
        return result.rows[0] || { dietas: 0, itens: 0, alunos: 0 };
    }

    async listHistory(alimentoId, { page = 1, pageSize = 50 } = {}) {
        const offset = (Math.max(1, page) - 1) * pageSize;
        const countRes = await this.query(
            `SELECT COUNT(*)::int AS total FROM public.alimento_audit_log WHERE alimento_id = $1`,
            [alimentoId],
        );
        const result = await this.query(
            `SELECT * FROM public.alimento_audit_log
             WHERE alimento_id = $1
             ORDER BY criado_em DESC
             LIMIT $2 OFFSET $3`,
            [alimentoId, pageSize, offset],
        );
        return {
            items: result.rows,
            pagination: {
                page,
                pageSize,
                total: countRes.rows[0]?.total ?? 0,
            },
        };
    }

    async listVersions(alimentoId) {
        const result = await this.query(
            `SELECT * FROM public.alimento_versoes
             WHERE alimento_id = $1
             ORDER BY versao DESC`,
            [alimentoId],
        );
        return result.rows;
    }

    async insertAlimento(data, client = null) {
        const q = client ? client.query.bind(client) : this.query;
        const result = await q(
            `INSERT INTO public.alimentos (
                nome, nome_normalizado, origem_ptn, tipo_id,
                quantidade_referencia_g, unidade_referencia,
                kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia,
                alcool_por_referencia, fibra_por_referencia, acucar_por_referencia, sodio_por_referencia_mg,
                info_adicional, autor, status, scope, coach_id, versao_actual,
                qualidade_score, flags_qualidade, updated_at
             ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,1,$20,$21,now()
             )
             RETURNING *`,
            [
                data.nome,
                data.nome_normalizado,
                data.origem_ptn,
                data.tipo_id,
                data.quantidade_referencia_g,
                data.unidade_referencia,
                data.kcal_por_referencia,
                data.ptn_por_referencia,
                data.cho_por_referencia,
                data.lip_por_referencia,
                data.alcool_por_referencia,
                data.fibra_por_referencia,
                data.acucar_por_referencia,
                data.sodio_por_referencia_mg,
                data.info_adicional,
                data.autor,
                data.status || 'active',
                data.scope || 'platform',
                data.coach_id || null,
                data.qualidade_score,
                JSON.stringify(data.flags_qualidade || []),
            ],
        );
        return result.rows[0];
    }

    async insertVersion(data, client = null) {
        const q = client ? client.query.bind(client) : this.query;
        const result = await q(
            `INSERT INTO public.alimento_versoes (
                alimento_id, versao, nome, tipo_id, unidade_referencia, quantidade_referencia,
                kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia,
                alcool_por_referencia, fibra_por_referencia, acucar_por_referencia, sodio_por_referencia_mg,
                origem_ptn, info_adicional, motivo_alteracao, criado_por
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING *`,
            [
                data.alimento_id,
                data.versao,
                data.nome,
                data.tipo_id,
                data.unidade_referencia,
                data.quantidade_referencia,
                data.kcal_por_referencia,
                data.ptn_por_referencia,
                data.cho_por_referencia,
                data.lip_por_referencia,
                data.alcool_por_referencia,
                data.fibra_por_referencia,
                data.acucar_por_referencia,
                data.sodio_por_referencia_mg,
                data.origem_ptn,
                data.info_adicional,
                data.motivo_alteracao,
                data.criado_por,
            ],
        );
        return result.rows[0];
    }

    async updateAlimento(id, data, client = null) {
        const q = client ? client.query.bind(client) : this.query;
        const result = await q(
            `UPDATE public.alimentos SET
                nome = $1,
                nome_normalizado = $2,
                origem_ptn = $3,
                tipo_id = $4,
                quantidade_referencia_g = $5,
                unidade_referencia = $6,
                kcal_por_referencia = $7,
                ptn_por_referencia = $8,
                cho_por_referencia = $9,
                lip_por_referencia = $10,
                alcool_por_referencia = $11,
                fibra_por_referencia = $12,
                acucar_por_referencia = $13,
                sodio_por_referencia_mg = $14,
                info_adicional = $15,
                versao_actual = $16,
                qualidade_score = $17,
                flags_qualidade = $18,
                updated_at = now()
             WHERE id = $19
             RETURNING *`,
            [
                data.nome,
                data.nome_normalizado,
                data.origem_ptn,
                data.tipo_id,
                data.quantidade_referencia_g,
                data.unidade_referencia,
                data.kcal_por_referencia,
                data.ptn_por_referencia,
                data.cho_por_referencia,
                data.lip_por_referencia,
                data.alcool_por_referencia,
                data.fibra_por_referencia,
                data.acucar_por_referencia,
                data.sodio_por_referencia_mg,
                data.info_adicional,
                data.versao_actual,
                data.qualidade_score,
                JSON.stringify(data.flags_qualidade || []),
                id,
            ],
        );
        return result.rows[0];
    }

    async insertAuditLog(entry, client = null) {
        const q = client ? client.query.bind(client) : this.query;
        await q(
            `INSERT INTO public.alimento_audit_log (
                alimento_id, versao_de, versao_para, actor_id, actor_role,
                acao, campo, valor_anterior, valor_novo, metadata
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
                entry.alimento_id,
                entry.versao_de ?? null,
                entry.versao_para ?? null,
                entry.actor_id ?? null,
                entry.actor_role ?? null,
                entry.acao,
                entry.campo ?? null,
                entry.valor_anterior != null ? JSON.stringify(entry.valor_anterior) : null,
                entry.valor_novo != null ? JSON.stringify(entry.valor_novo) : null,
                JSON.stringify(entry.metadata || {}),
            ],
        );
    }

    async propagateSnapshotsToActiveDiets(alimentoId, versaoId, snapshot, client = null) {
        const q = client ? client.query.bind(client) : this.query;
        const result = await q(
            `UPDATE public.itens_dieta i
             SET
               alimento_versao_id = $2,
               alimento_nome_snapshot = $3,
               nutrientes_snapshot = $4::jsonb
             FROM public.dietas d
             WHERE i.dieta_id = d.id
               AND i.alimento_id = $1
               AND d.ativa = true`,
            [alimentoId, versaoId, snapshot.nome, JSON.stringify(snapshot)],
        );
        return result.rowCount;
    }

    async qualityReport() {
        const result = await this.query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
                COUNT(*) FILTER (WHERE flags_qualidade @> '["kcal_divergente"]'::jsonb)::int AS kcal_divergente,
                COUNT(*) FILTER (WHERE flags_qualidade @> '["sem_categoria"]'::jsonb)::int AS sem_categoria,
                COUNT(*) FILTER (WHERE qualidade_score < 60)::int AS baixa_qualidade
             FROM public.alimentos
             WHERE status IN ('active', 'draft')`,
        );
        return result.rows[0];
    }

    async listTipos() {
        const result = await this.query(
            `SELECT id, nome_tipo, macro_predominante, ordem_exibicao
             FROM public.tipos_alimentos
             ORDER BY ordem_exibicao ASC, nome_tipo ASC`,
        );
        return result.rows;
    }

    async listDuplicateGroups(limit = 50) {
        const result = await this.query(
            `SELECT
                a.nome_normalizado,
                COUNT(*)::int AS total,
                json_agg(
                    json_build_object(
                        'id', a.id,
                        'nome', a.nome,
                        'kcal_por_referencia', a.kcal_por_referencia,
                        'status', a.status,
                        'updated_at', a.updated_at
                    )
                    ORDER BY a.updated_at DESC
                ) AS alimentos
             FROM public.alimentos a
             WHERE a.status IN ('active', 'draft')
               AND a.nome_normalizado IS NOT NULL
               AND a.nome_normalizado <> ''
             GROUP BY a.nome_normalizado
             HAVING COUNT(*) > 1
             ORDER BY COUNT(*) DESC
             LIMIT $1`,
            [limit],
        );
        return result.rows;
    }

    async mergeAlimentos(targetId, sourceIds, actor, client = null) {
        const q = client ? client.query.bind(client) : this.query;
        const uniqueSources = [...new Set(sourceIds)].filter((id) => id && id !== targetId);
        if (uniqueSources.length === 0) {
            return { itensAtualizados: 0, sourcesMerged: 0 };
        }

        let itensAtualizados = 0;

        for (const sourceId of uniqueSources) {
            const sourceRow = await q(
                `SELECT id, nome, nome_normalizado, versao_actual FROM public.alimentos WHERE id = $1`,
                [sourceId],
            );
            if (sourceRow.rows.length === 0) continue;

            const upd = await q(
                `UPDATE public.itens_dieta SET alimento_id = $1 WHERE alimento_id = $2`,
                [targetId, sourceId],
            );
            itensAtualizados += upd.rowCount || 0;

            const src = sourceRow.rows[0];
            if (src.nome_normalizado) {
                await q(
                    `INSERT INTO public.alimento_aliases (alimento_id, alias_normalizado, fonte)
                     VALUES ($1, $2, 'merge')
                     ON CONFLICT (alias_normalizado, alimento_id) DO NOTHING`,
                    [targetId, src.nome_normalizado],
                );
            }

            await q(
                `UPDATE public.alimentos
                 SET status = 'merged',
                     merged_into_id = $1,
                     updated_at = now()
                 WHERE id = $2`,
                [targetId, sourceId],
            );

            await this.insertAuditLog(
                {
                    alimento_id: targetId,
                    versao_de: null,
                    versao_para: null,
                    actor_id: actor?.id,
                    actor_role: actor?.role,
                    acao: 'merge',
                    campo: 'merged_from',
                    valor_anterior: null,
                    valor_novo: { source_id: sourceId, source_nome: src.nome },
                    metadata: { target_id: targetId },
                },
                client,
            );
        }

        return { itensAtualizados, sourcesMerged: uniqueSources.length };
    }
}

module.exports = FoodCatalogRepository;
