/**
 * Repository: substituições diárias de itens do plano.
 */

async function assertDietaOwnsAluno(pool, dietaId, alunoId) {
  const r = await pool.query(
    `SELECT 1 FROM public.dietas WHERE id = $1 AND aluno_id = $2 LIMIT 1`,
    [dietaId, alunoId],
  );
  return r.rowCount > 0;
}

async function getItemDieta(pool, itemId, dietaId) {
  const r = await pool.query(
    `SELECT id, dieta_id, alimento_id, quantidade, unidade_quantidade, refeicao, plano
     FROM public.itens_dieta
     WHERE id = $1 AND dieta_id = $2
     LIMIT 1`,
    [itemId, dietaId],
  );
  return r.rows[0] || null;
}

async function listByAlunoAndDate(pool, alunoId, dataRef, { dietaId } = {}) {
  const params = [alunoId, dataRef];
  let sql = `
    SELECT s.*,
           ao.nome AS alimento_original_nome,
           asub.nome AS alimento_substituto_nome
    FROM public.refeicao_substituicoes s
    LEFT JOIN public.alimentos ao ON ao.id = s.alimento_original_id
    LEFT JOIN public.alimentos asub ON asub.id = s.alimento_substituto_id
    WHERE s.aluno_id = $1 AND s.data_ref = $2`;
  if (dietaId) {
    params.push(dietaId);
    sql += ` AND s.dieta_id = $${params.length}`;
  }
  sql += ` ORDER BY s.updated_at DESC`;
  const r = await pool.query(sql, params);
  return r.rows;
}

async function upsertSubstituicao(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.refeicao_substituicoes (
       aluno_id, dieta_id, item_dieta_id, data_ref, plano,
       alimento_original_id, alimento_substituto_id,
       quantidade_original, quantidade_substituto,
       unidade_original, unidade_substituto, origem, metadata
     ) VALUES (
       $1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb
     )
     ON CONFLICT (aluno_id, item_dieta_id, data_ref, plano)
     DO UPDATE SET
       alimento_substituto_id = EXCLUDED.alimento_substituto_id,
       quantidade_substituto = EXCLUDED.quantidade_substituto,
       unidade_substituto = EXCLUDED.unidade_substituto,
       origem = EXCLUDED.origem,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING *`,
    [
      row.aluno_id,
      row.dieta_id,
      row.item_dieta_id,
      row.data_ref,
      row.plano,
      row.alimento_original_id,
      row.alimento_substituto_id,
      row.quantidade_original,
      row.quantidade_substituto,
      row.unidade_original,
      row.unidade_substituto,
      row.origem || 'ui',
      JSON.stringify(row.metadata || {}),
    ],
  );
  return r.rows[0];
}

async function deleteSubstituicao(pool, alunoId, itemDietaId, dataRef, plano) {
  const r = await pool.query(
    `DELETE FROM public.refeicao_substituicoes
     WHERE aluno_id = $1 AND item_dieta_id = $2 AND data_ref = $3::date AND plano = $4
     RETURNING *`,
    [alunoId, itemDietaId, dataRef, plano],
  );
  return r.rows[0] || null;
}

module.exports = {
  assertDietaOwnsAluno,
  getItemDieta,
  listByAlunoAndDate,
  upsertSubstituicao,
  deleteSubstituicao,
};
