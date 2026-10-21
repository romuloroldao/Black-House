/**
 * Carteira de aderência 7d — agregado por aluno do coach (sem N+1).
 */
const {
  todayIso,
  addDaysIso,
  computeAdherenceWindow,
} = require('./behavioral-insight.service');
const { attentionScore, isAdherenceDrop } = require('./adherence-ranking');

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

const PENDING_CHECKIN_SQL = `(
  w.coach_resposta IS NULL
  OR trim(w.coach_resposta) = ''
  OR length(trim(w.coach_resposta)) < 12
  OR lower(trim(w.coach_resposta)) IN (
    '!', 'vi', 'visto', 'visto!', 'visto.', 'ok', 'ok!',
    'feito', 'feito!', 'recebido', 'recebido!'
  )
)`;

function groupSetByAluno(rows, key = 'aluno_id') {
  const map = new Map();
  for (const row of rows) {
    const id = row[key];
    if (!map.has(id)) map.set(id, new Set());
    const val = row.data_ref != null ? String(row.data_ref).slice(0, 10) : Number(row.dia_semana);
    map.get(id).add(val);
  }
  return map;
}

async function getCarteiraAdherence(pool, { coachId, isAdmin = false, days = 7 } = {}) {
  const windowDays = Math.min(30, Math.max(7, Number(days) || 7));
  const end = todayIso();
  const start = addDaysIso(end, -(windowDays - 1));

  const alunosRes = isAdmin
    ? await pool.query(
        `SELECT a.id, a.nome, a.email, a.coach_id,
                COALESCE(NULLIF(TRIM(a.nome), ''), INITCAP(REPLACE(SPLIT_PART(COALESCE(a.email, ''), '@', 1), '.', ' '))) AS nome_exibicao
         FROM public.alunos a
         WHERE COALESCE(a.ativo, true) = true
           AND ${EXCLUDE_STAFF_ALUNOS_SQL}
         ORDER BY a.created_at DESC NULLS LAST
         LIMIT 400`,
      )
    : await pool.query(
        `SELECT a.id, a.nome, a.email, a.coach_id,
                COALESCE(NULLIF(TRIM(a.nome), ''), INITCAP(REPLACE(SPLIT_PART(COALESCE(a.email, ''), '@', 1), '.', ' '))) AS nome_exibicao
         FROM public.alunos a
         WHERE a.coach_id = $1
           AND COALESCE(a.ativo, true) = true
           AND ${EXCLUDE_STAFF_ALUNOS_SQL}
         ORDER BY nome_exibicao ASC NULLS LAST
         LIMIT 400`,
        [coachId],
      );

  const alunos = alunosRes.rows;
  const ids = alunos.map((a) => a.id);
  if (ids.length === 0) {
    return {
      days: windowDays,
      as_of: end,
      items: [],
      attention_count: 0,
      gerado_em: new Date().toISOString(),
    };
  }

  const [dietasRes, mealsRes, workoutsRes, agendaRes, pendingRes] = await Promise.all([
    pool.query(
      `SELECT DISTINCT aluno_id FROM public.dietas
       WHERE aluno_id = ANY($1::uuid[]) AND COALESCE(ativa, true) = true`,
      [ids],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT aluno_id, data_ref::text AS data_ref
       FROM public.refeicao_conclusoes
       WHERE aluno_id = ANY($1::uuid[])
         AND concluido = true
         AND data_ref BETWEEN $2::date AND $3::date`,
      [ids, start, end],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT aluno_id, data_ref::text AS data_ref
       FROM public.treino_sessoes
       WHERE aluno_id = ANY($1::uuid[])
         AND status = 'completed'
         AND data_ref BETWEEN $2::date AND $3::date`,
      [ids, start, end],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT aluno_id, dia_semana FROM public.aluno_treino_agenda
       WHERE aluno_id = ANY($1::uuid[])`,
      [ids],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT DISTINCT ON (w.aluno_id) w.aluno_id, w.id AS checkin_id, w.created_at
       FROM public.weekly_checkins w
       WHERE w.aluno_id = ANY($1::uuid[])
         AND w.created_at >= (now() - interval '30 days')
         AND ${PENDING_CHECKIN_SQL}
       ORDER BY w.aluno_id, w.created_at DESC NULLS LAST`,
      [ids],
    ).catch(() => ({ rows: [] })),
  ]);

  const dietaSet = new Set(dietasRes.rows.map((r) => r.aluno_id));
  const mealsByAluno = groupSetByAluno(mealsRes.rows);
  const workoutsByAluno = groupSetByAluno(workoutsRes.rows);
  const agendaByAluno = groupSetByAluno(agendaRes.rows);
  const pendingByAluno = new Map(pendingRes.rows.map((r) => [r.aluno_id, r]));

  const items = alunos.map((aluno) => {
    const metrics = computeAdherenceWindow({
      days: windowDays,
      end,
      hasActiveDieta: dietaSet.has(aluno.id),
      mealDays: mealsByAluno.get(aluno.id) || new Set(),
      workoutCompletedDays: workoutsByAluno.get(aluno.id) || new Set(),
      agendaDias: agendaByAluno.get(aluno.id) || new Set(),
    });
    const pending = pendingByAluno.get(aluno.id);
    const checkin_pendente = Boolean(pending);
    const score = attentionScore({
      checkin_pendente,
      miss_days_recent: metrics.miss_days_recent,
      meal_pct: metrics.rates.meal_pct,
      workout_pct: metrics.rates.workout_pct,
    });
    const drop = isAdherenceDrop({
      miss_days_recent: metrics.miss_days_recent,
      meal_pct: metrics.rates.meal_pct,
      workout_pct: metrics.rates.workout_pct,
    });
    return {
      aluno_id: aluno.id,
      nome: aluno.nome_exibicao || aluno.nome || aluno.email || 'Aluno',
      checkin_pendente,
      checkin_id: pending?.checkin_id || null,
      attention_score: score,
      adherence_drop: drop,
      streak_days: metrics.streak_days,
      miss_days_recent: metrics.miss_days_recent,
      rates: metrics.rates,
    };
  });

  items.sort((a, b) => {
    if (b.attention_score !== a.attention_score) return b.attention_score - a.attention_score;
    return (b.miss_days_recent || 0) - (a.miss_days_recent || 0);
  });

  return {
    days: windowDays,
    as_of: end,
    items,
    attention_count: items.filter((i) => i.attention_score > 0).length,
    drop_count: items.filter((i) => i.adherence_drop).length,
    pending_checkin_count: items.filter((i) => i.checkin_pendente).length,
    gerado_em: new Date().toISOString(),
  };
}

module.exports = {
  getCarteiraAdherence,
};
