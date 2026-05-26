/**
 * Escopo de coach (titular + equipa / assistentes).
 */
const logger = require('../utils/logger');

/**
 * @returns {Promise<{
 *   ownerCoachId: string,
 *   coachIds: string[],
 *   canWrite: boolean,
 *   isAssistant: boolean,
 *   isAdmin: boolean,
 * }>}
 */
async function resolveCoachScope(pool, userId, userRole) {
  if (userRole === 'admin') {
    return {
      ownerCoachId: userId,
      coachIds: null,
      canWrite: true,
      isAssistant: false,
      isAdmin: true,
    };
  }

  // Aluno não usa escopo de equipa; evita SELECT em coach_team_members (sem GRANT para app_user).
  if (userRole === 'aluno') {
    return {
      ownerCoachId: null,
      coachIds: [],
      canWrite: false,
      isAssistant: false,
      isAdmin: false,
    };
  }

  // app_user pode não ter GRANT em coach_team_members (migração antiga); fallback = só titular.
  let teamRows = { rows: [] };
  try {
    teamRows = await pool.query(
      `SELECT owner_coach_id, team_role
       FROM public.coach_team_members
       WHERE member_user_id = $1 AND ativo = true`,
      [userId],
    );
  } catch (err) {
    if (err.code === '42501') {
      logger.warn('coach_team_members: sem permissão DB — escopo só do coach titular', {
        userId,
        code: err.code,
      });
    } else {
      throw err;
    }
  }

  if (teamRows.rows.length > 0) {
    const ownerCoachId = teamRows.rows[0].owner_coach_id;
    const canWrite = teamRows.rows.some((r) => r.team_role === 'assistant');
    return {
      ownerCoachId,
      coachIds: [...new Set(teamRows.rows.map((r) => r.owner_coach_id))],
      canWrite,
      isAssistant: true,
      isAdmin: false,
    };
  }

  return {
    ownerCoachId: userId,
    coachIds: [userId],
    canWrite: userRole === 'coach' || userRole === 'assistant',
    isAssistant: false,
    isAdmin: false,
  };
}

function coachIdSqlFilter(scope, paramIndexStart = 1) {
  if (scope.isAdmin && scope.coachIds === null) {
    return { clause: '1=1', params: [], nextIndex: paramIndexStart };
  }
  return {
    clause: `coach_id = ANY($${paramIndexStart}::uuid[])`,
    params: [scope.coachIds],
    nextIndex: paramIndexStart + 1,
  };
}

async function assertCoachCanAccessAluno(pool, scope, alunoId) {
  if (scope.isAdmin && scope.coachIds === null) return true;
  const r = await pool.query(
    `SELECT id FROM public.alunos WHERE id = $1 AND coach_id = ANY($2::uuid[])`,
    [alunoId, scope.coachIds],
  );
  return r.rows.length > 0;
}

async function listTeamMembers(pool, ownerCoachId) {
  const r = await pool.query(
    `SELECT m.id, m.member_user_id, m.team_role, m.ativo, m.created_at,
            u.email AS member_email,
            cp.nome_completo AS member_nome
     FROM public.coach_team_members m
     JOIN app_auth.users u ON u.id = m.member_user_id
     LEFT JOIN public.coach_profiles cp ON cp.user_id = m.member_user_id
     WHERE m.owner_coach_id = $1
     ORDER BY m.created_at DESC`,
    [ownerCoachId],
  );
  return r.rows;
}

async function addTeamMember(pool, ownerCoachId, { member_email, team_role = 'assistant' }) {
  const email = String(member_email || '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Email do assistente inválido');

  const userR = await pool.query(`SELECT id FROM app_auth.users WHERE lower(email) = $1 LIMIT 1`, [
    email,
  ]);
  if (!userR.rows[0]) {
    throw new Error('Utilizador não encontrado. O assistente deve ter conta na plataforma.');
  }
  const memberUserId = userR.rows[0].id;
  if (memberUserId === ownerCoachId) {
    throw new Error('Não é possível adicionar o próprio titular como assistente');
  }

  const roleAllowed = new Set(['assistant', 'viewer']);
  if (!roleAllowed.has(team_role)) throw new Error('team_role inválido');

  await pool.query(
    `INSERT INTO public.user_roles (user_id, role)
     VALUES ($1, 'assistant')
     ON CONFLICT (user_id) DO UPDATE SET role = 'assistant'`,
    [memberUserId],
  );

  const ins = await pool.query(
    `INSERT INTO public.coach_team_members (owner_coach_id, member_user_id, team_role)
     VALUES ($1, $2, $3)
     ON CONFLICT (owner_coach_id, member_user_id)
     DO UPDATE SET team_role = EXCLUDED.team_role, ativo = true
     RETURNING *`,
    [ownerCoachId, memberUserId, team_role],
  );

  logger.info('coach_team.member_added', { ownerCoachId, memberUserId, team_role });
  return ins.rows[0];
}

async function removeTeamMember(pool, ownerCoachId, memberId) {
  const r = await pool.query(
    `UPDATE public.coach_team_members
     SET ativo = false
     WHERE id = $1 AND owner_coach_id = $2
     RETURNING id`,
    [memberId, ownerCoachId],
  );
  return r.rows[0] || null;
}

module.exports = {
  resolveCoachScope,
  coachIdSqlFilter,
  assertCoachCanAccessAluno,
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
};
