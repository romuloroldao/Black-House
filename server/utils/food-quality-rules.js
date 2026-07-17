/**
 * Regras de qualidade nutricional do catálogo de alimentos.
 */

const { kcalFromMacros } = require('./nutrition-alimento-utils');

const KCAL_TOLERANCE_PCT = 12;
const MACRO_SUM_MAX_G = 105;

/**
 * @param {object} food
 * @returns {{ flags: string[], score: number }}
 */
function evaluateFoodQuality(food) {
    const flags = [];
    const nome = String(food.nome || food.name || '').trim();
    const ptn = Number(food.ptn_por_referencia ?? food.protein) || 0;
    const cho = Number(food.cho_por_referencia ?? food.carbs) || 0;
    const lip = Number(food.lip_por_referencia ?? food.fat) || 0;
    const alc = Number(food.alcool_por_referencia ?? food.alcohol) || 0;
    const kcal = Number(food.kcal_por_referencia ?? food.calories) || 0;
    const ref = Number(food.quantidade_referencia_g ?? food.portion) || 100;
    const tipoId = food.tipo_id;

    if (!nome || nome.length < 2) flags.push('nome_invalido');
    if (!tipoId) flags.push('sem_categoria');

    const kcalCalc = kcalFromMacros(ptn, cho, lip, alc);
    if (kcal > 0 && kcalCalc > 0) {
        const diffPct = (Math.abs(kcal - kcalCalc) / kcalCalc) * 100;
        if (diffPct > KCAL_TOLERANCE_PCT) flags.push('kcal_divergente');
    }

    if (ptn + cho + lip > MACRO_SUM_MAX_G) flags.push('macro_sum_exceeds');

    if (kcal > 0 && kcal < 5 && lip < 80) flags.push('kcal_outlier_low');
    if (kcal > 900 && lip < 80) flags.push('kcal_outlier_high');

    if (ptn < 0 || cho < 0 || lip < 0 || alc < 0) flags.push('macro_negativo');
    if (ref <= 0 || ref > 10000) flags.push('porcao_invalida');

    let score = 0;
    if (nome.length >= 2) score += 20;
    if (tipoId) score += 20;
    if (!flags.includes('kcal_divergente') && !flags.includes('macro_negativo')) score += 20;
    if (Number(food.fibra_por_referencia) > 0 || Number(food.sodio_por_referencia_mg) > 0) score += 15;
    if (flags.length === 0) score += 15;
    if (food.info_adicional && String(food.info_adicional).trim()) score += 10;

    return { flags, score: Math.min(100, score) };
}

module.exports = {
    evaluateFoodQuality,
    KCAL_TOLERANCE_PCT,
};
