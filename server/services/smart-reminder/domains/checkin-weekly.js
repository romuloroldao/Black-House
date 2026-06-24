/**
 * Check-in semanal: lembrete inicial (segunda 10h) + reforço (domingo 21h, 2h antes do prazo).
 */
const crypto = require('crypto');
const { MILESTONES, DOMAINS } = require('../types');
const {
  weekKeyInTimeZone,
  startOfWeekInTimeZone,
  endOfWeekDeadlineInTimeZone,
  localDateTimeToUtc,
  partsInTimeZone,
} = require('../../../utils/zoned-time');
const { startOfCalendarWeek } = require('../../../utils/checkin-week');

function flowCycleId(alunoId, weekKey) {
  const digest = crypto
    .createHash('sha256')
    .update(`checkin_weekly:${alunoId}:${weekKey}`)
    .digest('hex');
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `a${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join('-');
}

function buildEntityId(alunoId, weekKey) {
  return `${alunoId}:${weekKey}`;
}

function parseEntityId(entityId) {
  const idx = entityId.indexOf(':');
  if (idx <= 0) return null;
  return {
    alunoId: entityId.slice(0, idx),
    weekKey: entityId.slice(idx + 1),
  };
}

function getMilestoneSchedule({ weekStartParts, timeZone, milestone }) {
  const { year, month, day } = weekStartParts;

  if (milestone === MILESTONES.INITIAL) {
    return localDateTimeToUtc({ year, month, day, hour: 10, minute: 0 }, timeZone);
  }

  if (milestone === MILESTONES.PRE_DEADLINE_2H) {
    return localDateTimeToUtc({ year, month, day: day + 6, hour: 21, minute: 0 }, timeZone);
  }

  if (milestone === MILESTONES.EXPIRED) {
    return localDateTimeToUtc({ year, month, day: day + 7, hour: 0, minute: 0 }, timeZone);
  }

  return null;
}

async function isCompleted(pool, { alunoId, weekKey, timeZone }) {
  const weekStart = startOfWeekInTimeZone(new Date(`${weekKey}T12:00:00Z`), timeZone);
  const r = await pool.query(
    `SELECT id FROM public.weekly_checkins
     WHERE aluno_id = $1 AND created_at >= $2::timestamptz
     LIMIT 1`,
    [alunoId, weekStart.toISOString()],
  );
  return r.rows.length > 0;
}

async function fetchActiveFlows(pool, now = new Date()) {
  const weekStart = startOfCalendarWeek(now);

  const r = await pool.query(
    `SELECT a.id AS aluno_id, a.coach_id, a.nome AS aluno_nome,
            COALESCE(a.timezone, 'America/Sao_Paulo') AS timezone,
            a.notification_channel::text AS notification_channel
     FROM public.alunos a
     WHERE a.coach_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.weekly_checkins wc
         WHERE wc.aluno_id = a.id
           AND wc.created_at >= $1::timestamptz
       )`,
    [weekStart.toISOString()],
  );

  const flows = [];
  for (const row of r.rows) {
    const tz = row.timezone || 'America/Sao_Paulo';
    const weekKey = weekKeyInTimeZone(now, tz);
    const weekStart = startOfWeekInTimeZone(now, tz);
    const weekStartParts = partsInTimeZone(weekStart, tz);
    const entityId = buildEntityId(row.aluno_id, weekKey);
    const cycleId = flowCycleId(row.aluno_id, weekKey);
    const deadlineAt = endOfWeekDeadlineInTimeZone(now, tz);

    for (const milestone of [MILESTONES.INITIAL, MILESTONES.PRE_DEADLINE_2H]) {
      const scheduledAt = getMilestoneSchedule({ weekStartParts, timeZone: tz, milestone });
      if (!scheduledAt) continue;
      flows.push({
        domain: DOMAINS.CHECKIN_WEEKLY,
        entityId,
        alunoId: row.aluno_id,
        coachId: row.coach_id,
        alunoNome: row.aluno_nome,
        flowCycleId: cycleId,
        milestone,
        scheduledAt,
        deadlineAt,
        timeZone: tz,
        notificationChannel: row.notification_channel,
        weekKey,
      });
    }
  }

  return flows;
}

/** Fluxos da semana anterior ainda sem check-in — para registar EXPIRED. */
async function fetchExpiredFlows(pool, now = new Date()) {
  const r = await pool.query(
    `SELECT a.id AS aluno_id, a.coach_id, a.nome AS aluno_nome,
            COALESCE(a.timezone, 'America/Sao_Paulo') AS timezone,
            a.notification_channel::text AS notification_channel
     FROM public.alunos a
     WHERE a.coach_id IS NOT NULL`,
  );

  const flows = [];
  for (const row of r.rows) {
    const tz = row.timezone || 'America/Sao_Paulo';
    const currentWeekKey = weekKeyInTimeZone(now, tz);
    const prevWeekDate = new Date(startOfWeekInTimeZone(now, tz));
    prevWeekDate.setUTCDate(prevWeekDate.getUTCDate() - 7);
    const prevWeekKey = weekKeyInTimeZone(prevWeekDate, tz);
    if (prevWeekKey === currentWeekKey) continue;

    const completed = await isCompleted(pool, {
      alunoId: row.aluno_id,
      weekKey: prevWeekKey,
      timeZone: tz,
    });
    if (completed) continue;

    const weekStart = startOfWeekInTimeZone(prevWeekDate, tz);
    const weekStartParts = partsInTimeZone(weekStart, tz);
    const entityId = buildEntityId(row.aluno_id, prevWeekKey);
    const cycleId = flowCycleId(row.aluno_id, prevWeekKey);
    const scheduledAt = getMilestoneSchedule({
      weekStartParts,
      timeZone: tz,
      milestone: MILESTONES.EXPIRED,
    });

    flows.push({
      domain: DOMAINS.CHECKIN_WEEKLY,
      entityId,
      alunoId: row.aluno_id,
      coachId: row.coach_id,
      alunoNome: row.aluno_nome,
      flowCycleId: cycleId,
      milestone: MILESTONES.EXPIRED,
      scheduledAt,
      deadlineAt: endOfWeekDeadlineInTimeZone(prevWeekDate, tz),
      timeZone: tz,
      notificationChannel: row.notification_channel,
      weekKey: prevWeekKey,
    });
  }

  return flows;
}

module.exports = {
  domain: DOMAINS.CHECKIN_WEEKLY,
  flowCycleId,
  buildEntityId,
  parseEntityId,
  isCompleted,
  fetchActiveFlows,
  fetchExpiredFlows,
  getMilestoneSchedule,
};
