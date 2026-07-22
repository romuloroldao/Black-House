/**
 * Persistência de refeições registadas (diário alimentar do aluno).
 */

async function listByAlunoId(pool, alunoId, { limit = 30, offset = 0 } = {}) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 30));
  const off = Math.max(0, Number(offset) || 0);
  const r = await pool.query(
    `SELECT r.*
     FROM public.refeicoes_registradas r
     WHERE r.aluno_id = $1
     ORDER BY r.registrado_em DESC
     LIMIT $2 OFFSET $3`,
    [alunoId, lim, off],
  );
  return r.rows;
}

async function getById(pool, id) {
  const r = await pool.query(
    `SELECT * FROM public.refeicoes_registradas WHERE id = $1 LIMIT 1`,
    [id],
  );
  return r.rows[0] || null;
}

async function listItens(pool, refeicaoId) {
  const r = await pool.query(
    `SELECT * FROM public.refeicao_registrada_itens
     WHERE refeicao_id = $1
     ORDER BY ordem ASC, created_at ASC`,
    [refeicaoId],
  );
  return r.rows;
}

async function createWithItens(pool, meal, itens) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO public.refeicoes_registradas (
         aluno_id, registrado_em, nome_sugerido, imagem_path,
         kcal, ptn, cho, lip,
         ai_kcal, ai_ptn, ai_cho, ai_lip,
         origem, ai_confidence, ai_uncertainties, ai_raw, notas
       ) VALUES (
         $1, COALESCE($2::timestamptz, now()), $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11, $12,
         $13, $14, $15::jsonb, $16::jsonb, $17
       )
       RETURNING *`,
      [
        meal.aluno_id,
        meal.registrado_em || null,
        meal.nome_sugerido || null,
        meal.imagem_path || null,
        meal.kcal ?? 0,
        meal.ptn ?? 0,
        meal.cho ?? 0,
        meal.lip ?? 0,
        meal.ai_kcal ?? null,
        meal.ai_ptn ?? null,
        meal.ai_cho ?? null,
        meal.ai_lip ?? null,
        meal.origem || 'AI_ESTIMATE',
        meal.ai_confidence ?? null,
        JSON.stringify(meal.ai_uncertainties || []),
        meal.ai_raw != null ? JSON.stringify(meal.ai_raw) : null,
        meal.notas || null,
      ],
    );
    const row = ins.rows[0];
    const savedItens = [];
    for (let i = 0; i < (itens || []).length; i++) {
      const it = itens[i];
      const ir = await client.query(
        `INSERT INTO public.refeicao_registrada_itens (
           refeicao_id, nome, quantidade, unidade,
           kcal, ptn, cho, lip, alimento_id, fonte, ordem
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          row.id,
          String(it.nome || '').trim() || 'Alimento',
          Number(it.quantidade) || 0,
          String(it.unidade || 'g').trim() || 'g',
          Number(it.kcal) || 0,
          Number(it.ptn) || 0,
          Number(it.cho) || 0,
          Number(it.lip) || 0,
          it.alimento_id || null,
          it.fonte === 'USER' ? 'USER' : 'AI',
          it.ordem != null ? Number(it.ordem) : i,
        ],
      );
      savedItens.push(ir.rows[0]);
    }
    await client.query('COMMIT');
    return { ...row, itens: savedItens };
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

async function attachItens(pool, meals) {
  if (!meals?.length) return [];
  const ids = meals.map((m) => m.id);
  const r = await pool.query(
    `SELECT * FROM public.refeicao_registrada_itens
     WHERE refeicao_id = ANY($1::uuid[])
     ORDER BY ordem ASC, created_at ASC`,
    [ids],
  );
  const byMeal = new Map();
  for (const it of r.rows) {
    if (!byMeal.has(it.refeicao_id)) byMeal.set(it.refeicao_id, []);
    byMeal.get(it.refeicao_id).push(it);
  }
  return meals.map((m) => ({ ...m, itens: byMeal.get(m.id) || [] }));
}

module.exports = {
  listByAlunoId,
  getById,
  listItens,
  createWithItens,
  attachItens,
};
