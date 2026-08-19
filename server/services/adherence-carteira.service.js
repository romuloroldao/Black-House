/**
 * Carteira de aderência 7d do coach — agregação em lote (sem N+1).
 * Reutiliza computeWindowMetrics (insight 7d) e totais de task_adherence_events.
 */
const {
  todayIso,
  addDaysIso,
  computeWindowMetrics,
} = require('./behavioral-insight.service');
const {
  computeAdherenceAttentionScore,
  isQuedaExecucao7d,
} = require('./adherence-carteira-score');

const PENDING_CHECKIN_WHERE = `(
  w.coach_resposta IS NULL
  OR trim(w.coach_resposta) = ''
  OR length(trim(w.coach_resposta)) < 12
  OR lower(trim(w.coach_resposta)) IN (
    '!', 'vi', 'visto', 'visto!', 'visto.', 'ok', 'ok!',
    'feito', 'feito!', 'recebido', 'recebido!'
  )
)`;

const EXCLUDE_STAFF_ALUNOS_SQL = `
  NOT EXISTS (
    SELECT 1
    FROM app_auth.users u
    INNER JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE ur.role IN ('coach', 'admin')
      AND (
        LOWER(TRIM(COALESCE(u.email, ''))) = LOWER(TRIM(COALESCE(a.email, '')))
        OR u.id = a.user_id
      )
  )`;

async function tableExists(pool, name) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name],
  );
  return r.rows.length > 0;
}

function emptyAdherence() {
  return {
    totals: { completed: 0, missed: 0, cancelled: 0 },
    completion_rate: null,
    available: false,
  };
}

function displayName(row) {
  const fromNome = row.nome && String(row.nome).trim();
  if (fromNome) return fromNome;
  const email = row.email ? String(row.email) : '';
  const local = email.split('@')[0] || 'Aluno';
  return local
    .split('.')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || 'Aluno';
}

/**
 * @param {object} pool
 * @param {{ coachIds: string[] | null, isAdmin?: boolean, days?: number, asOf?: string }} opts
 */
async function getAdherenceCarteira(pool, { coachIds, isAdmin = false, days = 7, asOf } = {}) {
  const windowDays = Math.min(30, Math.max(7, Number(days) || 7));
  const end = asOf || todayIso();
  const start = addDaysIso(end, -(windowDays - 1));

  const params = [];
  let alunoWhere = EXCLUDE_STAFF_ALUNOS_SQL;
  if (!(isAdmin && (coachIds == null || coachIds === undefined))) {
    const ids = Array.isArray(coachIds) ? coachIds.filter(Boolean) : [];
    if (ids.length === 0) {
      return {
        days: windowDays,
        as_of: end,
        gerado_em: new Date().toISOString(),
        items: [],
      };
    }
    params.push(ids);
    alunoWhere = `a.coach_id = ANY($1::uuid[]) AND ${EXCLUDE_STAFF_ALUNOS_SQL}`;
  }

  const alunosRes = await pool.query(
    `SELECT a.id, a.nome, a.email, a.coach_id
     FROM public.alunos a
     WHERE ${alunoWhere}
     ORDER BY a.nome ASC NULLS LAST, a.created_at DESC NULLS LAST
     LIMIT 2000`,
    params,
  );

  const alunos = alunosRes.rows;
  if (alunos.length === 0) {
    return {
      days: windowDays,
      as_of: end,
      gerado_em: new Date().toISOString(),
      items: [],
    };
  }

  const alunoIds = alunos.map((a) => a.id);
  const [
    hasMeals,
    hasWorkouts,
    hasAgenda,
    hasDietas,
    hasCheckins,
    hasEvents,
  ] = await Promise.all([
    tableExists(pool, 'refeicao_conclusoes'),
    tableExists(pool, 'treino_sessoes'),
    tableExists(pool, 'aluno_treino_agenda'),
    tableExists(pool, 'dietas'),
    tableExists(pool, 'weekly_checkins'),
    tableExists(pool, 'task_adherence_events'),
  ]);

  const sinceTs = new Date(`${start}T00:00:00.000Z`).toISOString();

  const [dietasRes, mealsRes, workoutsRes, agendaRes, pendingRes, eventsRes] = await Promise.all([
    hasDietas
      ? pool.query(
          `SELECT DISTINCT aluno_id
           FROM public.dietas
           WHERE aluno_id = ANY($1::uuid[])
             AND COALESCE(ativa, true) = true`,
          [alunoIds],
        )
      : Promise.resolve({ rows: [] }),
    hasMeals
      ? pool.query(
          `SELECT aluno_id, data_ref::text AS data_ref
           FROM public.refeicao_conclusoes
           WHERE aluno_id = ANY($1::uuid[])
             AND concluido = true
             AND data_ref BETWEEN $2::date AND $3::date`,
          [alunoIds, start, end],
        )
      : Promise.resolve({ rows: [] }),
    hasWorkouts
      ? pool.query(
          `SELECT aluno_id, data_ref::text AS data_ref
           FROM public.treino_sessoes
           WHERE aluno_id = ANY($1::uuid[])
             AND status = 'completed'
             AND data_ref BETWEEN $2::date AND $3::date`,
          [alunoIds, start, end],
        )
      : Promise.resolve({ rows: [] }),
    hasAgenda
      ? pool.query(
          `SELECT aluno_id, dia_semana
           FROM public.aluno_treino_agenda
           WHERE aluno_id = ANY($1::uuid[])`,
          [alunoIds],
        )
      : Promise.resolve({ rows: [] }),
    hasCheckins
      ? pool.query(
          `SELECT DISTINCT w.aluno_id
           FROM public.weekly_checkins w
           WHERE w.aluno_id = ANY($1::uuid[])
             AND ${PENDING_CHECKIN_WHERE}
             AND w.created_at >= (now() - interval '30 days')`,
          [alunoIds],
        )
      : Promise.resolve({ rows: [] }),
    hasEvents
      ? pool.query(
          `SELECT aluno_id, outcome, COUNT(*)::int AS total
           FROM public.task_adherence_events
           WHERE aluno_id = ANY($1::uuid[])
             AND occurred_at >= $2::timestamptz
           GROUP BY aluno_id, outcome`,
          [alunoIds, sinceTs],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const dietaSet = new Set(dietasRes.rows.map((r) => r.aluno_id));
  const pendingSet = new Set(pendingRes.rows.map((r) => r.aluno_id));

  const mealsByAluno = new Map();
  for (const row of mealsRes.rows) {
    if (!mealsByAluno.has(row.aluno_id)) mealsByAluno.set(row.aluno_id, new Set());
    mealsByAluno.get(row.aluno_id).add(String(row.data_ref).slice(0, 10));
  }

  const workoutsByAluno = new Map();
  for (const row of workoutsRes.rows) {
    if (!workoutsByAluno.has(row.aluno_id)) workoutsByAluno.set(row.aluno_id, new Set());
    workoutsByAluno.get(row.aluno_id).add(String(row.data_ref).slice(0, 10));
  }

  const agendaByAluno = new Map();
  for (const row of agendaRes.rows) {
    if (!agendaByAluno.has(row.aluno_id)) agendaByAluno.set(row.aluno_id, new Set());
    agendaByAluno.get(row.aluno_id).add(Number(row.dia_semana));
  }

  const eventsByAluno = new Map();
  for (const row of eventsRes.rows) {
    if (!eventsByAluno.has(row.aluno_id)) {
      eventsByAluno.set(row.aluno_id, { completed: 0, missed: 0, cancelled: 0 });
    }
    const entry = eventsByAluno.get(row.aluno_id);
    if (row.outcome in entry) entry[row.outcome] = row.total;
  }

  const items = alunos.map((aluno) => {
    const metrics = computeWindowMetrics({
      days: windowDays,
      end,
      hasActiveDieta: dietaSet.has(aluno.id),
      mealDays: mealsByAluno.get(aluno.id) || new Set(),
      workoutCompletedDays: workoutsByAluno.get(aluno.id) || new Set(),
      agendaDias: agendaByAluno.get(aluno.id) || new Set(),
    });

    const pendingCheckin = pendingSet.has(aluno.id);
    const scored = computeAdherenceAttentionScore({
      pendingCheckin,
      missDays: metrics.miss_days,
      mealPct: metrics.meal_pct,
      workoutPct: metrics.workout_pct,
    });

    const totals = eventsByAluno.get(aluno.id) || { completed: 0, missed: 0, cancelled: 0 };
    const denom = totals.completed + totals.missed;
    const adherence = hasEvents
      ? {
          totals,
          completion_rate: denom > 0 ? Math.round((totals.completed / denom) * 100) : null,
          available: true,
        }
      : emptyAdherence();

    return {
      aluno_id: aluno.id,
      nome: displayName(aluno),
      email: aluno.email || null,
      streak_days: metrics.streak_days,
      miss_days: metrics.miss_days,
      rates: {
        meal_pct: metrics.meal_pct,
        workout_pct: metrics.workout_pct,
        meal_days: metrics.meal_days,
        meal_expected: metrics.meal_expected,
        workout_done: metrics.workout_done,
        workout_expected: metrics.workout_expected,
      },
      pending_checkin: pendingCheckin,
      queda_aderencia: isQuedaExecucao7d({
        missDays: metrics.miss_days,
        mealPct: metrics.meal_pct,
        workoutPct: metrics.workout_pct,
      }),
      attention_score: scored.score,
      reasons: scored.reasons,
      adherence,
    };
  });

  items.sort((a, b) => {
    if (b.attention_score !== a.attention_score) return b.attention_score - a.attention_score;
    return String(a.nome).localeCompare(String(b.nome), 'pt');
  });

  return {
    days: windowDays,
    as_of: end,
    gerado_em: new Date().toISOString(),
    items,
  };
}

module.exports = {
  getAdherenceCarteira,
  PENDING_CHECKIN_WHERE,
};
