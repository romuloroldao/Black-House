/**
 * Remove credencial (app_auth + user_roles) associada a um aluno eliminado,
 * para não reaparecer em "Cadastros na plataforma".
 */

const logger = require('./logger');
const { getAlunoUserLinkColumn } = require('./aluno-link-column');

/**
 * @param {import('pg').PoolClient} client — dentro de transação
 * @param {{ email?: string|null, authUserId?: string|null }} params
 */
async function deleteAuthUserForAluno(client, { email, authUserId }) {
  let userId = authUserId || null;

  if (!userId && email) {
    const normalized = String(email).trim().toLowerCase();
    if (!normalized.includes('@') || normalized.includes('@blackhouse.local')) {
      return { removed: false };
    }
    const found = await client.query(
      'SELECT id FROM app_auth.users WHERE LOWER(TRIM(email)) = $1 LIMIT 1',
      [normalized],
    );
    userId = found.rows[0]?.id || null;
  }

  if (!userId) {
    return { removed: false };
  }

  const roleCheck = await client.query(
    `SELECT id, role FROM public.user_roles WHERE user_id = $1`,
    [userId],
  );
  const role = roleCheck.rows[0]?.role;
  if (role === 'coach' || role === 'admin') {
    logger.warn('deleteAuthUserForAluno: ignorado — utilizador é coach/admin', { userId, role });
    return { removed: false, skipped: 'protected_role' };
  }

  await client.query('DELETE FROM public.user_roles WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM public.profiles WHERE id = $1', [userId]);
  await client.query('DELETE FROM app_auth.users WHERE id = $1', [userId]);

  logger.info('deleteAuthUserForAluno: credencial removida', { userId, email });
  return { removed: true, userId };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} alunoId
 */
async function loadAlunoAuthTargets(client, alunoId) {
  const linkCol = await getAlunoUserLinkColumn(client);
  const r = await client.query(
    `SELECT email, ${linkCol} AS auth_user_id FROM public.alunos WHERE id = $1`,
    [alunoId],
  );
  if (!r.rows[0]) {
    return { email: null, authUserId: null };
  }
  return {
    email: r.rows[0].email,
    authUserId: r.rows[0].auth_user_id,
  };
}

module.exports = {
  deleteAuthUserForAluno,
  loadAlunoAuthTargets,
};
