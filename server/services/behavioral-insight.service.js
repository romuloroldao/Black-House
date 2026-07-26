/**
 * Phase 5 — Behavioral Intelligence
 * Agrega execução recente (refeições + treinos) e gera insight de 1 frase.
 */
const crypto = require('crypto');

function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso, delta) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday 1=Mon … 7=Sun (UTC date string) */
function isoWeekday(iso) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

function stableUuid(seed) {
  const hash = crypto.createHash('sha256').update(String(seed)).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function tableExists(pool, name) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name],
  );
  return r.rows.length > 0;
}

/**
 * Calcula insight comportamental para um aluno (janela default 7 dias).
 */
async function getBehavioralInsight(pool, aluno, { days = 7, asOf } = {}) {
  const alunoId = aluno?.id;
  if (!alunoId) {
    return { available: false, text: null };
  }

  const end = asOf || todayIso();
  const start = addDaysIso(end, -(days - 1));
  const hasMeals = await tableExists(pool, 'refeicao_conclusoes');
  const hasWorkouts = await tableExists(pool, 'treino_sessoes');
  const hasAgenda = await tableExists(pool, 'aluno_treino_agenda');
  const hasDietas = await tableExists(pool, 'dietas');

  let hasActiveDieta = false;
  if (hasDietas) {
    const d = await pool.query(
      `SELECT 1 FROM public.dietas
       WHERE aluno_id = $1 AND COALESCE(ativa, true) = true
       LIMIT 1`,
      [alunoId],
    );
    hasActiveDieta = d.rows.length > 0;
  }

  const mealDays = new Set();
  if (hasMeals) {
    const r = await pool.query(
      `SELECT DISTINCT data_ref::text AS data_ref
       FROM public.refeicao_conclusoes
       WHERE aluno_id = $1
         AND concluido = true
         AND data_ref BETWEEN $2::date AND $3::date`,
      [alunoId, start, end],
    );
    for (const row of r.rows) mealDays.add(String(row.data_ref).slice(0, 10));
  }

  const workoutCompletedDays = new Set();
  if (hasWorkouts) {
    const r = await pool.query(
      `SELECT DISTINCT data_ref::text AS data_ref
       FROM public.treino_sessoes
       WHERE aluno_id = $1
         AND status = 'completed'
         AND data_ref BETWEEN $2::date AND $3::date`,
      [alunoId, start, end],
    );
    for (const row of r.rows) workoutCompletedDays.add(String(row.data_ref).slice(0, 10));
  }

  /** dias da semana com treino agendado */
  const agendaDias = new Set();
  if (hasAgenda) {
    const r = await pool.query(
      `SELECT dia_semana FROM public.aluno_treino_agenda WHERE aluno_id = $1`,
      [alunoId],
    );
    for (const row of r.rows) agendaDias.add(Number(row.dia_semana));
  }

  let mealExpectedDays = 0;
  let mealDoneDays = 0;
  let workoutExpectedDays = 0;
  let workoutDoneDays = 0;
  let missDays = 0;
  let streak = 0;

  for (let i = 0; i < days; i++) {
    const day = addDaysIso(end, -i);
    const wd = isoWeekday(day);
    const mealOk = mealDays.has(day);
    const workoutExpected = agendaDias.size > 0 ? agendaDias.has(wd) : false;
    const workoutOk = workoutCompletedDays.has(day);

    if (hasActiveDieta) {
      mealExpectedDays += 1;
      if (mealOk) mealDoneDays += 1;
    }
    if (workoutExpected) {
      workoutExpectedDays += 1;
      if (workoutOk) workoutDoneDays += 1;
    }

    // Misses: só dias fechados (não conta o dia corrente)
    if (i > 0) {
      if ((hasActiveDieta && !mealOk) || (workoutExpected && !workoutOk)) {
        missDays += 1;
      }
    }
  }

  for (let i = 0; i < days; i++) {
    const day = addDaysIso(end, -i);
    const wd = isoWeekday(day);
    const mealOk = mealDays.has(day);
    const workoutExpected = agendaDias.size > 0 ? agendaDias.has(wd) : false;
    const workoutOk = workoutCompletedDays.has(day);
    const noExpectation = !hasActiveDieta && !workoutExpected;
    const ok =
      noExpectation ||
      ((!hasActiveDieta || mealOk) && (!workoutExpected || workoutOk));
    if (ok) streak += 1;
    else break;
  }

  const mealRate =
    mealExpectedDays > 0 ? Math.round((mealDoneDays / mealExpectedDays) * 100) : null;
  const workoutRate =
    workoutExpectedDays > 0
      ? Math.round((workoutDoneDays / workoutExpectedDays) * 100)
      : null;

  let tone = 'neutral';
  let text = 'Continua a registar o dia — eu ajudo no próximo passo.';

  if (streak >= 5 && (mealRate == null || mealRate >= 70)) {
    tone = 'positive';
    text = `${streak} dias seguidos no plano. Mantém o ritmo.`;
  } else if (streak >= 3) {
    tone = 'positive';
    text = `Streak de ${streak} dias. Bom trabalho — o que falta hoje?`;
  } else if (missDays >= 3) {
    tone = 'nudge';
    text = `Nos últimos dias faltaram alguns registos (${missDays}). Sem stress — vamos ao próximo.`;
  } else if (mealRate != null && mealRate < 40) {
    tone = 'nudge';
    text = 'As refeições andam irregulares. Marca a próxima quando puderes.';
  } else if (workoutRate != null && workoutRate < 50) {
    tone = 'nudge';
    text = 'O treino tem falhado nalguns dias. Quando fores à sessão, regista série a série.';
  } else if (mealDoneDays > 0 || workoutDoneDays > 0) {
    tone = 'neutral';
    text = 'Estás a registar execução — continua assim.';
  }

  return {
    available: true,
    window_days: days,
    as_of: end,
    streak_days: streak,
    miss_days_recent: missDays,
    rates: {
      meal_pct: mealRate,
      workout_pct: workoutRate,
      meal_days: mealDoneDays,
      meal_expected: mealExpectedDays,
      workout_done: workoutDoneDays,
      workout_expected: workoutExpectedDays,
    },
    tone,
    text,
  };
}

/**
 * Marca missed do dia anterior para alunos activos (job diário).
 */
async function recordDailyMisses(pool, { dataRef } = {}) {
  const day = dataRef || addDaysIso(todayIso(), -1);
  if (!(await tableExists(pool, 'task_adherence_events'))) {
    return { skipped: true, reason: 'no_table', data_ref: day };
  }

  const alunosRes = await pool.query(
    `SELECT id, coach_id FROM public.alunos
     WHERE COALESCE(ativo, true) = true
       AND coach_id IS NOT NULL
     LIMIT 5000`,
  );

  let mealMissed = 0;
  let workoutMissed = 0;
  const wd = isoWeekday(day);

  for (const aluno of alunosRes.rows) {
    const alunoId = aluno.id;
    const coachId = aluno.coach_id;

    // Meal day miss: tem dieta activa e zero conclusões
    try {
      const dieta = await pool.query(
        `SELECT id FROM public.dietas
         WHERE aluno_id = $1 AND COALESCE(ativa, true) = true
         LIMIT 1`,
        [alunoId],
      );
      if (dieta.rows[0]) {
        const done = await pool.query(
          `SELECT 1 FROM public.refeicao_conclusoes
           WHERE aluno_id = $1 AND data_ref = $2::date AND concluido = true
           LIMIT 1`,
          [alunoId, day],
        );
        if (done.rows.length === 0) {
          const entityId = `${alunoId}:${day}:__day__`;
          const flowCycleId = stableUuid(`meal_daily_miss:${entityId}`);
          const ins = await pool.query(
            `INSERT INTO public.task_adherence_events (
               domain, entity_id, aluno_id, coach_id, flow_cycle_id, outcome, metadata
             ) VALUES (
               'meal_daily'::public.task_domain, $1, $2, $3, $4::uuid, 'missed', $5::jsonb
             )
             ON CONFLICT (domain, entity_id, flow_cycle_id, outcome) DO NOTHING
             RETURNING id`,
            [
              entityId,
              alunoId,
              coachId,
              flowCycleId,
              JSON.stringify({ data_ref: day, scope: 'day' }),
            ],
          );
          if (ins.rows[0]) mealMissed += 1;
        }
      }
    } catch (err) {
      console.warn('recordDailyMisses meal:', err.message);
    }

    // Workout miss: agenda no dia e sem sessão completed
    try {
      const agenda = await pool.query(
        `SELECT a.aluno_treino_id, at.treino_id
         FROM public.aluno_treino_agenda a
         INNER JOIN public.alunos_treinos at ON at.id = a.aluno_treino_id
         WHERE a.aluno_id = $1 AND a.dia_semana = $2 AND COALESCE(at.ativo, true) = true
         LIMIT 1`,
        [alunoId, wd],
      );
      const slot = agenda.rows[0];
      if (slot?.treino_id) {
        const done = await pool.query(
          `SELECT 1 FROM public.treino_sessoes
           WHERE aluno_id = $1 AND treino_id = $2 AND data_ref = $3::date
             AND status = 'completed'
           LIMIT 1`,
          [alunoId, slot.treino_id, day],
        );
        if (done.rows.length === 0) {
          const entityId = `${alunoId}:${day}:${slot.treino_id}`;
          const flowCycleId = stableUuid(`workout_daily_miss:${entityId}`);
          const ins = await pool.query(
            `INSERT INTO public.task_adherence_events (
               domain, entity_id, aluno_id, coach_id, flow_cycle_id, outcome, metadata
             ) VALUES (
               'workout_daily'::public.task_domain, $1, $2, $3, $4::uuid, 'missed', $5::jsonb
             )
             ON CONFLICT (domain, entity_id, flow_cycle_id, outcome) DO NOTHING
             RETURNING id`,
            [
              entityId,
              alunoId,
              coachId,
              flowCycleId,
              JSON.stringify({
                data_ref: day,
                treino_id: slot.treino_id,
                scope: 'day',
              }),
            ],
          );
          if (ins.rows[0]) workoutMissed += 1;
        }
      }
    } catch (err) {
      console.warn('recordDailyMisses workout:', err.message);
    }
  }

  return {
    data_ref: day,
    alunos: alunosRes.rows.length,
    meal_missed: mealMissed,
    workout_missed: workoutMissed,
  };
}

module.exports = {
  todayIso,
  addDaysIso,
  isoWeekday,
  getBehavioralInsight,
  recordDailyMisses,
  stableUuid,
};
