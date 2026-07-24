/**
 * Persistência da programação semanal de treinos (aluno_treino_agenda).
 */

async function listByAlunoId(pool, alunoId) {
  const r = await pool.query(
    `SELECT a.id, a.aluno_id, a.dia_semana, a.aluno_treino_id, a.ordem,
            a.created_at, a.updated_at,
            at.treino_id,
            t.nome AS treino_nome,
            t.categoria AS treino_categoria,
            t.dificuldade AS treino_dificuldade
     FROM public.aluno_treino_agenda a
     INNER JOIN public.alunos_treinos at ON at.id = a.aluno_treino_id
     INNER JOIN public.treinos t ON t.id = at.treino_id
     WHERE a.aluno_id = $1
     ORDER BY a.dia_semana ASC, a.ordem ASC`,
    [alunoId],
  );
  return r.rows;
}

async function getByAlunoAndDia(pool, alunoId, diaSemana) {
  const r = await pool.query(
    `SELECT a.id, a.aluno_id, a.dia_semana, a.aluno_treino_id, a.ordem,
            at.treino_id,
            t.nome AS treino_nome
     FROM public.aluno_treino_agenda a
     INNER JOIN public.alunos_treinos at ON at.id = a.aluno_treino_id
     INNER JOIN public.treinos t ON t.id = at.treino_id
     WHERE a.aluno_id = $1 AND a.dia_semana = $2
     ORDER BY a.ordem ASC
     LIMIT 1`,
    [alunoId, diaSemana],
  );
  return r.rows[0] || null;
}

/**
 * Substitui toda a semana do aluno (transação).
 * @param {import('pg').Pool} pool
 * @param {string} alunoId
 * @param {Array<{ dia_semana: number, aluno_treino_id: string, ordem?: number }>} sessions
 */
async function replaceWeek(pool, alunoId, sessions) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM public.aluno_treino_agenda WHERE aluno_id = $1`, [alunoId]);
    const saved = [];
    for (const s of sessions || []) {
      const dia = Number(s.dia_semana);
      const ordem = s.ordem != null ? Number(s.ordem) : 0;
      const ins = await client.query(
        `INSERT INTO public.aluno_treino_agenda (aluno_id, dia_semana, aluno_treino_id, ordem)
         VALUES ($1, $2, $3, $4)
         RETURNING id, aluno_id, dia_semana, aluno_treino_id, ordem, created_at, updated_at`,
        [alunoId, dia, s.aluno_treino_id, ordem],
      );
      saved.push(ins.rows[0]);
    }
    await client.query('COMMIT');
    return saved;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listByAlunoId,
  getByAlunoAndDia,
  replaceWeek,
};
