/**
 * Persistência de sessões de treino e logs de séries/cargas.
 */

async function getSessaoByAlunoTreinoDate(pool, alunoId, treinoId, dataRef) {
  const r = await pool.query(
    `SELECT * FROM public.treino_sessoes
     WHERE aluno_id = $1 AND treino_id = $2 AND data_ref = $3::date
     LIMIT 1`,
    [alunoId, treinoId, dataRef],
  );
  return r.rows[0] || null;
}

async function listSessoesByAlunoAndDate(pool, alunoId, dataRef) {
  const r = await pool.query(
    `SELECT * FROM public.treino_sessoes
     WHERE aluno_id = $1 AND data_ref = $2::date
     ORDER BY started_at DESC`,
    [alunoId, dataRef],
  );
  return r.rows;
}

async function upsertSessao(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.treino_sessoes (
       aluno_id, aluno_treino_id, treino_id, data_ref,
       status, origem, metadata
     ) VALUES (
       $1, $2, $3, $4::date,
       COALESCE($5, 'in_progress'), COALESCE($6, 'ui'),
       COALESCE($7::jsonb, '{}'::jsonb)
     )
     ON CONFLICT (aluno_id, treino_id, data_ref)
     DO UPDATE SET
       aluno_treino_id = COALESCE(EXCLUDED.aluno_treino_id, public.treino_sessoes.aluno_treino_id),
       origem = EXCLUDED.origem,
       updated_at = now()
     RETURNING *`,
    [
      row.aluno_id,
      row.aluno_treino_id || null,
      row.treino_id,
      row.data_ref,
      row.status || 'in_progress',
      row.origem || 'ui',
      row.metadata != null ? JSON.stringify(row.metadata) : '{}',
    ],
  );
  return r.rows[0];
}

async function updateSessao(pool, sessaoId, alunoId, patch) {
  const fields = [];
  const values = [];
  let i = 1;

  if (patch.status != null) {
    fields.push(`status = $${i++}`);
    values.push(patch.status);
    if (patch.status === 'completed') {
      fields.push(`completed_at = COALESCE(completed_at, now())`);
    }
  }
  if (patch.metadata != null) {
    fields.push(`metadata = $${i++}::jsonb`);
    values.push(JSON.stringify(patch.metadata));
  }
  if (fields.length === 0) {
    const cur = await pool.query(
      `SELECT * FROM public.treino_sessoes WHERE id = $1 AND aluno_id = $2 LIMIT 1`,
      [sessaoId, alunoId],
    );
    return cur.rows[0] || null;
  }

  fields.push('updated_at = now()');
  values.push(sessaoId, alunoId);

  const r = await pool.query(
    `UPDATE public.treino_sessoes
     SET ${fields.join(', ')}
     WHERE id = $${i++} AND aluno_id = $${i}
     RETURNING *`,
    values,
  );
  return r.rows[0] || null;
}

async function getSessaoById(pool, sessaoId) {
  const r = await pool.query(
    `SELECT * FROM public.treino_sessoes WHERE id = $1 LIMIT 1`,
    [sessaoId],
  );
  return r.rows[0] || null;
}

async function listSeriesBySessao(pool, sessaoId) {
  const r = await pool.query(
    `SELECT * FROM public.treino_serie_logs
     WHERE sessao_id = $1
     ORDER BY exercise_index ASC, set_index ASC`,
    [sessaoId],
  );
  return r.rows;
}

async function upsertSerie(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.treino_serie_logs (
       sessao_id, aluno_id, exercise_index, exercise_name, set_index,
       carga, repeticoes, rpe, dor, concluido, origem, metadata
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, COALESCE($10, true), COALESCE($11, 'ui'),
       COALESCE($12::jsonb, '{}'::jsonb)
     )
     ON CONFLICT (sessao_id, exercise_index, set_index)
     DO UPDATE SET
       exercise_name = EXCLUDED.exercise_name,
       carga = EXCLUDED.carga,
       repeticoes = EXCLUDED.repeticoes,
       rpe = EXCLUDED.rpe,
       dor = EXCLUDED.dor,
       concluido = EXCLUDED.concluido,
       origem = EXCLUDED.origem,
       metadata = EXCLUDED.metadata,
       registrado_em = now()
     RETURNING *`,
    [
      row.sessao_id,
      row.aluno_id,
      row.exercise_index,
      row.exercise_name,
      row.set_index ?? 1,
      row.carga ?? null,
      row.repeticoes ?? null,
      row.rpe ?? null,
      row.dor ?? null,
      row.concluido !== false,
      row.origem || 'ui',
      row.metadata != null ? JSON.stringify(row.metadata) : '{}',
    ],
  );
  return r.rows[0];
}

async function listCargasHistorico(pool, alunoId, treinoId, { limit = 24 } = {}) {
  const lim = Math.min(48, Math.max(1, Number(limit) || 24));
  const r = await pool.query(
    `SELECT s.id AS sessao_id, s.data_ref, s.status, s.treino_id,
            l.exercise_index, l.exercise_name, l.set_index, l.carga,
            l.repeticoes, l.rpe, l.dor, l.registrado_em
     FROM public.treino_sessoes s
     INNER JOIN public.treino_serie_logs l ON l.sessao_id = s.id
     WHERE s.aluno_id = $1 AND s.treino_id = $2
       AND l.carga IS NOT NULL AND TRIM(l.carga) <> ''
     ORDER BY s.data_ref DESC, l.exercise_index ASC, l.set_index ASC
     LIMIT $3`,
    [alunoId, treinoId, lim * 20],
  );
  return r.rows;
}

async function assertTreinoAtribuido(pool, alunoId, treinoId) {
  const r = await pool.query(
    `SELECT at.id AS aluno_treino_id, at.treino_id
     FROM public.alunos_treinos at
     WHERE at.aluno_id = $1 AND at.treino_id = $2
       AND COALESCE(at.ativo, true) = true
     ORDER BY at.created_at DESC NULLS LAST
     LIMIT 1`,
    [alunoId, treinoId],
  );
  return r.rows[0] || null;
}

module.exports = {
  getSessaoByAlunoTreinoDate,
  listSessoesByAlunoAndDate,
  upsertSessao,
  updateSessao,
  getSessaoById,
  listSeriesBySessao,
  upsertSerie,
  listCargasHistorico,
  assertTreinoAtribuido,
};
