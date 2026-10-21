/**
 * Eliminação em cascata de utilizador a partir do id da linha public.user_roles.
 * Alinhado à lógica de DELETE /rest/v1/user_roles (server/index.js).
 */
const logger = require('./logger');

/**
 * @param {import('pg').Pool} pool
 * @param {string} roleId — UUID da linha em public.user_roles
 * @returns {Promise<{ ok: boolean, status?: number, body?: object }>}
 */
async function deleteUserByUserRoleId(pool, roleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roleResult = await client.query(
      'SELECT user_id, role FROM public.user_roles WHERE id = $1',
      [roleId],
    );

    if (roleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, body: { error: 'Role não encontrada', error_code: 'ROLE_NOT_FOUND' } };
    }

    const { user_id: userId, role } = roleResult.rows[0];

    if (role === 'coach') {
      const coachCount = await client.query(
        `SELECT COUNT(*)::int AS n FROM public.user_roles WHERE role = 'coach'`,
      );
      if (coachCount.rows[0].n <= 1) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          status: 400,
          body: {
            error: 'Não é possível excluir o último coach do sistema.',
            error_code: 'LAST_COACH',
          },
        };
      }
    }

    const userResult = await client.query('SELECT email FROM app_auth.users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      await client.query('DELETE FROM public.user_roles WHERE id = $1', [roleId]);
      await client.query('COMMIT');
      logger.warn('deleteUserByUserRoleId: usuário ausente em app_auth.users, apenas role removido', {
        userId,
        roleId,
      });
      return { ok: true, body: { message: 'Role deletado (usuário não encontrado em app_auth.users)' } };
    }

    const email = userResult.rows[0].email;
    logger.info('deleteUserByUserRoleId: início', { userId, email, roleId });

    const alunoResult = await client.query('DELETE FROM public.alunos WHERE email = $1 RETURNING id', [email]);
    logger.info('deleteUserByUserRoleId: alunos removidos', { count: alunoResult.rows.length, email });

    const profileResult = await client.query('DELETE FROM public.profiles WHERE id = $1 RETURNING id', [userId]);
    logger.info('deleteUserByUserRoleId: profiles removidos', { count: profileResult.rows.length, userId });

    await client.query('DELETE FROM public.user_roles WHERE id = $1', [roleId]);
    logger.info('deleteUserByUserRoleId: user_roles removido', { roleId });

    await client.query('DELETE FROM app_auth.users WHERE id = $1', [userId]);
    logger.info('deleteUserByUserRoleId: app_auth.users removido', { userId, email });

    await client.query('COMMIT');
    return {
      ok: true,
      body: {
        message: 'Usuário deletado com sucesso',
        dependenciasRemovidas: {
          aluno: alunoResult.rows.length,
          profile: profileResult.rows.length,
        },
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('deleteUserByUserRoleId: erro', { error: error.message, roleId });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { deleteUserByUserRoleId };
