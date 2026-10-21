// Adapter: converte schema real da tabela alimentos para contrato canônico

const toNumber = (value) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};

const adaptFood = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        name: row.nome,
        calories: toNumber(row.kcal_por_referencia),
        protein: toNumber(row.ptn_por_referencia),
        carbs: toNumber(row.cho_por_referencia),
        fat: toNumber(row.lip_por_referencia),
        alcohol: toNumber(row.alcool_por_referencia),
        portion: toNumber(row.quantidade_referencia_g),
        // Campos legados para compatibilidade imediata com o frontend atual
        nome: row.nome,
        origem_ptn: row.origem_ptn,
        tipo_id: row.tipo_id,
        tipo_nome: row.tipo_nome || null,
        macro_predominante: row.macro_predominante || null,
        equiv_livre: row.equiv_livre === true,
        quantidade_referencia_g: row.quantidade_referencia_g,
        kcal_por_referencia: row.kcal_por_referencia,
        ptn_por_referencia: row.ptn_por_referencia,
        cho_por_referencia: row.cho_por_referencia,
        lip_por_referencia: row.lip_por_referencia,
        alcool_por_referencia: toNumber(row.alcool_por_referencia),
        info_adicional: row.info_adicional,
        autor: row.autor,
        created_at: row.created_at,
        updated_at: row.updated_at || row.created_at,
        status: row.status || 'active',
        scope: row.scope || 'platform',
        versao_actual: row.versao_actual ?? 1,
        unidade_referencia: row.unidade_referencia || 'g',
        fibra_por_referencia: toNumber(row.fibra_por_referencia),
        acucar_por_referencia: toNumber(row.acucar_por_referencia),
        sodio_por_referencia_mg: toNumber(row.sodio_por_referencia_mg),
        qualidade_score: row.qualidade_score != null ? Number(row.qualidade_score) : null,
        flags_qualidade: Array.isArray(row.flags_qualidade) ? row.flags_qualidade : [],
    };
};

module.exports = {
    adaptFood
};
