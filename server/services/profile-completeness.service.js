/**
 * Completude de perfil do aluno: validação, grace period e hard gate.
 */

const {
  getEffectivePesoKg,
  getEffectiveAlturaCm,
  isValidPhoneBR,
  parseSexo,
} = require('./body-metrics.service');

const REQUIRED_FIELDS = [
  'nome',
  'email',
  'telefone',
  'data_nascimento',
  'sexo',
  'peso_kg',
  'altura_cm',
];

const FIELD_LABELS = {
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'WhatsApp',
  data_nascimento: 'Data de nascimento',
  sexo: 'Sexo',
  peso_kg: 'Peso',
  altura_cm: 'Altura',
};

const GRACE_LOGINS_MAX = 5;
const GRACE_DAYS = 14;

function evaluateAlunoProfile(aluno) {
  const missing = [];

  if (!String(aluno?.nome ?? '').trim() || String(aluno.nome).trim().length < 2) {
    missing.push('nome');
  }
  if (!String(aluno?.email ?? '').trim()) {
    missing.push('email');
  }
  if (!isValidPhoneBR(aluno?.telefone)) {
    missing.push('telefone');
  }
  if (!aluno?.data_nascimento) {
    missing.push('data_nascimento');
  }
  if (!parseSexo(aluno?.sexo)) {
    missing.push('sexo');
  }
  if (getEffectivePesoKg(aluno) == null) {
    missing.push('peso_kg');
  }
  if (getEffectiveAlturaCm(aluno) == null) {
    missing.push('altura_cm');
  }

  const completion_pct = Math.round(
    ((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100,
  );

  return {
    is_complete: missing.length === 0,
    missing_fields: missing,
    completion_pct,
    field_labels: FIELD_LABELS,
  };
}

function computeHardGate(stateRow, evaluation) {
  if (evaluation.is_complete) return false;
  if (process.env.PROFILE_HARD_GATE === 'true') return true;
  if (stateRow?.hard_gate_active) return true;
  if ((stateRow?.profile_grace_logins ?? 0) >= GRACE_LOGINS_MAX) return true;
  if (stateRow?.grace_expires_at && new Date(stateRow.grace_expires_at) < new Date()) {
    return true;
  }
  return false;
}

async function ensureProfileStateRow(client, aluno) {
  const r = await client.query(`SELECT * FROM public.student_profile_state WHERE aluno_id = $1`, [
    aluno.id,
  ]);
  if (r.rows[0]) {
    return { ...r.rows[0], profile_grace_logins: aluno.profile_grace_logins ?? 0 };
  }

  const graceExpires = new Date();
  graceExpires.setDate(graceExpires.getDate() + GRACE_DAYS);
  await client.query(
    `INSERT INTO public.student_profile_state (aluno_id, coach_id, grace_expires_at, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (aluno_id) DO NOTHING`,
    [aluno.id, aluno.coach_id || null, graceExpires.toISOString()],
  );
  const r2 = await client.query(`SELECT * FROM public.student_profile_state WHERE aluno_id = $1`, [
    aluno.id,
  ]);
  return { ...r2.rows[0], profile_grace_logins: aluno.profile_grace_logins ?? 0 };
}

async function refreshProfileState(pool, aluno, { incrementLogin = false } = {}) {
  const evaluation = evaluateAlunoProfile(aluno);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateRow = await ensureProfileStateRow(client, aluno);

    let graceLogins = Number(aluno.profile_grace_logins ?? stateRow.profile_grace_logins ?? 0);
    if (incrementLogin && !evaluation.is_complete) {
      graceLogins += 1;
      await client.query(`UPDATE public.alunos SET profile_grace_logins = $1 WHERE id = $2`, [
        graceLogins,
        aluno.id,
      ]);
    }

    const mergedState = { ...stateRow, profile_grace_logins: graceLogins };
    const hard_gate_active = computeHardGate(mergedState, evaluation);

    if (evaluation.is_complete) {
      await client.query(
        `UPDATE public.alunos SET profile_completed_at = COALESCE(profile_completed_at, now()) WHERE id = $1`,
        [aluno.id],
      );
    }

    await client.query(
      `INSERT INTO public.student_profile_state
         (aluno_id, coach_id, is_complete, missing_fields, completion_pct,
          grace_expires_at, hard_gate_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (aluno_id) DO UPDATE SET
         coach_id = EXCLUDED.coach_id,
         is_complete = EXCLUDED.is_complete,
         missing_fields = EXCLUDED.missing_fields,
         completion_pct = EXCLUDED.completion_pct,
         hard_gate_active = EXCLUDED.hard_gate_active,
         updated_at = now()`,
      [
        aluno.id,
        aluno.coach_id || null,
        evaluation.is_complete,
        evaluation.missing_fields,
        evaluation.completion_pct,
        stateRow.grace_expires_at || null,
        hard_gate_active,
      ],
    );

    await client.query('COMMIT');

    return {
      ...evaluation,
      hard_gate_active,
      grace_expires_at: stateRow.grace_expires_at,
      grace_logins: graceLogins,
      grace_logins_max: GRACE_LOGINS_MAX,
      profile_completed_at: evaluation.is_complete ? aluno.profile_completed_at : null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getProfileStatus(pool, aluno, options) {
  return refreshProfileState(pool, aluno, options);
}

async function assertProfileAllowsAction(pool, aluno) {
  const status = await getProfileStatus(pool, aluno, { incrementLogin: false });
  if (status.hard_gate_active && !status.is_complete) {
    const err = new Error('Complete seu perfil antes de continuar');
    err.code = 'PROFILE_INCOMPLETE';
    err.status = 403;
    err.details = status;
    throw err;
  }
  return status;
}

module.exports = {
  REQUIRED_FIELDS,
  FIELD_LABELS,
  GRACE_LOGINS_MAX,
  GRACE_DAYS,
  evaluateAlunoProfile,
  refreshProfileState,
  getProfileStatus,
  assertProfileAllowsAction,
};
