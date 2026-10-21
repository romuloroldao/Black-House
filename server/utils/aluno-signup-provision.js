/**
 * Provisiona fichas (public.alunos) para cadastros na plataforma.
 * Resolve o gap: signup cria app_auth.users mas não criava linha em alunos.
 */

const { getAlunoUserLinkColumn } = require('./aluno-link-column');
const { emailAfterLink } = require('./aluno-email-utils');
const { resolveUserDisplayName, nomeAfterLink } = require('./user-display-name');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidCoachId(id) {
  return typeof id === 'string' && UUID_RE.test(id.trim());
}

async function coachExists(pool, coachId) {
  const r = await pool.query(
    `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'coach' LIMIT 1`,
    [coachId],
  );
  return r.rows.length > 0;
}

async function findAlunoByUserId(pool, linkCol, userId) {
  const r = await pool.query(
    `SELECT id, coach_id, nome, email, ${linkCol} AS link_user_id
     FROM public.alunos WHERE ${linkCol} = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0] || null;
}

async function findAlunoByEmail(pool, linkCol, email) {
  const r = await pool.query(
    `SELECT id, coach_id, nome, email, ${linkCol} AS link_user_id
     FROM public.alunos
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
       AND email NOT LIKE '%@blackhouse.local'
     LIMIT 1`,
    [email],
  );
  return r.rows[0] || null;
}

/**
 * Cria ou vincula ficha após signup (ou adoção pelo coach).
 * @returns {Promise<{ alunoId: string, created: boolean, linked: boolean }|null>}
 */
async function resolveSignupProfileFromMeta(pool, userId, overrides = {}) {
  let cpf = overrides.cpf_cnpj != null ? String(overrides.cpf_cnpj).replace(/\D/g, '') : null;
  let peso =
    overrides.peso != null && overrides.peso !== '' && Number.isFinite(Number(overrides.peso))
      ? Math.round(Number(overrides.peso))
      : null;
  let altura =
    overrides.altura != null && overrides.altura !== '' && Number.isFinite(Number(overrides.altura))
      ? Math.round(Number(overrides.altura))
      : null;

  if ((!cpf || peso == null || altura == null) && userId) {
    const metaRow = await pool.query(
      `SELECT raw_user_meta_data FROM app_auth.users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const meta = metaRow.rows[0]?.raw_user_meta_data || {};
    if (!cpf && meta.signup_cpf_cnpj) {
      cpf = String(meta.signup_cpf_cnpj).replace(/\D/g, '');
    }
    if (peso == null && meta.signup_peso != null) {
      peso = Math.round(Number(meta.signup_peso));
    }
    if (altura == null && meta.signup_altura != null) {
      altura = Math.round(Number(meta.signup_altura));
    }
  }

  return { cpf_cnpj: cpf || null, peso, altura };
}

async function provisionAlunoForUser(
  pool,
  { userId, email, fullName, coachId, cpf_cnpj: cpfCnpj, peso, altura },
) {
  if (!userId || !email) return null;

  const linkCol = await getAlunoUserLinkColumn(pool);
  const normalizedEmail = String(email).trim().toLowerCase();
  const profileFields = await resolveSignupProfileFromMeta(pool, userId, {
    cpf_cnpj: cpfCnpj,
    peso,
    altura,
  });
  const cpfDigits = profileFields.cpf_cnpj;
  const pesoVal = profileFields.peso;
  const alturaVal = profileFields.altura;
  let nome =
    fullName && String(fullName).trim() ? String(fullName).trim() : null;
  if (!nome) {
    nome = await resolveUserDisplayName(pool, userId);
  }

  const existingByUser = await findAlunoByUserId(pool, linkCol, userId);
  if (existingByUser) {
    await pool.query(
      `UPDATE public.alunos
       SET nome = COALESCE(NULLIF(TRIM($1), ''), nome),
           cpf_cnpj = COALESCE($2, cpf_cnpj),
           peso = COALESCE($3, peso),
           altura = COALESCE($4, altura)
       WHERE id = $5`,
      [nome, cpfDigits, pesoVal, alturaVal, existingByUser.id],
    );
    return {
      alunoId: existingByUser.id,
      created: false,
      linked: true,
    };
  }

  const existingByEmail = await findAlunoByEmail(pool, linkCol, normalizedEmail);
  if (existingByEmail) {
    if (!existingByEmail.link_user_id) {
      const coachFallback = coachId && (await coachExists(pool, coachId)) ? coachId : null;
      const resolvedEmail = emailAfterLink(existingByEmail.email, normalizedEmail);
      await pool.query(
        `UPDATE public.alunos
         SET ${linkCol} = $1,
             coach_id = COALESCE(coach_id, $2::uuid),
             nome = COALESCE(NULLIF(TRIM(nome), ''), $3),
             email = $5,
             cpf_cnpj = COALESCE($6, cpf_cnpj),
             peso = COALESCE($7, peso),
             altura = COALESCE($8, altura)
         WHERE id = $4`,
        [
          userId,
          coachFallback,
          nome,
          existingByEmail.id,
          resolvedEmail,
          cpfDigits,
          pesoVal,
          alturaVal,
        ],
      );
    }
    return {
      alunoId: existingByEmail.id,
      created: false,
      linked: true,
    };
  }

  if (!coachId || !(await coachExists(pool, coachId))) {
    return null;
  }

  const ins = await pool.query(
    `INSERT INTO public.alunos (coach_id, ${linkCol}, nome, email, cpf_cnpj, peso, altura)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [coachId, userId, nome, normalizedEmail, cpfDigits, pesoVal, alturaVal],
  );

  return {
    alunoId: ins.rows[0].id,
    created: true,
    linked: true,
  };
}

/**
 * Utilizadores com role aluno sem ficha vinculada (nem por user_id nem por email real).
 */
async function listUnlinkedRegistrations(pool, { limit = 100 } = {}) {
  const linkCol = await getAlunoUserLinkColumn(pool);
  const r = await pool.query(
    `SELECT u.id AS user_id,
            u.email,
            u.created_at,
            u.email_confirmed_at
     FROM app_auth.users u
     INNER JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'aluno'
     WHERE NOT EXISTS (
       SELECT 1 FROM public.alunos a WHERE a.${linkCol} = u.id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.alunos a
       WHERE LOWER(TRIM(a.email)) = LOWER(TRIM(u.email))
         AND a.email NOT LIKE '%@blackhouse.local'
     )
     ORDER BY u.created_at DESC NULLS LAST
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );
  return r.rows;
}

module.exports = {
  isValidCoachId,
  coachExists,
  provisionAlunoForUser,
  listUnlinkedRegistrations,
};
