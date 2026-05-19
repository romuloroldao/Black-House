/**
 * Resolve app_auth.users.id a partir de public.alunos.id
 */

const { getAlunoUserLinkColumn } = require('./aluno-link-column');

/**
 * @param {import('pg').Pool} pool
 * @param {string} alunoId
 * @returns {Promise<string|null>}
 */
async function getAuthUserIdForAluno(pool, alunoId) {
  if (!alunoId) return null;

  const linkCol = await getAlunoUserLinkColumn(pool);
  const r = await pool.query(
    `SELECT ${linkCol} AS auth_user_id, coach_id
     FROM public.alunos
     WHERE id = $1
     LIMIT 1`,
    [alunoId],
  );

  const row = r.rows[0];
  if (!row?.auth_user_id) return null;
  return String(row.auth_user_id);
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} authUserId
 * @returns {Promise<{ id: string, coach_id: string|null }|null>}
 */
async function getAlunoRecordForAuthUser(pool, authUserId) {
  if (!authUserId) return null;

  const linkCol = await getAlunoUserLinkColumn(pool);
  const r = await pool.query(
    `SELECT id, coach_id
     FROM public.alunos
     WHERE ${linkCol} = $1
     ORDER BY created_at DESC NULLS LAST
     LIMIT 1`,
    [authUserId],
  );

  return r.rows[0] || null;
}

module.exports = {
  getAuthUserIdForAluno,
  getAlunoRecordForAuthUser,
};
