/**
 * Persistência de conclusões de refeições do plano (checklist diário).
 */

async function listByAlunoAndDate(pool, alunoId, dataRef) {
  const r = await pool.query(
    `SELECT *
     FROM public.refeicao_conclusoes
     WHERE aluno_id = $1 AND data_ref = $2::date
     ORDER BY meal_key ASC, plano ASC`,
    [alunoId, dataRef],
  );
  return r.rows;
}

async function upsertConclusao(pool, row) {
  const concluido = row.concluido !== false;
  const r = await pool.query(
    `INSERT INTO public.refeicao_conclusoes (
       aluno_id, dieta_id, data_ref, meal_key, plano,
       concluido, concluido_em, origem, metadata
     ) VALUES (
       $1, $2, $3::date, $4, $5,
       $6, CASE WHEN $6 THEN now() ELSE NULL END, $7, COALESCE($8::jsonb, '{}'::jsonb)
     )
     ON CONFLICT (aluno_id, dieta_id, data_ref, meal_key, plano)
     DO UPDATE SET
       concluido = EXCLUDED.concluido,
       concluido_em = CASE
         WHEN EXCLUDED.concluido THEN COALESCE(public.refeicao_conclusoes.concluido_em, now())
         ELSE NULL
       END,
       origem = EXCLUDED.origem,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING *`,
    [
      row.aluno_id,
      row.dieta_id,
      row.data_ref,
      row.meal_key,
      row.plano || 'A',
      concluido,
      row.origem || 'ui',
      row.metadata != null ? JSON.stringify(row.metadata) : '{}',
    ],
  );
  return r.rows[0];
}

async function assertDietaOwnsAluno(pool, dietaId, alunoId) {
  const r = await pool.query(
    `SELECT id FROM public.dietas WHERE id = $1 AND aluno_id = $2 LIMIT 1`,
    [dietaId, alunoId],
  );
  return Boolean(r.rows[0]);
}

module.exports = {
  listByAlunoAndDate,
  upsertConclusao,
  assertDietaOwnsAluno,
};
