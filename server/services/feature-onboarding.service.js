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

const VALID_EVENTS = new Set([
  'eligible',
  'viewed',
  'step_viewed',
  'completed',
  'skipped',
  'dismissed_permanently',
  'reopened',
]);

/** Mapa estado → evento (quando o PUT muda o estado terminal). */
const STATE_TO_EVENT = {
  completed: 'completed',
  skipped: 'skipped',
  dismissed_permanently: 'dismissed_permanently',
};

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
  const item = mapRow(r.rows[0]);
  const eventName = STATE_TO_EVENT[state];
  if (eventName) {
    try {
      await recordEvent(pool, alunoId, {
        onboarding_id: onboardingId,
        event_name: eventName,
        version,
        step_id: null,
      });
    } catch {
      /* métrica não deve falhar o upsert */
    }
  }
  return item;
}

/**
 * Regista evento de onboarding (sem PII). Ignora nomes inválidos.
 */
async function recordEvent(pool, alunoId, payload) {
  const onboardingId = normalizeId(payload.onboarding_id);
  const eventName = String(payload.event_name || '').trim();
  if (!onboardingId) {
    const err = new Error('onboarding_id inválido');
    err.status = 400;
    throw err;
  }
  if (!VALID_EVENTS.has(eventName)) {
    const err = new Error('event_name inválido');
    err.status = 400;
    throw err;
  }
  const version = Math.max(1, parseInt(payload.version, 10) || 1);
  const stepId =
    payload.step_id == null || payload.step_id === ''
      ? null
      : String(payload.step_id).trim().slice(0, 80);

  const r = await pool.query(
    `INSERT INTO public.student_onboarding_events
       (aluno_id, onboarding_id, event_name, version, step_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, onboarding_id, event_name, version, step_id, created_at`,
    [alunoId, onboardingId, eventName, version, stepId],
  );
  return r.rows[0];
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

/**
 * Funil agregado para o coach (sem PII): contagens por tutorial/estado/evento
 * apenas dos alunos do escopo.
 */
async function getFunnelSummary(pool, { coachId, isAdmin }) {
  const alunoFilter = isAdmin
    ? `SELECT id FROM public.alunos`
    : `SELECT id FROM public.alunos WHERE coach_id = $1`;
  const params = isAdmin ? [] : [coachId];

  const prefs = await pool.query(
    `SELECT o.onboarding_id, o.state, count(*)::int AS total
       FROM public.student_feature_onboarding o
      WHERE o.aluno_id IN (${alunoFilter})
      GROUP BY o.onboarding_id, o.state
      ORDER BY o.onboarding_id, o.state`,
    params,
  );

  const events = await pool.query(
    `SELECT e.onboarding_id, e.event_name, count(*)::int AS total
       FROM public.student_onboarding_events e
      WHERE e.aluno_id IN (${alunoFilter})
        AND e.created_at >= now() - interval '30 days'
      GROUP BY e.onboarding_id, e.event_name
      ORDER BY e.onboarding_id, e.event_name`,
    params,
  );

  const alunos = await pool.query(
    `SELECT count(*)::int AS total FROM (${alunoFilter}) a`,
    params,
  );

  return {
    window_days: 30,
    alunos_total: alunos.rows[0]?.total || 0,
    preferences: prefs.rows,
    events_30d: events.rows,
  };
}

module.exports = {
  VALID_STATES,
  VALID_EVENTS,
  listPreferences,
  getPreference,
  upsertPreference,
  recordEvent,
  getFunnelSummary,
};
