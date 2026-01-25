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
        portion: toNumber(row.quantidade_referencia_g),
        // Campos legados para compatibilidade imediata com o frontend atual
        nome: row.nome,
        origem_ptn: row.origem_ptn,
        tipo_id: row.tipo_id,
        quantidade_referencia_g: row.quantidade_referencia_g,
        kcal_por_referencia: row.kcal_por_referencia,
        ptn_por_referencia: row.ptn_por_referencia,
        cho_por_referencia: row.cho_por_referencia,
        lip_por_referencia: row.lip_por_referencia,
        info_adicional: row.info_adicional,
        autor: row.autor,
        created_at: row.created_at
    };
};

module.exports = {
    adaptFood
};
