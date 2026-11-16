/**
 * Categorias pessoais de alimentos do profissional.
 * Só organizam referências a public.alimentos — nunca copiam nem alteram o alimento.
 */

const { resolveCoachScope } = require('./coach-team.service');
const { getAlunoRecordForAuthUser } = require('../utils/aluno-auth-user');

const MAX_CATEGORIES = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function httpError(status, message, code) {
  const err = new Error(message);
  err.statusCode = status;
  err.code_ = code;
  return err;
}

function cleanIds(raw) {
  const ids = [...new Set((Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(String))];
  if (ids.length === 0) throw httpError(400, 'Informe os alimentos', 'SEM_ALIMENTOS');
  if (ids.length > 500) throw httpError(400, 'Máximo de 500 alimentos por vez', 'LIMITE_ALIMENTOS');
  if (!ids.every((id) => UUID_RE.test(id))) throw httpError(400, 'Alimento inválido', 'ALIMENTO_INVALIDO');
  return ids;
}

function cleanNome(raw) {
  const nome = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!nome) throw httpError(400, 'Informe o nome da categoria', 'NOME_OBRIGATORIO');
  if (nome.length > 60) throw httpError(400, 'Nome com no máximo 60 caracteres', 'NOME_LONGO');
  return nome;
}

/**
 * Dono das categorias para o utilizador autenticado.
 * coach/admin → o próprio; assistente → o coach da equipa; aluno → o coach do aluno (só leitura).
 * @returns {Promise<{ ownerId: string|null, canWrite: boolean }>}
 */
async function resolveCategoryOwner(pool, user, requestedCoachId = null) {
  if (!user?.id) return { ownerId: null, canWrite: false };

  if (user.role === 'aluno') {
    const aluno = await getAlunoRecordForAuthUser(pool, user.id);
    return { ownerId: aluno?.coach_id || null, canWrite: false };
  }

  if (user.role === 'admin' || user.role === 'coach') {
    return { ownerId: user.id, canWrite: true };
  }

  const scope = await resolveCoachScope(pool, user.id, user.role);
  const coachIds = Array.isArray(scope.coachIds) ? scope.coachIds : [];
  if (coachIds.length === 0) return { ownerId: null, canWrite: false };
  const ownerId = requestedCoachId && coachIds.includes(requestedCoachId) ? requestedCoachId : coachIds[0];
  return { ownerId, canWrite: Boolean(scope.canWrite) };
}

async function listCategories(pool, ownerId) {
  const cats = await pool.query(
    `SELECT id, nome, ordem, created_at, updated_at
     FROM public.coach_food_categories
     WHERE coach_id = $1
     ORDER BY ordem ASC, lower(nome) ASC`,
    [ownerId],
  );
  const items = await pool.query(
    `SELECT i.category_id, i.alimento_id
     FROM public.coach_food_category_items i
     JOIN public.alimentos a ON a.id = i.alimento_id
     WHERE i.coach_id = $1
       AND COALESCE(a.status, 'active') NOT IN ('deprecated', 'merged')
     ORDER BY lower(a.nome) ASC`,
    [ownerId],
  );
  const byCat = new Map(cats.rows.map((c) => [c.id, []]));
  for (const row of items.rows) byCat.get(row.category_id)?.push(row.alimento_id);
  return cats.rows.map((c) => ({ ...c, alimento_ids: byCat.get(c.id) || [] }));
}

async function createCategory(pool, ownerId, { nome }) {
  const clean = cleanNome(nome);
  const count = await pool.query('SELECT count(*)::int AS n FROM public.coach_food_categories WHERE coach_id = $1', [
    ownerId,
  ]);
  if (count.rows[0].n >= MAX_CATEGORIES) {
    throw httpError(400, `Limite de ${MAX_CATEGORIES} categorias`, 'LIMITE_CATEGORIAS');
  }
  try {
    const r = await pool.query(
      `INSERT INTO public.coach_food_categories (coach_id, nome, ordem)
       VALUES ($1, $2, COALESCE((SELECT max(ordem) + 1 FROM public.coach_food_categories WHERE coach_id = $1), 0))
       RETURNING id, nome, ordem, created_at, updated_at`,
      [ownerId, clean],
    );
    return { ...r.rows[0], alimento_ids: [] };
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'Já existe uma categoria com esse nome', 'NOME_DUPLICADO');
    throw error;
  }
}

async function updateCategory(pool, ownerId, id, { nome, ordem }) {
  const sets = [];
  const params = [id, ownerId];
  if (nome !== undefined) {
    params.push(cleanNome(nome));
    sets.push(`nome = $${params.length}`);
  }
  if (ordem !== undefined) {
    const n = Number(ordem);
    if (!Number.isInteger(n) || n < 0) throw httpError(400, 'Ordem inválida', 'ORDEM_INVALIDA');
    params.push(n);
    sets.push(`ordem = $${params.length}`);
  }
  if (sets.length === 0) throw httpError(400, 'Nada para atualizar', 'SEM_CAMPOS');
  try {
    const r = await pool.query(
      `UPDATE public.coach_food_categories SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $1 AND coach_id = $2
       RETURNING id, nome, ordem, created_at, updated_at`,
      params,
    );
    if (!r.rows[0]) throw httpError(404, 'Categoria não encontrada', 'NOT_FOUND');
    return r.rows[0];
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'Já existe uma categoria com esse nome', 'NOME_DUPLICADO');
    throw error;
  }
}

/** Apaga a categoria; os alimentos ficam "Sem categoria" (só as ligações saem). */
async function deleteCategory(pool, ownerId, id) {
  const r = await pool.query(
    `WITH released AS (
       SELECT count(*)::int AS n FROM public.coach_food_category_items WHERE category_id = $1 AND coach_id = $2
     )
     DELETE FROM public.coach_food_categories c
     WHERE c.id = $1 AND c.coach_id = $2
     RETURNING c.id, (SELECT n FROM released) AS alimentos_liberados`,
    [id, ownerId],
  );
  if (!r.rows[0]) throw httpError(404, 'Categoria não encontrada', 'NOT_FOUND');
  return r.rows[0];
}

/** Coloca (ou move) alimentos numa categoria. Um alimento fica sempre numa só categoria. */
async function assignFoods(pool, ownerId, categoryId, alimentoIds) {
  const ids = cleanIds(alimentoIds);

  const cat = await pool.query('SELECT id FROM public.coach_food_categories WHERE id = $1 AND coach_id = $2', [
    categoryId,
    ownerId,
  ]);
  if (!cat.rows[0]) throw httpError(404, 'Categoria não encontrada', 'NOT_FOUND');

  const found = await pool.query('SELECT id FROM public.alimentos WHERE id = ANY($1::uuid[])', [ids]);
  if (found.rows.length !== ids.length) throw httpError(400, 'Alimento inexistente na lista', 'ALIMENTO_INVALIDO');

  const r = await pool.query(
    `INSERT INTO public.coach_food_category_items (coach_id, alimento_id, category_id)
     SELECT $1, unnest($3::uuid[]), $2
     ON CONFLICT (coach_id, alimento_id)
     DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = now()
     RETURNING alimento_id`,
    [ownerId, categoryId, ids],
  );
  return { category_id: categoryId, alimento_ids: r.rows.map((x) => x.alimento_id) };
}

/** Tira alimentos de qualquer categoria (voltam a "Sem categoria"). */
async function unassignFoods(pool, ownerId, alimentoIds) {
  const ids = cleanIds(alimentoIds);
  const r = await pool.query(
    `DELETE FROM public.coach_food_category_items
     WHERE coach_id = $1 AND alimento_id = ANY($2::uuid[])
     RETURNING alimento_id`,
    [ownerId, ids],
  );
  return { alimento_ids: r.rows.map((x) => x.alimento_id) };
}

module.exports = {
  resolveCategoryOwner,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  assignFoods,
  unassignFoods,
  cleanNome,
  cleanIds,
  MAX_CATEGORIES,
};
