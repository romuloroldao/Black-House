/**
 * Resolve app_auth.users.id a partir de public.alunos.id (e o inverso).
 *
 * Produção usa alunos.user_id; o boot pode criar alunos.linked_user_id vazio
 * (schema-validator). Por isso nunca se confia numa única coluna: usa-se a que
 * estiver preenchida e, em último caso, o e-mail — o mesmo critério do portal
 * (aluno-resolve-by-user.js).
 */

const { getAlunoUserLinkColumns } = require('./aluno-link-column');

function linkExpr(cols, alias = 'a') {
  const present = ['user_id', 'linked_user_id'].filter((c) => cols.has(c));
  if (present.length === 0) return null;
  if (present.length === 1) return `${alias}.${present[0]}`;
  return `COALESCE(${present.map((c) => `${alias}.${c}`).join(', ')})`;
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} alunoId
 * @returns {Promise<string|null>}
 */
async function getAuthUserIdForAluno(pool, alunoId) {
  if (!alunoId) return null;

  const cols = await getAlunoUserLinkColumns(pool);
  const expr = linkExpr(cols);
  const r = await pool.query(
    `SELECT ${expr || 'NULL::uuid'} AS auth_user_id,
            u.id AS email_user_id
     FROM public.alunos a
     LEFT JOIN app_auth.users u
       ON a.email IS NOT NULL AND TRIM(a.email) <> ''
      AND LOWER(TRIM(u.email)) = LOWER(TRIM(a.email))
     WHERE a.id = $1
     LIMIT 1`,
    [alunoId],
  );

  const row = r.rows[0];
  if (!row) return null;
  const id = row.auth_user_id || row.email_user_id;
  return id ? String(id) : null;
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} authUserId
 * @returns {Promise<{ id: string, coach_id: string|null }|null>}
 */
async function getAlunoRecordForAuthUser(pool, authUserId) {
  if (!authUserId) return null;

  const cols = await getAlunoUserLinkColumns(pool);
  const conditions = ['user_id', 'linked_user_id']
    .filter((c) => cols.has(c))
    .map((c) => `a.${c} = $1`);

  if (conditions.length > 0) {
    const r = await pool.query(
      `SELECT a.id, a.coach_id
       FROM public.alunos a
       WHERE ${conditions.join(' OR ')}
       ORDER BY a.created_at DESC NULLS LAST
       LIMIT 1`,
      [authUserId],
    );
    if (r.rows[0]) return r.rows[0];
  }

  const byEmail = await pool.query(
    `SELECT a.id, a.coach_id
     FROM public.alunos a
     INNER JOIN app_auth.users u ON u.id = $1
     WHERE a.email IS NOT NULL AND TRIM(a.email) <> ''
       AND LOWER(TRIM(a.email)) = LOWER(TRIM(u.email))
     ORDER BY a.created_at DESC NULLS LAST
     LIMIT 1`,
    [authUserId],
  );
  return byEmail.rows[0] || null;
}

module.exports = {
  getAuthUserIdForAluno,
  getAlunoRecordForAuthUser,
};
