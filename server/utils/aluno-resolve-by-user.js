/**
 * Resolve linha de public.alunos para o utilizador autenticado (app_auth.users.id).
 * BD legada pode não ter linked_user_id — fallback por email (alunos.email = users.email).
 */

const { getAlunoUserLinkColumn } = require('./aluno-link-column');

async function queryAlunoRowsFullForUser(pool, userId) {
  const linkCol = await getAlunoUserLinkColumn(pool);
  const qLinked = `
    SELECT a.*, u.email AS user_email, u.created_at AS user_created_at
    FROM public.alunos a
    INNER JOIN app_auth.users u ON u.id = a.${linkCol}
    WHERE a.${linkCol} = $1
  `;
  try {
    const r = await pool.query(qLinked, [userId]);
    if (r.rows.length > 0) return r.rows;
  } catch (e) {
    if (e.code !== '42703') {
      throw e;
    }
  }

  const qEmail = `
    SELECT a.*, u.email AS user_email, u.created_at AS user_created_at
    FROM public.alunos a
    INNER JOIN app_auth.users u ON u.id = $1
    WHERE a.email IS NOT NULL AND TRIM(a.email) <> ''
      AND LOWER(TRIM(a.email)) = LOWER(TRIM(u.email))
    LIMIT 1
  `;
  const r2 = await pool.query(qEmail, [userId]);
  return r2.rows;
}

module.exports = {
  queryAlunoRowsFullForUser,
};
