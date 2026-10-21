/**
 * Utilitários de nutrição para alimentos (origem_ptn canónica + auditoria de coerência calórica).
 */

const ORIGEM_PTN_ALLOWED = new Set(['Vegetal', 'Animal', 'Mista', 'N/A']);

/**
 * Normaliza origem_ptn para um dos valores aceites pelo CHECK em public.alimentos.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
function normalizeOrigemPtn(raw) {
    if (raw === null || raw === undefined || raw === '') {
        return 'Mista';
    }
    const s = String(raw)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const aliases = {
        vegetal: 'Vegetal',
        vegetais: 'Vegetal',
        veg: 'Vegetal',
        plant: 'Vegetal',
        animal: 'Animal',
        mista: 'Mista',
        misto: 'Mista',
        mixed: 'Mista',
        mix: 'Mista',
        na: 'N/A',
        'n/a': 'N/A',
        nada: 'N/A',
        indefinido: 'N/A',
        desconhecido: 'N/A',
        '-': 'Mista'
    };

    if (aliases[s] !== undefined) {
        return aliases[s];
    }

    const t = String(raw).trim();
    if (ORIGEM_PTN_ALLOWED.has(t)) {
        return t;
    }

    const titled =
        t.length > 0
            ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
            : 'Mista';
    if (ORIGEM_PTN_ALLOWED.has(titled)) {
        return titled;
    }
    if (t.toUpperCase() === 'N/A' || t === 'N/A') {
        return 'N/A';
    }

    return 'Mista';
}

/**
 * Energia (kcal) a partir de macros: proteína/carboidrato 4 kcal/g, lipídio 9 kcal/g, álcool 7 kcal/g.
 */
function kcalFromMacros(ptn, cho, lip, alcoolG = 0) {
    const p = Number(ptn) || 0;
    const c = Number(cho) || 0;
    const l = Number(lip) || 0;
    const a = Number(alcoolG) || 0;
    return p * 4 + c * 4 + l * 9 + a * 7;
}

/** Arredonda nutriente para persistência (kcal/macros). */
function roundNutrient(n, decimals = 1) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    const m = 10 ** decimals;
    return Math.round(x * m) / m;
}

/**
 * Avalia coerência entre kcal declarada e macros.
 * @param {Object} row - linha com kcal_por_referencia, ptn, cho, lip (ou nomes *_por_referencia)
 * @param {Object} [opts]
 * @param {number} [opts.tolerancePct] - tolerância em % (default 12)
 * @returns {{ ok: boolean, skip?: boolean, reason?: string, kcal_declared: number, kcal_from_macros: number, diff_pct: number }}
 */
function auditMacroCalorieCoherence(row, opts = {}) {
    const tolerancePct = opts.tolerancePct ?? 12;

    const kcal = Number(row.kcal_por_referencia);
    const ptn = Number(row.ptn_por_referencia);
    const cho = Number(row.cho_por_referencia);
    const lip = Number(row.lip_por_referencia);
    const alc =
        row.alcool_por_referencia !== undefined && row.alcool_por_referencia !== null
            ? Number(row.alcool_por_referencia)
            : 0;

    if ([kcal, ptn, cho, lip, alc].some((v) => Number.isNaN(v))) {
        return {
            ok: false,
            reason: 'valor_numerico_invalido',
            kcal_declared: kcal,
            kcal_from_macros: kcalFromMacros(ptn, cho, lip, alc),
            diff_pct: 100
        };
    }

    if (kcal < 0 || ptn < 0 || cho < 0 || lip < 0 || alc < 0) {
        return {
            ok: false,
            reason: 'negativo',
            kcal_declared: kcal,
            kcal_from_macros: kcalFromMacros(ptn, cho, lip, alc),
            diff_pct: 100
        };
    }

    const expected = kcalFromMacros(ptn, cho, lip, alc);
    if (expected <= 0 && kcal <= 0) {
        return {
            ok: true,
            skip: true,
            kcal_declared: kcal,
            kcal_from_macros: expected,
            diff_pct: 0
        };
    }

    const denom = Math.max(Math.abs(expected), Math.abs(kcal), 1);
    const diffPct = (Math.abs(kcal - expected) / denom) * 100;

    return {
        ok: diffPct <= tolerancePct,
        kcal_declared: Math.round(kcal * 1000) / 1000,
        kcal_from_macros: Math.round(expected * 1000) / 1000,
        diff_pct: Math.round(diffPct * 10) / 10
    };
}

/**
 * Lista alimentos com incoerência calórica ou valores negativos.
 * @param {Object[]} rows
 * @param {Object} [opts]
 * @returns {{ summary: { total: number, skipped: number, suspicious: number }, items: Object[] }}
 */
function auditAlimentosNutricao(rows, opts = {}) {
    const maxItems = opts.maxItems ?? 500;
    const suspicious = [];

    let skipped = 0;
    for (const row of rows) {
        const r = auditMacroCalorieCoherence(row, opts);
        if (r.skip) {
            skipped++;
            continue;
        }
        if (!r.ok) {
            suspicious.push({
                id: row.id,
                nome: row.nome,
                reason: r.reason || 'incoerencia_calorica',
                kcal_declared: r.kcal_declared,
                kcal_from_macros: r.kcal_from_macros,
                diff_pct: r.diff_pct
            });
        }
    }

    return {
        summary: {
            total: rows.length,
            skipped,
            suspicious: suspicious.length
        },
        items: suspicious.slice(0, maxItems)
    };
}

module.exports = {
    normalizeOrigemPtn,
    kcalFromMacros,
    roundNutrient,
    auditMacroCalorieCoherence,
    auditAlimentosNutricao,
    ORIGEM_PTN_ALLOWED
};
