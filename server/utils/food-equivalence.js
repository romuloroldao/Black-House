/**
 * Equivalência alimentar isocalórica (documento logicaTabela).
 * Q_sub = (Q_ref × Kcal_ref) / Kcal_sub  (base por quantidade_referencia_g)
 */

function macroScaleFactor(quantidade, unidade, portion) {
    const q = Number(quantidade) || 0;
    const p = Number(portion) > 0 ? Number(portion) : 100;
    const u = String(unidade || 'g').toLowerCase();
    if (u === 'un') return q;
    return q / p;
}

function kcalPorPorcao(food, quantidade, unidade) {
    const portion = Number(food.quantidade_referencia_g ?? food.portion) || 100;
    const kcalRef = Number(food.kcal_por_referencia ?? food.calories) || 0;
    return kcalRef * macroScaleFactor(quantidade, unidade, portion);
}

/**
 * Gramas (ou unidades) equivalentes do substituto mantendo as mesmas kcal.
 */
function calcularQuantidadeEquivalente(foodRef, quantidadeRef, unidadeRef, foodSub) {
    const kcalTotal = kcalPorPorcao(foodRef, quantidadeRef, unidadeRef);
    const portionSub = Number(foodSub.quantidade_referencia_g ?? foodSub.portion) || 100;
    const kcalSub = Number(foodSub.kcal_por_referencia ?? foodSub.calories) || 0;
    if (kcalTotal <= 0 || kcalSub <= 0) return null;
    return (kcalTotal / kcalSub) * portionSub;
}

function sameEquivalenceGroup(foodA, foodB) {
    if (!foodA?.tipo_id || !foodB?.tipo_id) return false;
    return String(foodA.tipo_id) === String(foodB.tipo_id);
}

function canSubstitute(food) {
    if (!food?.tipo_id) return false;
    if (food.equiv_livre === true) return false;
    const kcal = Number(food.kcal_por_referencia ?? food.calories) || 0;
    if (kcal <= 0) return false;
    return true;
}

/**
 * @param {object} foodRef alimento de referência (com tipo_id, kcal, portion)
 * @param {number} quantidadeRef
 * @param {string} unidadeRef
 * @param {object[]} candidatos outros alimentos (mesmo grupo)
 * @param {{ limit?: number }} opts
 */
function listarSubstituicoesIsocaloricas(foodRef, quantidadeRef, unidadeRef, candidatos, opts = {}) {
    const limit = opts.limit ?? 100;
    const kcalRef = kcalPorPorcao(foodRef, quantidadeRef, unidadeRef);
    if (kcalRef <= 0 || !canSubstitute(foodRef)) return [];

    const out = [];
    for (const sub of candidatos) {
        if (!sub || String(sub.id) === String(foodRef.id)) continue;
        if (!sameEquivalenceGroup(foodRef, sub)) continue;
        if (!canSubstitute(sub)) continue;

        const qtd = calcularQuantidadeEquivalente(foodRef, quantidadeRef, unidadeRef, sub);
        if (qtd == null || !Number.isFinite(qtd) || qtd <= 0) continue;

        const kcalSub = kcalPorPorcao(sub, qtd, 'g');
        out.push({
            alimento: sub,
            quantidadeEquivalente: Math.round(qtd * 10) / 10,
            kcalReferencia: Math.round(kcalRef * 10) / 10,
            kcalEquivalente: Math.round(kcalSub * 10) / 10,
            formula: `(${quantidadeRef} × ${Number(foodRef.kcal_por_referencia ?? foodRef.calories).toFixed(1)} kcal) ÷ ${Number(sub.kcal_por_referencia ?? sub.calories).toFixed(1)} kcal`,
        });
    }

    out.sort((a, b) => {
        const na = a.alimento.nome || a.alimento.name || '';
        const nb = b.alimento.nome || b.alimento.name || '';
        return na.localeCompare(nb);
    });
    return out.slice(0, limit);
}

module.exports = {
    macroScaleFactor,
    kcalPorPorcao,
    calcularQuantidadeEquivalente,
    sameEquivalenceGroup,
    canSubstitute,
    listarSubstituicoesIsocaloricas,
};
