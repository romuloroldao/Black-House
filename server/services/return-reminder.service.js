/**
 * Agendamento e consulta de lembretes de retorno (dieta/treino).
 */
const crypto = require('crypto');
const logger = require('../utils/logger');
const {
  MILESTONES,
  CHANNEL_IN_APP_ONLY,
  CHANNEL_IN_APP_AND_EMAIL,
} = require('./return-reminder-copy');

const DEFAULT_TZ = 'America/Sao_Paulo';

function newCycleId() {
  return crypto.randomUUID();
}

function parseReturnDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

/**
 * Canal de notificação do aluno: in_app_only | in_app_and_email
 */
async function getStudentNotificationChannel(pool, alunoId) {
  const r = await pool.query(
    `SELECT notification_channel::text AS channel
     FROM public.alunos WHERE id = $1 LIMIT 1`,
    [alunoId],
  );
  const ch = r.rows[0]?.channel;
  if (ch === CHANNEL_IN_APP_ONLY) return CHANNEL_IN_APP_ONLY;
  return CHANNEL_IN_APP_AND_EMAIL;
}

async function shouldSendEmail(pool, alunoId) {
  const channel = await getStudentNotificationChannel(pool, alunoId);
  return channel === CHANNEL_IN_APP_AND_EMAIL;
}

/**
 * Sincroniza ciclo de retorno do treino após create/update.
 */
async function syncWorkoutReturnSchedule(pool, row) {
  if (!row?.id) return;
  const dataRetorno = parseReturnDate(row.data_retorno || row.data_expiracao);
  if (!dataRetorno) {
    await pool.query(
      `UPDATE public.alunos_treinos
       SET data_retorno = NULL, schedule_cycle_id = NULL
       WHERE id = $1`,
      [row.id],
    );
    return;
  }

  const prev = await pool.query(
    `SELECT data_retorno, schedule_cycle_id FROM public.alunos_treinos WHERE id = $1`,
    [row.id],
  );
  const prevDate = parseReturnDate(prev.rows[0]?.data_retorno);
  let cycleId = prev.rows[0]?.schedule_cycle_id;
  if (!cycleId || prevDate !== dataRetorno) {
    cycleId = newCycleId();
  }

  await pool.query(
    `UPDATE public.alunos_treinos
     SET data_retorno = $1::date,
         data_expiracao = COALESCE(data_expiracao, $1::date),
         schedule_cycle_id = $2,
         notificacao_expiracao_enviada = false
     WHERE id = $3`,
    [dataRetorno, cycleId, row.id],
  );

  logger.info('return_reminder.workout_schedule_synced', {
    alunoTreinoId: row.id,
    dataRetorno,
    scheduleCycleId: cycleId,
  });

  try {
    const { syncAgendaAfterWorkout } = require('./agenda-crm.service');
    await pool.query('SAVEPOINT agenda_sync_workout');
    try {
      await syncAgendaAfterWorkout(pool, { id: row.id, data_retorno: dataRetorno });
    } catch (e) {
      await pool.query('ROLLBACK TO SAVEPOINT agenda_sync_workout');
      logger.warn('agenda_crm.sync_workout_failed', { error: e.message });
    }
  } catch (e) {
    logger.warn('agenda_crm.sync_workout_failed', { error: e.message });
  }
}

/**
 * Sincroniza ciclo de retorno da dieta; desactiva outras dietas activas do mesmo aluno.
 */
async function syncDietReturnSchedule(pool, row) {
  if (!row?.id || !row?.aluno_id) return;
  const dataRetorno = parseReturnDate(row.data_retorno);
  if (!dataRetorno) {
    await pool.query(
      `UPDATE public.dietas
       SET data_retorno = NULL, schedule_cycle_id = NULL, ativa = COALESCE(ativa, true)
       WHERE id = $1`,
      [row.id],
    );
    return;
  }

  let cycleId = row.schedule_cycle_id;
  const prev = await pool.query(
    `SELECT data_retorno, schedule_cycle_id FROM public.dietas WHERE id = $1`,
    [row.id],
  );
  const prevDate = parseReturnDate(prev.rows[0]?.data_retorno);
  if (!cycleId || prevDate !== dataRetorno) {
    cycleId = newCycleId();
  }

  await pool.query(
    `UPDATE public.dietas SET ativa = false
     WHERE aluno_id = $1 AND id <> $2 AND COALESCE(ativa, true) = true`,
    [row.aluno_id, row.id],
  );

  await pool.query(
    `UPDATE public.dietas
     SET data_retorno = $1::date,
         ativa = true,
         schedule_cycle_id = $2
     WHERE id = $3`,
    [dataRetorno, cycleId, row.id],
  );

  logger.info('return_reminder.diet_schedule_synced', {
    dietaId: row.id,
    alunoId: row.aluno_id,
    dataRetorno,
    scheduleCycleId: cycleId,
  });

  try {
    const { syncAgendaAfterDiet } = require('./agenda-crm.service');
    await pool.query('SAVEPOINT agenda_sync_diet');
    try {
      await syncAgendaAfterDiet(pool, { id: row.id, data_retorno: dataRetorno, aluno_id: row.aluno_id });
    } catch (e) {
      await pool.query('ROLLBACK TO SAVEPOINT agenda_sync_diet');
      logger.warn('agenda_crm.sync_diet_failed', { error: e.message });
    }
  } catch (e) {
    logger.warn('agenda_crm.sync_diet_failed', { error: e.message });
  }
}

/**
 * Após mutação genérica em dietas / alunos_treinos.
 */
async function afterTableMutation(pool, table, row) {
  if (!row) return;
  if (table === 'alunos_treinos') {
    await syncWorkoutReturnSchedule(pool, row);
  } else if (table === 'dietas') {
    await syncDietReturnSchedule(pool, row);
  }
}

/**
 * Candidatos para um marco no dia de execução (data local do aluno).
 */
async function fetchCandidates(pool, domain, milestoneKey, daysBefore) {
  const table =
    domain === 'diet'
      ? { name: 'dietas', entity: 'd.id', aluno: 'd.aluno_id', date: 'd.data_retorno', active: 'COALESCE(d.ativa, true) = true' }
      : {
          name: 'alunos_treinos at',
          entity: 'at.id',
          aluno: 'at.aluno_id',
          date: 'at.data_retorno',
          active: 'COALESCE(at.ativo, true) = true',
        };

  const joinTreino =
    domain === 'workout'
      ? `LEFT JOIN public.treinos t ON t.id = at.treino_id`
      : '';
  const planoNome = domain === 'workout' ? 't.nome AS plano_nome' : 'd.nome AS plano_nome';
  const fromClause =
    domain === 'diet'
      ? `FROM public.dietas d`
      : `FROM public.alunos_treinos at ${joinTreino}`;

  const entityId = domain === 'diet' ? 'd.id' : 'at.id';
  const cycleCol = domain === 'diet' ? 'd.schedule_cycle_id' : 'at.schedule_cycle_id';
  const dateCol = domain === 'diet' ? 'd.data_retorno' : 'at.data_retorno';

  const sql = `
    SELECT
      ${entityId} AS entity_id,
      a.id AS aluno_id,
      a.coach_id,
      ${cycleCol} AS schedule_cycle_id,
      ${dateCol} AS return_date,
      a.nome AS aluno_nome,
      COALESCE(a.timezone, '${DEFAULT_TZ}') AS timezone,
      a.notification_channel::text AS notification_channel,
      ${planoNome},
      cp.nome_completo AS coach_nome
    ${fromClause}
    JOIN public.alunos a ON a.id = ${domain === 'diet' ? 'd.aluno_id' : 'at.aluno_id'}
    LEFT JOIN public.coach_profiles cp ON cp.user_id = a.coach_id
    WHERE ${table.active}
      AND ${dateCol} IS NOT NULL
      AND ${cycleCol} IS NOT NULL
      AND ${dateCol} = (
        (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(a.timezone, '${DEFAULT_TZ}'))::date
        + $1::int
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.return_reminder_dispatches rd
        WHERE rd.domain = $2::public.automation_domain
          AND rd.entity_id = ${entityId}
          AND rd.schedule_cycle_id = ${cycleCol}
          AND rd.milestone = $3::public.return_milestone
      )
  `;

  const result = await pool.query(sql, [daysBefore, domain, milestoneKey]);
  return result.rows;
}

/**
 * Regista disparo (idempotente). Retorna row ou null se já existia.
 */
async function registerDispatch(pool, payload) {
  const r = await pool.query(
    `INSERT INTO public.return_reminder_dispatches (
       domain, entity_id, aluno_id, coach_id, schedule_cycle_id,
       milestone, return_date, notification_channel, email_status
     ) VALUES (
       $1::public.automation_domain, $2, $3, $4, $5,
       $6::public.return_milestone, $7::date, $8::public.student_notification_channel, $9
     )
     ON CONFLICT (domain, entity_id, schedule_cycle_id, milestone) DO NOTHING
     RETURNING id`,
    [
      payload.domain,
      payload.entityId,
      payload.alunoId,
      payload.coachId,
      payload.scheduleCycleId,
      payload.milestone,
      payload.returnDate,
      payload.notificationChannel || CHANNEL_IN_APP_AND_EMAIL,
      payload.emailStatus || 'pending',
    ],
  );
  return r.rows[0] || null;
}

async function updateDispatchEmailStatus(pool, dispatchId, status, extra = {}) {
  await pool.query(
    `UPDATE public.return_reminder_dispatches
     SET email_status = $2,
         email_provider = COALESCE($3, email_provider),
         email_error = COALESCE($4, email_error)
     WHERE id = $1`,
    [dispatchId, status, extra.provider || null, extra.error || null],
  );
}

async function getNotificationPreferences(pool, alunoId) {
  const r = await pool.query(
    `SELECT notification_channel::text AS notification_channel,
            COALESCE(timezone, $2) AS timezone
     FROM public.alunos WHERE id = $1 LIMIT 1`,
    [alunoId, DEFAULT_TZ],
  );
  if (!r.rows[0]) return null;
  return {
    notification_channel: r.rows[0].notification_channel || CHANNEL_IN_APP_AND_EMAIL,
    timezone: r.rows[0].timezone || DEFAULT_TZ,
  };
}

async function updateNotificationPreferences(pool, alunoId, { notification_channel, timezone }) {
  const allowed = new Set([CHANNEL_IN_APP_ONLY, CHANNEL_IN_APP_AND_EMAIL]);
  if (notification_channel && !allowed.has(notification_channel)) {
    throw new Error('Canal de notificação inválido');
  }

  const fields = [];
  const params = [];
  let i = 1;

  if (notification_channel) {
    fields.push(`notification_channel = $${i}::public.student_notification_channel`);
    params.push(notification_channel);
    i++;
  }
  if (timezone && String(timezone).trim()) {
    fields.push(`timezone = $${i}`);
    params.push(String(timezone).trim());
    i++;
  }

  if (fields.length === 0) {
    return getNotificationPreferences(pool, alunoId);
  }

  params.push(alunoId);
  const q = `
    UPDATE public.alunos
    SET ${fields.join(', ')}
    WHERE id = $${i}
    RETURNING notification_channel::text AS notification_channel,
              COALESCE(timezone, '${DEFAULT_TZ}') AS timezone
  `;
  const r = await pool.query(q, params);
  return r.rows[0] || null;
}

module.exports = {
  DEFAULT_TZ,
  MILESTONES,
  CHANNEL_IN_APP_ONLY,
  CHANNEL_IN_APP_AND_EMAIL,
  parseReturnDate,
  getStudentNotificationChannel,
  shouldSendEmail,
  syncWorkoutReturnSchedule,
  syncDietReturnSchedule,
  afterTableMutation,
  fetchCandidates,
  registerDispatch,
  updateDispatchEmailStatus,
  getNotificationPreferences,
  updateNotificationPreferences,
};
