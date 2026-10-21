/**
 * Food Catalog Service — regras de negócio do catálogo de alimentos.
 */

const {
    normalizeOrigemPtn,
    kcalFromMacros,
    roundNutrient,
} = require('../utils/nutrition-alimento-utils');
const { normalizeFoodName } = require('../utils/food-normalize');
const { evaluateFoodQuality } = require('../utils/food-quality-rules');
const { adaptFood } = require('../adapters/foodAdapter');

const TRACKED_FIELDS = [
    ['nome', 'nome'],
    ['tipo_id', 'tipo_id'],
    ['quantidade_referencia_g', 'quantidade_referencia_g'],
    ['unidade_referencia', 'unidade_referencia'],
    ['ptn_por_referencia', 'ptn_por_referencia'],
    ['cho_por_referencia', 'cho_por_referencia'],
    ['lip_por_referencia', 'lip_por_referencia'],
    ['alcool_por_referencia', 'alcool_por_referencia'],
    ['fibra_por_referencia', 'fibra_por_referencia'],
    ['acucar_por_referencia', 'acucar_por_referencia'],
    ['sodio_por_referencia_mg', 'sodio_por_referencia_mg'],
    ['origem_ptn', 'origem_ptn'],
    ['info_adicional', 'info_adicional'],
];

function numOr(raw, fallback) {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

function buildSnapshotFromRow(row, versao) {
    return {
        nome: row.nome,
        quantidade_referencia: Number(row.quantidade_referencia_g) || 100,
        unidade_referencia: row.unidade_referencia || 'g',
        kcal: Number(row.kcal_por_referencia) || 0,
        ptn: Number(row.ptn_por_referencia) || 0,
        cho: Number(row.cho_por_referencia) || 0,
        lip: Number(row.lip_por_referencia) || 0,
        alcool: Number(row.alcool_por_referencia) || 0,
        fibra: Number(row.fibra_por_referencia) || 0,
        acucar: Number(row.acucar_por_referencia) || 0,
        sodio_mg: Number(row.sodio_por_referencia_mg) || 0,
        versao: versao ?? row.versao_actual ?? 1,
    };
}

function normalizePayload(payload) {
    const nome = String(payload.nome ?? payload.name ?? '').trim();
    const ptn = roundNutrient(numOr(payload.ptn_por_referencia ?? payload.protein ?? payload.ptn, 0), 2);
    const cho = roundNutrient(numOr(payload.cho_por_referencia ?? payload.carbs ?? payload.cho, 0), 2);
    const lip = roundNutrient(numOr(payload.lip_por_referencia ?? payload.fat ?? payload.lip, 0), 2);
    const alc = roundNutrient(numOr(payload.alcool_por_referencia ?? payload.alcohol ?? payload.alcool, 0), 2);

    if (ptn < 0 || cho < 0 || lip < 0 || alc < 0) {
        throw new Error('Macros e álcool não podem ser negativos');
    }

    const quantidade = numOr(payload.quantidade_referencia_g ?? payload.portion ?? payload.quantidadeReferencia, 100);
    if (quantidade <= 0 || quantidade > 10000) {
        throw new Error('Porção de referência inválida');
    }

    const unidade = String(payload.unidade_referencia ?? payload.unidade ?? 'g').toLowerCase();
    if (!['g', 'ml', 'un'].includes(unidade)) {
        throw new Error('Unidade de referência inválida');
    }

    return {
        nome,
        nome_normalizado: normalizeFoodName(nome),
        tipo_id: payload.tipo_id ?? payload.tipoId ?? null,
        origem_ptn: normalizeOrigemPtn(payload.origem_ptn ?? payload.origemPtn ?? null),
        quantidade_referencia_g: quantidade,
        unidade_referencia: unidade,
        ptn_por_referencia: ptn,
        cho_por_referencia: cho,
        lip_por_referencia: lip,
        alcool_por_referencia: alc,
        fibra_por_referencia: roundNutrient(numOr(payload.fibra_por_referencia ?? payload.fibra, 0), 2),
        acucar_por_referencia: roundNutrient(numOr(payload.acucar_por_referencia ?? payload.acucar, 0), 2),
        sodio_por_referencia_mg: roundNutrient(numOr(payload.sodio_por_referencia_mg ?? payload.sodioMg ?? payload.sodio, 0), 2),
        info_adicional: payload.info_adicional ?? payload.infoAdicional ?? null,
        kcal_por_referencia: roundNutrient(kcalFromMacros(ptn, cho, lip, alc), 1),
        motivo_alteracao: payload.motivo_alteracao ?? payload.motivoAlteracao ?? null,
        propagar_dietas_activas: Boolean(payload.propagar_dietas_activas ?? payload.propagarDietasActivas),
    };
}

class FoodCatalogService {
    constructor(repository) {
        this.repository = repository;
    }

    async list(query) {
        const result = await this.repository.list(query);
        return {
            items: result.items.map(adaptFood),
            pagination: result.pagination,
        };
    }

    async getById(id) {
        const row = await this.repository.findById(id);
        if (!row) return null;
        return adaptFood(row);
    }

    async getUsage(id) {
        return this.repository.getUsage(id);
    }

    async getHistory(id, query) {
        return this.repository.listHistory(id, query);
    }

    async getVersions(id) {
        return this.repository.listVersions(id);
    }

    async qualityReport() {
        return this.repository.qualityReport();
    }

    async listTipos() {
        return this.repository.listTipos();
    }

    async checkDuplicate(nome, excludeId = null) {
        const norm = normalizeFoodName(nome);
        if (!norm) return { exact: false, candidates: [] };

        const exact = await this.repository.findByNormalizedName(norm);
        const candidates = await this.repository.findSimilar(norm, 8, excludeId);

        return {
            exact: Boolean(exact && exact.id !== excludeId),
            exactMatch: exact && exact.id !== excludeId ? adaptFood(exact) : null,
            candidates: candidates
                .filter((c) => c.id !== excludeId)
                .map((c) => adaptFood(c)),
        };
    }

    async create(payload, actor) {
        const data = normalizePayload(payload);
        if (!data.nome) throw new Error('Nome é obrigatório');
        if (!data.tipo_id) throw new Error('Categoria (tipo_id) é obrigatória');

        const dup = await this.repository.findByNormalizedName(data.nome_normalizado);
        if (dup) {
            throw new Error(`Já existe um alimento com nome similar: "${dup.nome}"`);
        }

        const quality = evaluateFoodQuality(data);

        const client = await this.repository.pool.connect();
        try {
            await client.query('BEGIN');

            const alimento = await this.repository.insertAlimento(
                {
                    ...data,
                    autor: actor?.id ?? null,
                    qualidade_score: quality.score,
                    flags_qualidade: quality.flags,
                },
                client,
            );

            await this.repository.insertVersion(
                {
                    alimento_id: alimento.id,
                    versao: 1,
                    nome: data.nome,
                    tipo_id: data.tipo_id,
                    unidade_referencia: data.unidade_referencia,
                    quantidade_referencia: data.quantidade_referencia_g,
                    kcal_por_referencia: data.kcal_por_referencia,
                    ptn_por_referencia: data.ptn_por_referencia,
                    cho_por_referencia: data.cho_por_referencia,
                    lip_por_referencia: data.lip_por_referencia,
                    alcool_por_referencia: data.alcool_por_referencia,
                    fibra_por_referencia: data.fibra_por_referencia,
                    acucar_por_referencia: data.acucar_por_referencia,
                    sodio_por_referencia_mg: data.sodio_por_referencia_mg,
                    origem_ptn: data.origem_ptn,
                    info_adicional: data.info_adicional,
                    motivo_alteracao: data.motivo_alteracao || 'Criação',
                    criado_por: actor?.id ?? null,
                },
                client,
            );

            await this.repository.insertAuditLog(
                {
                    alimento_id: alimento.id,
                    versao_de: null,
                    versao_para: 1,
                    actor_id: actor?.id,
                    actor_role: actor?.role,
                    acao: 'create',
                    campo: null,
                    valor_anterior: null,
                    valor_novo: buildSnapshotFromRow(alimento, 1),
                },
                client,
            );

            await client.query('COMMIT');

            const full = await this.repository.findById(alimento.id);
            return { alimento: adaptFood(full), versao: 1, changes: [], impacto: null, propagado: false };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async update(id, payload, actor) {
        const current = await this.repository.findById(id);
        if (!current) throw new Error('Alimento não encontrado');

        const data = normalizePayload({ ...current, ...payload });
        if (!data.nome) throw new Error('Nome é obrigatório');
        if (!data.tipo_id) throw new Error('Categoria (tipo_id) é obrigatória');

        const dup = await this.repository.findByNormalizedName(data.nome_normalizado);
        if (dup && dup.id !== id) {
            throw new Error(`Já existe outro alimento com nome similar: "${dup.nome}"`);
        }

        const changes = [];
        for (const [field] of TRACKED_FIELDS) {
            const before = current[field];
            const after = data[field];
            const changed =
                field.includes('_referencia') || field === 'quantidade_referencia_g'
                    ? Number(before) !== Number(after)
                    : String(before ?? '') !== String(after ?? '');
            if (changed) {
                changes.push({ campo: field, de: before, para: after });
            }
        }

        const nutrientChange = changes.some((c) =>
            ['ptn_por_referencia', 'cho_por_referencia', 'lip_por_referencia', 'alcool_por_referencia', 'quantidade_referencia_g'].includes(c.campo),
        );

        if (nutrientChange && !data.motivo_alteracao) {
            throw new Error('Informe o motivo da alteração nutricional');
        }

        const quality = evaluateFoodQuality({ ...current, ...data });
        const newVersion = Number(current.versao_actual || 1) + 1;
        const impacto = await this.repository.getUsage(id);

        const client = await this.repository.pool.connect();
        try {
            await client.query('BEGIN');

            const updated = await this.repository.updateAlimento(
                id,
                {
                    ...data,
                    versao_actual: newVersion,
                    qualidade_score: quality.score,
                    flags_qualidade: quality.flags,
                },
                client,
            );

            const versionRow = await this.repository.insertVersion(
                {
                    alimento_id: id,
                    versao: newVersion,
                    nome: data.nome,
                    tipo_id: data.tipo_id,
                    unidade_referencia: data.unidade_referencia,
                    quantidade_referencia: data.quantidade_referencia_g,
                    kcal_por_referencia: data.kcal_por_referencia,
                    ptn_por_referencia: data.ptn_por_referencia,
                    cho_por_referencia: data.cho_por_referencia,
                    lip_por_referencia: data.lip_por_referencia,
                    alcool_por_referencia: data.alcool_por_referencia,
                    fibra_por_referencia: data.fibra_por_referencia,
                    acucar_por_referencia: data.acucar_por_referencia,
                    sodio_por_referencia_mg: data.sodio_por_referencia_mg,
                    origem_ptn: data.origem_ptn,
                    info_adicional: data.info_adicional,
                    motivo_alteracao: data.motivo_alteracao || 'Atualização',
                    criado_por: actor?.id ?? null,
                },
                client,
            );

            for (const change of changes) {
                await this.repository.insertAuditLog(
                    {
                        alimento_id: id,
                        versao_de: current.versao_actual,
                        versao_para: newVersion,
                        actor_id: actor?.id,
                        actor_role: actor?.role,
                        acao: 'update',
                        campo: change.campo,
                        valor_anterior: change.de,
                        valor_novo: change.para,
                        metadata: { motivo: data.motivo_alteracao },
                    },
                    client,
                );
            }

            let propagado = 0;
            if (data.propagar_dietas_activas) {
                const snapshot = buildSnapshotFromRow(updated, newVersion);
                propagado = await this.repository.propagateSnapshotsToActiveDiets(
                    id,
                    versionRow.id,
                    snapshot,
                    client,
                );
            }

            await client.query('COMMIT');

            const full = await this.repository.findById(id);
            return {
                alimento: adaptFood(full),
                versao: newVersion,
                changes,
                impacto,
                propagado: propagado > 0,
                itensPropagados: propagado,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async listDuplicates(limit = 50) {
        return this.repository.listDuplicateGroups(limit);
    }

    async merge(targetId, sourceIds, actor) {
        const target = await this.repository.findById(targetId);
        if (!target) throw new Error('Alimento alvo não encontrado');
        if (target.status === 'merged') {
            throw new Error('Não é possível mesclar para um alimento já fundido');
        }

        const client = await this.repository.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await this.repository.mergeAlimentos(targetId, sourceIds, actor, client);
            await client.query('COMMIT');
            return {
                targetId,
                ...result,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}

module.exports = FoodCatalogService;
