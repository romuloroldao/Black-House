/**
 * Gera, guarda e escolhe variações de preparo sem alterar a prescrição.
 */

const { weekKeyInTimeZone } = require('../utils/zoned-time');
const {
  fingerprintItems,
  mealKeyFromRefeicao,
  eligibleForVariation,
  buildTemplateVariations,
  validateVariation,
  macrosOf,
  isSubstitutoRefeicao,
} = require('./refeicao-variacao/core');

const TZ = 'America/Sao_Paulo';

function httpError(status, message, code) {
  const err = new Error(message);
  err.statusCode = status;
  err.code = code;
  return err;
}

function weekStart(dateIso) {
  const base = dateIso ? new Date(`${dateIso}T12:00:00Z`) : new Date();
  return weekKeyInTimeZone(base, TZ);
}

async function loadOwnedItems(pool, alunoId, dietaId, itemIds) {
  const dieta = await pool.query(
    'SELECT id, aluno_id FROM public.dietas WHERE id = $1',
    [dietaId],
  );
  if (!dieta.rows[0] || String(dieta.rows[0].aluno_id) !== String(alunoId)) {
    throw httpError(403, 'Dieta não pertence a este aluno', 'DIETA_FORBIDDEN');
  }
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw httpError(400, 'Informe os itens da refeição', 'MISSING_ITEMS');
  }
  const rows = await pool.query(
    `SELECT i.id, i.dieta_id, i.alimento_id, i.quantidade, i.unidade_quantidade, i.refeicao,
            i.alimento_nome_snapshot,
            a.nome,
            COALESCE((i.nutrientes_snapshot->>'quantidade_referencia')::numeric, a.quantidade_referencia_g, 100) AS quantidade_referencia_g,
            COALESCE((i.nutrientes_snapshot->>'kcal')::numeric, a.kcal_por_referencia, 0) AS kcal_por_referencia,
            COALESCE((i.nutrientes_snapshot->>'ptn')::numeric, a.ptn_por_referencia, 0) AS ptn_por_referencia,
            COALESCE((i.nutrientes_snapshot->>'cho')::numeric, a.cho_por_referencia, 0) AS cho_por_referencia,
            COALESCE((i.nutrientes_snapshot->>'lip')::numeric, a.lip_por_referencia, 0) AS lip_por_referencia
     FROM public.itens_dieta i
     LEFT JOIN public.alimentos a ON a.id = i.alimento_id
     WHERE i.dieta_id = $1 AND i.id = ANY($2::uuid[])`,
    [dietaId, itemIds],
  );
  if (rows.rows.length !== itemIds.length) {
    throw httpError(400, 'Algum item não pertence a esta dieta', 'ITEM_FORBIDDEN');
  }
  return rows.rows.map((row) => ({
    ...row,
    nome: row.nome || row.alimento_nome_snapshot,
  }));
}

async function ensureVariations(pool, alunoId, dietaId, items, dateIso) {
  const principais = items.filter((item) => !isSubstitutoRefeicao(item.refeicao));
  const fingerprint = fingerprintItems(principais);
  const semana = weekStart(dateIso);
  if (!eligibleForVariation(principais)) {
    return { fingerprint, semana_inicio: semana, items: [], motivo: 'SEM_VARIACAO_SEGURA' };
  }

  const existing = await pool.query(
    `SELECT id, indice, titulo, preparo, itens, macros, status
     FROM public.refeicao_variacoes
     WHERE aluno_id = $1 AND dieta_id = $2 AND fingerprint = $3
       AND semana_inicio = $4::date AND status = 'valida'
     ORDER BY indice ASC`,
    [alunoId, dietaId, fingerprint, semana],
  );
  if (existing.rows.length > 0) {
    return { fingerprint, semana_inicio: semana, items: existing.rows, motivo: null };
  }

  const drafts = buildTemplateVariations(principais).filter((draft) => (
    validateVariation(principais, draft).ok
  ));
  if (drafts.length < 2) {
    return { fingerprint, semana_inicio: semana, items: [], motivo: 'SEM_VARIACAO_SEGURA' };
  }

  const macros = macrosOf(principais);
  const saved = [];
  for (const draft of drafts.slice(0, 2)) {
    const inserted = await pool.query(
      `INSERT INTO public.refeicao_variacoes (
         aluno_id, dieta_id, fingerprint, semana_inicio, indice, titulo, preparo, itens, macros, status
       ) VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8::jsonb,$9::jsonb,'valida')
       ON CONFLICT (aluno_id, dieta_id, fingerprint, semana_inicio, indice)
       DO UPDATE SET status = 'valida'
       RETURNING id, indice, titulo, preparo, itens, macros, status`,
      [
        alunoId,
        dietaId,
        fingerprint,
        semana,
        draft.indice,
        draft.titulo,
        draft.preparo,
        JSON.stringify(draft.itens),
        JSON.stringify(macros),
      ],
    );
    saved.push(inserted.rows[0]);
  }
  return { fingerprint, semana_inicio: semana, items: saved, motivo: null };
}

async function listForMeal(pool, alunoId, body) {
  const dietaId = body.dieta_id;
  const mealKey = String(body.meal_key || '').trim();
  const plano = String(body.plano || 'UNICO').trim() || 'UNICO';
  const dataRef = String(body.date || '').slice(0, 10);
  if (!dietaId || !mealKey || !/^\d{4}-\d{2}-\d{2}$/.test(dataRef)) {
    throw httpError(400, 'dieta_id, meal_key e date são obrigatórios', 'VALIDATION');
  }
  const items = await loadOwnedItems(pool, alunoId, dietaId, body.item_ids);
  const generated = await ensureVariations(pool, alunoId, dietaId, items, dataRef);
  const choice = await pool.query(
    `SELECT e.variacao_id
     FROM public.refeicao_variacao_escolhas e
     INNER JOIN public.refeicao_variacoes v ON v.id = e.variacao_id
     WHERE e.aluno_id = $1 AND e.dieta_id = $2 AND e.data_ref = $3::date
       AND e.meal_key = $4 AND e.plano = $5
       AND v.status = 'valida' AND v.fingerprint = $6`,
    [alunoId, dietaId, dataRef, mealKey, plano, generated.fingerprint],
  );
  return {
    fingerprint: generated.fingerprint,
    semana_inicio: generated.semana_inicio,
    motivo: generated.motivo,
    escolha_id: choice.rows[0]?.variacao_id || null,
    items: generated.items,
    aviso: 'Escolher um preparo não marca a refeição como consumida.',
  };
}

async function chooseForMeal(pool, alunoId, body) {
  const listed = await listForMeal(pool, alunoId, body);
  const variacaoId = body.variacao_id;
  if (!variacaoId) throw httpError(400, 'variacao_id é obrigatório', 'VALIDATION');
  const allowed = (listed.items || []).some((item) => String(item.id) === String(variacaoId));
  if (!allowed) throw httpError(404, 'Variação indisponível para esta refeição', 'VARIACAO_INVALIDA');
  const plano = String(body.plano || 'UNICO').trim() || 'UNICO';
  const saved = await pool.query(
    `INSERT INTO public.refeicao_variacao_escolhas (
       aluno_id, dieta_id, data_ref, meal_key, plano, variacao_id
     ) VALUES ($1,$2,$3::date,$4,$5,$6)
     ON CONFLICT (aluno_id, dieta_id, data_ref, meal_key, plano)
     DO UPDATE SET variacao_id = EXCLUDED.variacao_id, updated_at = now()
     RETURNING id, variacao_id, data_ref, meal_key, plano`,
    [alunoId, body.dieta_id, String(body.date).slice(0, 10), body.meal_key, plano, variacaoId],
  );
  return saved.rows[0];
}

module.exports = {
  listForMeal,
  chooseForMeal,
  weekStart,
  mealKeyFromRefeicao,
};
