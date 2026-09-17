/**
 * Serviço partilhado: listagem de substitutos isocalóricos no mesmo grupo (tipo_id).
 * Usado por GET /api/alimentos/:id/substituicoes e refeicao-substituicao.service.
 */
const { adaptFood } = require('../adapters/foodAdapter');
const { normalizeFoodName } = require('../utils/food-normalize');
const {
    listarSubstituicoesIsocaloricas,
    kcalPorPorcao,
    calcularQuantidadeEquivalente,
    canSubstitute,
    sameEquivalenceGroup,
} = require('../utils/food-equivalence');

const FOOD_SELECT_BASE = `SELECT
  a.id, a.nome, a.origem_ptn, a.tipo_id,
  t.nome_tipo AS tipo_nome, t.macro_predominante, t.equiv_livre,
  a.quantidade_referencia_g, a.kcal_por_referencia,
  a.ptn_por_referencia, a.cho_por_referencia, a.lip_por_referencia,
  COALESCE(a.alcool_por_referencia, 0)::numeric AS alcool_por_referencia,
  a.nome_normalizado
FROM public.alimentos a
LEFT JOIN public.tipos_alimentos t ON t.id = a.tipo_id`;

const FOOD_SELECT_REF = `${FOOD_SELECT_BASE},
  a.info_adicional, a.autor, a.created_at`;

const MIN_SEARCH_CHARS = 2;
const DEFAULT_LIMIT = 20;

function notFoundError(message) {
    const err = new Error(message);
    err.statusCode = 404;
    return err;
}

async function getAlimentoRef(pool, alimentoId) {
    const r = await pool.query(`${FOOD_SELECT_REF} WHERE a.id = $1`, [alimentoId]);
    return r.rows[0] || null;
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ alimentoId: string, quantidade?: number, unidade?: string, limit?: number, q?: string, log?: (msg: string, meta?: object) => void }} opts
 */
async function listSubstituicoes(pool, opts) {
    const start = Date.now();
    const alimentoId = opts.alimentoId;
    const quantidade = Number(opts.quantidade) || 100;
    const unidade = String(opts.unidade || 'g').toLowerCase();
    const limit = Math.min(50, Math.max(1, Number(opts.limit) || DEFAULT_LIMIT));
    const searchTerm = String(opts.q || '').trim();
    const log = opts.log || (() => {});

    const foodRef = await getAlimentoRef(pool, alimentoId);
    if (!foodRef) throw notFoundError('Alimento não encontrado');

    if (Number(foodRef.kcal_por_referencia) <= 0 || foodRef.equiv_livre) {
        log('alimento-substituicoes: grupo livre ou sem kcal', {
            alimentoId,
            durationMs: Date.now() - start,
            count: 0,
        });
        return {
            referencia: adaptFood(foodRef),
            quantidadeReferencia: quantidade,
            unidadeReferencia: unidade,
            kcalReferencia: 0,
            substituicoes: [],
            mensagem:
                'Este alimento pertence a um grupo livre ou sem calorias — substituição isocalórica não se aplica.',
        };
    }

    if (searchTerm.length > 0 && searchTerm.length < MIN_SEARCH_CHARS) {
        return {
            referencia: adaptFood(foodRef),
            quantidadeReferencia: quantidade,
            unidadeReferencia: unidade,
            kcalReferencia: Math.round(kcalPorPorcao(foodRef, quantidade, unidade) * 10) / 10,
            substituicoes: [],
            mensagem: `Digite pelo menos ${MIN_SEARCH_CHARS} caracteres para buscar.`,
        };
    }

    let grupoSql = `${FOOD_SELECT_BASE}
     WHERE a.tipo_id = $1 AND a.id <> $2
       AND COALESCE(a.status, 'active') NOT IN ('deprecated', 'merged')`;
    const params = [foodRef.tipo_id, alimentoId];

    if (searchTerm.length >= MIN_SEARCH_CHARS) {
        const norm = normalizeFoodName(searchTerm);
        grupoSql += ` AND (
            a.nome ILIKE $3
            OR COALESCE(a.nome_normalizado, '') ILIKE $4
        )`;
        params.push(`%${searchTerm}%`, `%${norm}%`);
    }

    const grupoRes = await pool.query(grupoSql, params);

    const substituicoes = listarSubstituicoesIsocaloricas(
        foodRef,
        quantidade,
        unidade,
        grupoRes.rows,
        { limit, searchQuery: searchTerm || undefined },
    ).map((s) => ({
        alimento: adaptFood(s.alimento),
        quantidadeEquivalente: s.quantidadeEquivalente,
        kcalReferencia: s.kcalReferencia,
        kcalEquivalente: s.kcalEquivalente,
        formula: s.formula,
    }));

    log('alimento-substituicoes: ok', {
        alimentoId,
        q: searchTerm || null,
        candidatos: grupoRes.rows.length,
        count: substituicoes.length,
        durationMs: Date.now() - start,
    });

    return {
        referencia: adaptFood(foodRef),
        quantidadeReferencia: quantidade,
        unidadeReferencia: unidade,
        kcalReferencia: Math.round(kcalPorPorcao(foodRef, quantidade, unidade) * 10) / 10,
        substituicoes,
    };
}

/**
 * Calcula quantidade equivalente para um par ref/substituto (evita listar todo o grupo).
 */
async function calcularSubstituicaoDireta(pool, { alimentoRefId, alimentoSubId, quantidade, unidade }) {
    const foodRef = await getAlimentoRef(pool, alimentoRefId);
    if (!foodRef) throw notFoundError('Alimento de referência não encontrado');

    const subRes = await pool.query(`${FOOD_SELECT_BASE} WHERE a.id = $1`, [alimentoSubId]);
    const foodSub = subRes.rows[0];
    if (!foodSub) throw notFoundError('Alimento substituto não encontrado');

    if (!sameEquivalenceGroup(foodRef, foodSub) || !canSubstitute(foodRef) || !canSubstitute(foodSub)) {
        return null;
    }

    const q = Number(quantidade) || 100;
    const u = String(unidade || 'g').toLowerCase();
    const qtd = calcularQuantidadeEquivalente(foodRef, q, u, foodSub);
    if (qtd == null || !Number.isFinite(qtd) || qtd <= 0) return null;

    return {
        quantidadeEquivalente: Math.round(qtd * 10) / 10,
        unidade: u === 'un' ? 'un' : 'g',
        kcalEquivalente: Math.round(kcalPorPorcao(foodSub, qtd, 'g') * 10) / 10,
    };
}

module.exports = {
    MIN_SEARCH_CHARS,
    DEFAULT_LIMIT,
    FOOD_SELECT_BASE,
    listSubstituicoes,
    calcularSubstituicaoDireta,
    getAlimentoRef,
};
