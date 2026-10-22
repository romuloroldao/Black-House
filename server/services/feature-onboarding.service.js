/**
 * Preferências de onboarding contextual do aluno.
 * Estados: never | in_progress | completed | skipped | dismissed_permanently
 */

const VALID_STATES = new Set([
  'never',
  'in_progress',
  'completed',
  'skipped',
  'dismissed_permanently',
]);

function normalizeId(id) {
  return String(id || '')
    .trim()
    .slice(0, 80);
}

async function listPreferences(pool, alunoId) {
  const r = await pool.query(
    `SELECT onboarding_id, version, state, dismiss_permanently, current_step,
            completed_at, updated_at
       FROM public.student_feature_onboarding
      WHERE aluno_id = $1
      ORDER BY onboarding_id`,
    [alunoId],
  );
  return r.rows.map(mapRow);
}

async function getPreference(pool, alunoId, onboardingId) {
  const id = normalizeId(onboardingId);
  if (!id) return null;
  const r = await pool.query(
    `SELECT onboarding_id, version, state, dismiss_permanently, current_step,
            completed_at, updated_at
       FROM public.student_feature_onboarding
      WHERE aluno_id = $1 AND onboarding_id = $2`,
    [alunoId, id],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

/**
 * Upsert preferência. Não permite que outro aluno seja afetado (alunoId vem do auth).
 */
async function upsertPreference(pool, alunoId, payload) {
  const onboardingId = normalizeId(payload.onboarding_id);
  if (!onboardingId) {
    const err = new Error('onboarding_id inválido');
    err.status = 400;
    throw err;
  }

  const state = String(payload.state || '').trim();
  if (!VALID_STATES.has(state)) {
    const err = new Error('state inválido');
    err.status = 400;
    throw err;
  }

  const version = Math.max(1, parseInt(payload.version, 10) || 1);
  const currentStep = Math.max(0, parseInt(payload.current_step, 10) || 0);
  const dismiss =
    state === 'dismissed_permanently'
      ? true
      : Boolean(payload.dismiss_permanently);

  const completedAt =
    state === 'completed' || state === 'dismissed_permanently'
      ? new Date().toISOString()
      : null;

  const r = await pool.query(
    `INSERT INTO public.student_feature_onboarding AS t
       (aluno_id, onboarding_id, version, state, dismiss_permanently, current_step, completed_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (aluno_id, onboarding_id) DO UPDATE SET
       version = EXCLUDED.version,
       state = EXCLUDED.state,
       dismiss_permanently = EXCLUDED.dismiss_permanently,
       current_step = EXCLUDED.current_step,
       completed_at = COALESCE(EXCLUDED.completed_at, t.completed_at),
       updated_at = now()
     RETURNING onboarding_id, version, state, dismiss_permanently, current_step, completed_at, updated_at`,
    [alunoId, onboardingId, version, state, dismiss, currentStep, completedAt],
  );
  return mapRow(r.rows[0]);
}

function mapRow(row) {
  return {
    onboarding_id: row.onboarding_id,
    version: Number(row.version) || 1,
    state: row.state,
    dismiss_permanently: Boolean(row.dismiss_permanently),
    current_step: Number(row.current_step) || 0,
    completed_at: row.completed_at || null,
    updated_at: row.updated_at || null,
  };
}

module.exports = {
  VALID_STATES,
  listPreferences,
  getPreference,
  upsertPreference,
};
