/**
 * Lembretes de Agenda para o coach (fonte: public.agenda_eventos).
 */
const crypto = require('crypto');
const logger = require('../utils/logger');
const { MILESTONES } = require('./agenda-coach-reminder-copy');

const DEFAULT_TZ = 'America/Sao_Paulo';
const CHANNEL_IN_APP_ONLY = 'in_app_only';
const CHANNEL_IN_APP_AND_EMAIL = 'in_app_and_email';
const MAX_OVERDUE_EMAILS_PER_COACH_PER_DAY = 20;

function newCycleId() {
  return crypto.randomUUID();
}

function parseEventDate(value) {
  if (!value) return null;
  const s = String(value).trim().split('T')[0];
  return s || null;
}

async function getCoachNotificationChannel(pool, coachUserId) {
  const r = await pool.query(
    `SELECT notification_channel::text AS channel
     FROM public.coach_profiles WHERE user_id = $1 LIMIT 1`,
    [coachUserId],
  );
  if (r.rows[0]?.channel === CHANNEL_IN_APP_ONLY) return CHANNEL_IN_APP_ONLY;
  return CHANNEL_IN_APP_AND_EMAIL;
}

async function shouldSendCoachEmail(pool, coachUserId) {
  return (await getCoachNotificationChannel(pool, coachUserId)) === CHANNEL_IN_APP_AND_EMAIL;
}

/**
 * Após criar/atualizar evento na Agenda.
 */
async function onAgendaEventSaved(pool, evento, { previous } = {}) {
  if (!evento?.id) return evento;

  const prevStatus = previous?.status;
  const newStatus = evento.status;
  const prevDate = parseEventDate(previous?.data_evento);
  const newDate = parseEventDate(evento.data_evento);

  if (newStatus === 'concluido') {
    try {
      const { recordUltimoContatoFromAgenda } = require('./agenda-crm.service');
      await recordUltimoContatoFromAgenda(pool, evento);
    } catch (e) {
      logger.warn('agenda_crm.ultimo_contato_failed', { error: e.message });
    }
  }

  if (newStatus === 'concluido' || newStatus === 'cancelado') {
    return evento;
  }

  const dateChanged = prevDate !== newDate;
  let cycleId = evento.reminder_cycle_id;

  if (!cycleId || dateChanged || !previous) {
    cycleId = newCycleId();
    const upd = await pool.query(
      `UPDATE public.agenda_eventos
       SET reminder_cycle_id = $1
       WHERE id = $2
       RETURNING *`,
      [cycleId, evento.id],
    );
    return upd.rows[0] || { ...evento, reminder_cycle_id: cycleId };
  }

  return evento;
}

async function fetchMilestoneCandidates(pool, milestoneKey, daysBefore) {
  const sql = `
    SELECT
      ae.id AS agenda_evento_id,
      ae.coach_id,
      ae.aluno_id,
      ae.titulo,
      ae.tipo AS event_tipo,
      ae.data_evento AS event_date,
      ae.prioridade,
      ae.reminder_cycle_id,
      COALESCE(a.nome, SPLIT_PART(COALESCE(a.email, ''), '@', 1)) AS aluno_nome,
      COALESCE(cp.timezone, '${DEFAULT_TZ}') AS coach_tz,
      cp.notification_channel::text AS notification_channel
    FROM public.agenda_eventos ae
    LEFT JOIN public.alunos a ON a.id = ae.aluno_id
    LEFT JOIN public.coach_profiles cp ON cp.user_id = ae.coach_id
    WHERE ae.status = 'pendente'
      AND ae.data_evento IS NOT NULL
      AND ae.reminder_cycle_id IS NOT NULL
      AND (ae.snoozed_until IS NULL OR ae.snoozed_until < (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, '${DEFAULT_TZ}'))::date)
      AND ae.data_evento = (
        (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, '${DEFAULT_TZ}'))::date
        + $1::int
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.agenda_coach_reminder_dispatches d
        WHERE d.agenda_evento_id = ae.id
          AND d.reminder_cycle_id = ae.reminder_cycle_id
          AND d.milestone = $2::public.agenda_coach_milestone
      )
  `;
  const r = await pool.query(sql, [daysBefore, milestoneKey]);
  return r.rows;
}

async function fetchOverdueCandidates(pool) {
  const sql = `
    SELECT
      ae.id AS agenda_evento_id,
      ae.coach_id,
      ae.aluno_id,
      ae.titulo,
      ae.tipo AS event_tipo,
      ae.data_evento AS event_date,
      ae.prioridade,
      ae.reminder_cycle_id,
      COALESCE(a.nome, SPLIT_PART(COALESCE(a.email, ''), '@', 1)) AS aluno_nome,
      COALESCE(cp.timezone, '${DEFAULT_TZ}') AS coach_tz,
      cp.notification_channel::text AS notification_channel
    FROM public.agenda_eventos ae
    LEFT JOIN public.alunos a ON a.id = ae.aluno_id
    LEFT JOIN public.coach_profiles cp ON cp.user_id = ae.coach_id
    WHERE ae.status = 'pendente'
      AND ae.data_evento IS NOT NULL
      AND ae.reminder_cycle_id IS NOT NULL
      AND (ae.snoozed_until IS NULL OR ae.snoozed_until < (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, '${DEFAULT_TZ}'))::date)
      AND ae.data_evento < (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, '${DEFAULT_TZ}'))::date
      AND NOT EXISTS (
        SELECT 1 FROM public.agenda_coach_reminder_dispatches d
        WHERE d.agenda_evento_id = ae.id
          AND d.milestone = 'OVERDUE_DAILY'::public.agenda_coach_milestone
          AND d.dispatch_on = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, '${DEFAULT_TZ}'))::date
      )
    ORDER BY ae.data_evento ASC
  `;
  const r = await pool.query(sql);
  return r.rows;
}

async function registerDispatch(pool, row, milestone, { skipOverdueUnique } = {}) {
  const channel = row.notification_channel || CHANNEL_IN_APP_AND_EMAIL;
  // Data civil em America/Sao_Paulo (evita UTC mudar o dia perto da meia-noite)
  const dispatchOnRow = await pool.query(
    `SELECT (CURRENT_TIMESTAMP AT TIME ZONE $1)::date::text AS d`,
    [DEFAULT_TZ],
  );
  const dispatchOn = dispatchOnRow.rows[0]?.d || new Date().toISOString().slice(0, 10);

  try {
    if (milestone === 'OVERDUE_DAILY') {
      const r = await pool.query(
        `INSERT INTO public.agenda_coach_reminder_dispatches (
           agenda_evento_id, coach_id, aluno_id, reminder_cycle_id, milestone,
           event_date, event_tipo, dispatch_on, notification_channel, email_status
         ) VALUES ($1, $2, $3, $4, $5::public.agenda_coach_milestone, $6, $7, $8::date, $9::public.coach_notification_channel, 'pending')
         ON CONFLICT (agenda_evento_id, milestone, dispatch_on) DO NOTHING
         RETURNING id`,
        [
          row.agenda_evento_id,
          row.coach_id,
          row.aluno_id,
          row.reminder_cycle_id,
          milestone,
          row.event_date,
          row.event_tipo,
          dispatchOn,
          channel,
        ],
      );
      return r.rows[0] || null;
    }

    const r = await pool.query(
      `INSERT INTO public.agenda_coach_reminder_dispatches (
         agenda_evento_id, coach_id, aluno_id, reminder_cycle_id, milestone,
         event_date, event_tipo, dispatch_on, notification_channel, email_status
       ) VALUES ($1, $2, $3, $4, $5::public.agenda_coach_milestone, $6, $7, $8::date, $9::public.coach_notification_channel, 'pending')
       ON CONFLICT (agenda_evento_id, reminder_cycle_id, milestone) WHERE milestone <> 'OVERDUE_DAILY'::public.agenda_coach_milestone
       DO NOTHING
       RETURNING id`,
      [
        row.agenda_evento_id,
        row.coach_id,
        row.aluno_id,
        row.reminder_cycle_id,
        milestone,
        row.event_date,
        row.event_tipo,
        dispatchOn,
        channel,
      ],
    );
    return r.rows[0] || null;
  } catch (error) {
    // 23505 = unique_violation — tratar como já despachado (não derrubar o job)
    if (error && error.code === '23505') {
      logger.warn('agenda_coach_reminder.dispatch_conflict', {
        milestone,
        agendaEventoId: row.agenda_evento_id,
        error: error.message,
      });
      return null;
    }
    throw error;
  }
}

async function updateDispatchEmailStatus(pool, dispatchId, status, extra = {}) {
  await pool.query(
    `UPDATE public.agenda_coach_reminder_dispatches
     SET email_status = $2, email_provider = COALESCE($3, email_provider), email_error = COALESCE($4, email_error)
     WHERE id = $1`,
    [dispatchId, status, extra.provider || null, extra.error || null],
  );
}

async function getAgendaSummary(pool, coachIdsOrId) {
  const coachIds = Array.isArray(coachIdsOrId) ? coachIdsOrId : [coachIdsOrId];
  const r = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE ae.status = 'pendente'
           AND ae.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date
       )::int AS pendentes_hoje,
       COUNT(*) FILTER (
         WHERE ae.status = 'pendente'
           AND ae.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date + 1
       )::int AS pendentes_amanha,
       COUNT(*) FILTER (
         WHERE ae.status = 'pendente'
           AND ae.data_evento < (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date
       )::int AS atrasados,
       COUNT(*) FILTER (
         WHERE ae.status = 'pendente'
           AND ae.data_evento BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date
             AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date + 7
       )::int AS proximos_7_dias
     FROM public.agenda_eventos ae
     LEFT JOIN public.coach_profiles cp ON cp.user_id = ae.coach_id
     WHERE ae.coach_id = ANY($1::uuid[])`,
    [coachIds, DEFAULT_TZ],
  );
  const base = r.rows[0] || {
    pendentes_hoje: 0,
    pendentes_amanha: 0,
    atrasados: 0,
    proximos_7_dias: 0,
  };

  const porTipo = await pool.query(
    `SELECT ae.tipo, COUNT(*)::int AS total
     FROM public.agenda_eventos ae
     WHERE ae.coach_id = ANY($1::uuid[]) AND ae.status = 'pendente'
       AND ae.data_evento <= (CURRENT_TIMESTAMP AT TIME ZONE $2)::date + 7
     GROUP BY ae.tipo`,
    [coachIds, DEFAULT_TZ],
  );
  const por_tipo = {};
  for (const row of porTipo.rows) {
    por_tipo[row.tipo] = row.total;
  }

  return { ...base, por_tipo };
}

async function getAgendaAttention(pool, coachIdsOrId, limit = 15) {
  const coachIds = Array.isArray(coachIdsOrId) ? coachIdsOrId : [coachIdsOrId];
  const r = await pool.query(
    `SELECT
       ae.id,
       ae.titulo,
       ae.tipo,
       ae.data_evento,
       ae.prioridade,
       ae.status,
       ae.aluno_id,
       COALESCE(a.nome, SPLIT_PART(COALESCE(a.email, ''), '@', 1)) AS aluno_nome,
       CASE
         WHEN ae.status = 'pendente' AND ae.data_evento < (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date THEN 'atrasado'
         WHEN ae.status = 'pendente' AND ae.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date THEN 'hoje'
         WHEN ae.status = 'pendente' AND ae.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date + 1 THEN 'amanha'
         ELSE 'futuro'
       END AS janela,
       (
         CASE WHEN ae.status = 'pendente' AND ae.data_evento < (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date THEN 100 ELSE 0 END
         + CASE WHEN ae.status = 'pendente' AND ae.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date THEN 50 ELSE 0 END
         + CASE WHEN ae.status = 'pendente' AND ae.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(cp.timezone, $2))::date + 1 THEN 30 ELSE 0 END
         + CASE ae.prioridade WHEN 'alta' THEN 20 WHEN 'normal' THEN 10 ELSE 0 END
       ) AS attention_score
     FROM public.agenda_eventos ae
     LEFT JOIN public.alunos a ON a.id = ae.aluno_id
     LEFT JOIN public.coach_profiles cp ON cp.user_id = ae.coach_id
     WHERE ae.coach_id = ANY($1::uuid[]) AND ae.status = 'pendente'
     ORDER BY attention_score DESC, ae.data_evento ASC
     LIMIT $3`,
    [coachIds, DEFAULT_TZ, limit],
  );
  return r.rows;
}

async function getCoachNotificationPreferences(pool, coachUserId) {
  const r = await pool.query(
    `SELECT notification_channel::text AS notification_channel,
            COALESCE(timezone, $2) AS timezone
     FROM public.coach_profiles WHERE user_id = $1 LIMIT 1`,
    [coachUserId, DEFAULT_TZ],
  );
  if (!r.rows[0]) {
    return {
      notification_channel: CHANNEL_IN_APP_AND_EMAIL,
      timezone: DEFAULT_TZ,
    };
  }
  return r.rows[0];
}

async function updateCoachNotificationPreferences(pool, coachUserId, { notification_channel, timezone }) {
  const allowed = new Set([CHANNEL_IN_APP_ONLY, CHANNEL_IN_APP_AND_EMAIL]);
  if (notification_channel && !allowed.has(notification_channel)) {
    throw new Error('Canal de notificação inválido');
  }

  await pool.query(
    `INSERT INTO public.coach_profiles (user_id, notification_channel, timezone)
     VALUES ($1, $2::public.coach_notification_channel, COALESCE($3, $4))
     ON CONFLICT (user_id) DO UPDATE SET
       notification_channel = COALESCE(EXCLUDED.notification_channel, coach_profiles.notification_channel),
       timezone = COALESCE(EXCLUDED.timezone, coach_profiles.timezone),
       updated_at = now()`,
    [
      coachUserId,
      notification_channel || CHANNEL_IN_APP_AND_EMAIL,
      timezone || null,
      DEFAULT_TZ,
    ],
  );

  return getCoachNotificationPreferences(pool, coachUserId);
}

module.exports = {
  DEFAULT_TZ,
  MILESTONES,
  MAX_OVERDUE_EMAILS_PER_COACH_PER_DAY,
  CHANNEL_IN_APP_ONLY,
  CHANNEL_IN_APP_AND_EMAIL,
  newCycleId,
  onAgendaEventSaved,
  fetchMilestoneCandidates,
  fetchOverdueCandidates,
  registerDispatch,
  updateDispatchEmailStatus,
  shouldSendCoachEmail,
  getAgendaSummary,
  getAgendaAttention,
  getCoachNotificationPreferences,
  updateCoachNotificationPreferences,
};
