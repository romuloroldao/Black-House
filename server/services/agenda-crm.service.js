/**
 * CRM leve, sync Agenda ↔ dieta/treino, sugestões e snooze.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');
const { newCycleId } = require('./agenda-coach-reminder.service');

const TIPO_BY_SOURCE = {
  diet: 'ajuste_dieta',
  workout: 'alteracao_treino',
};

const TIPO_LABEL = {
  ajuste_dieta: 'Retorno de dieta',
  alteracao_treino: 'Retorno de treino',
  consulta: 'Consulta',
  acompanhamento: 'Acompanhamento',
  retorno: 'Retorno',
  avaliacao: 'Consulta',
  outro: 'Compromisso',
};

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return s.split('T')[0] || null;
}

/**
 * Regista último contacto quando retorno/conclusão na Agenda.
 */
async function recordUltimoContatoFromAgenda(pool, evento) {
  if (!evento?.aluno_id || evento.status !== 'concluido') return;

  const label = TIPO_LABEL[evento.tipo] || 'Retorno';
  const resumo = `${label} concluído — ${evento.titulo || 'Agenda'}`;

  await pool.query(
    `UPDATE public.alunos
     SET ultimo_contato_em = now(),
         ultimo_contato_tipo = $2,
         ultimo_contato_resumo = $3,
         ultimo_contato_agenda_evento_id = $4
     WHERE id = $1`,
    [evento.aluno_id, evento.tipo, resumo, evento.id],
  );

  logger.info('agenda_crm.ultimo_contato', { alunoId: evento.aluno_id, eventoId: evento.id });
}

/**
 * Cria ou actualiza evento na Agenda a partir de dieta/treino com data_retorno.
 */
async function upsertAgendaFromPlan(pool, {
  sourceType,
  sourceId,
  alunoId,
  coachId,
  dataRetorno,
  titulo,
}) {
  const date = parseDate(dataRetorno);
  if (!date || !alunoId || !coachId || !sourceId) return null;

  const tipo = TIPO_BY_SOURCE[sourceType] || 'retorno';
  const eventTitle = titulo || (sourceType === 'diet' ? 'Retorno de dieta' : 'Retorno de treino');

  const existing = await pool.query(
    `SELECT id, data_evento, reminder_cycle_id, status
     FROM public.agenda_eventos
     WHERE source_type = $1 AND source_id = $2
     LIMIT 1`,
    [sourceType, sourceId],
  );

  if (existing.rows[0]) {
    const row = existing.rows[0];
    const prevDate = parseDate(row.data_evento);
    const newCycle =
      prevDate !== date || row.status === 'cancelado' ? newCycleId() : row.reminder_cycle_id;

    const upd = await pool.query(
      `UPDATE public.agenda_eventos
       SET data_evento = $1::date,
           titulo = $2,
           tipo = $3,
           status = 'pendente',
           aluno_id = $4,
           coach_id = $5,
           reminder_cycle_id = COALESCE($6, reminder_cycle_id),
           snoozed_until = NULL,
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [date, eventTitle, tipo, alunoId, coachId, newCycle, row.id],
    );
    logger.info('agenda_crm.sync_updated', { sourceType, sourceId, agendaId: row.id });
    return upd.rows[0];
  }

  const cycleId = newCycleId();
  const ins = await pool.query(
    `INSERT INTO public.agenda_eventos (
       coach_id, aluno_id, titulo, descricao, data_evento,
       tipo, status, prioridade, source_type, source_id, reminder_cycle_id
     ) VALUES ($1, $2, $3, $4, $5::date, $6, 'pendente', 'normal', $7, $8, $9)
     RETURNING *`,
    [
      coachId,
      alunoId,
      eventTitle,
      'Criado automaticamente a partir do plano do aluno.',
      date,
      tipo,
      sourceType,
      sourceId,
      cycleId,
    ],
  );
  logger.info('agenda_crm.sync_created', { sourceType, sourceId, agendaId: ins.rows[0]?.id });
  return ins.rows[0];
}

async function syncAgendaAfterDiet(pool, dietaRow) {
  const alunoR = await pool.query(
    `SELECT a.id, a.coach_id, d.nome, d.data_retorno
     FROM public.dietas d
     JOIN public.alunos a ON a.id = d.aluno_id
     WHERE d.id = $1`,
    [dietaRow.id],
  );
  if (!alunoR.rows[0]?.coach_id) return null;
  const row = alunoR.rows[0];
  return upsertAgendaFromPlan(pool, {
    sourceType: 'diet',
    sourceId: dietaRow.id,
    alunoId: row.id,
    coachId: row.coach_id,
    dataRetorno: parseDate(dietaRow.data_retorno) || parseDate(row.data_retorno),
    titulo: `Retorno de dieta — ${row.nome || 'Plano'}`,
  });
}

async function syncAgendaAfterWorkout(pool, alunoTreinoRow) {
  const r = await pool.query(
    `SELECT at.id, at.aluno_id, at.data_retorno, at.treino_id, a.coach_id, t.nome AS treino_nome
     FROM public.alunos_treinos at
     JOIN public.alunos a ON a.id = at.aluno_id
     LEFT JOIN public.treinos t ON t.id = at.treino_id
     WHERE at.id = $1`,
    [alunoTreinoRow.id],
  );
  if (!r.rows[0]?.coach_id) return null;
  const row = r.rows[0];
  return upsertAgendaFromPlan(pool, {
    sourceType: 'workout',
    sourceId: alunoTreinoRow.id,
    alunoId: row.aluno_id,
    coachId: row.coach_id,
    dataRetorno: parseDate(alunoTreinoRow.data_retorno) || parseDate(row.data_retorno),
    titulo: `Retorno de treino — ${row.treino_nome || 'Treino'}`,
  });
}

/**
 * Adia lembretes (não altera data_evento).
 */
async function snoozeAgendaEvent(pool, eventoId, coachScope, days = 1) {
  const d = Math.min(Math.max(parseInt(days, 10) || 1, 1), 14);
  const filter = coachScope.isAdmin && coachScope.coachIds === null
    ? { clause: 'id = $2', params: [eventoId] }
    : { clause: 'id = $2 AND coach_id = ANY($3::uuid[])', params: [eventoId, coachScope.coachIds] };

  const r = await pool.query(
    `UPDATE public.agenda_eventos
     SET snoozed_until = (CURRENT_DATE + $1::int), updated_at = now()
     WHERE ${filter.clause} AND status = 'pendente'
     RETURNING *`,
    [d, ...filter.params],
  );
  return r.rows[0] || null;
}

/**
 * Sugestões rule-based (sem IA externa): check-in ausente 14d+ sem retorno agendado.
 */
async function getAgendaSuggestions(pool, coachIds, { checkinDays = 14, limit = 20 } = {}) {
  if (!coachIds?.length) return [];

  const r = await pool.query(
    `WITH last_checkin AS (
       SELECT aluno_id, MAX(created_at) AS last_at
       FROM public.weekly_checkins
       GROUP BY aluno_id
     ),
     pending_agenda AS (
       SELECT DISTINCT aluno_id
       FROM public.agenda_eventos
       WHERE coach_id = ANY($1::uuid[])
         AND status = 'pendente'
         AND data_evento >= CURRENT_DATE
         AND data_evento <= CURRENT_DATE + 14
     )
     SELECT
       a.id AS aluno_id,
       COALESCE(NULLIF(TRIM(a.nome), ''), SPLIT_PART(COALESCE(a.email, ''), '@', 1)) AS aluno_nome,
       lc.last_at AS ultimo_checkin_em,
       a.ultimo_contato_em,
       EXTRACT(DAY FROM (now() - COALESCE(lc.last_at, a.created_at)))::int AS dias_sem_checkin
     FROM public.alunos a
     LEFT JOIN last_checkin lc ON lc.aluno_id = a.id
     LEFT JOIN pending_agenda pa ON pa.aluno_id = a.id
     WHERE a.coach_id = ANY($1::uuid[])
       AND pa.aluno_id IS NULL
       AND (
         lc.last_at IS NULL
         OR lc.last_at < now() - ($2::int || ' days')::interval
       )
     ORDER BY dias_sem_checkin DESC NULLS LAST, a.nome ASC
     LIMIT $3`,
    [coachIds, checkinDays, limit],
  );

  return r.rows.map((row) => ({
    aluno_id: row.aluno_id,
    aluno_nome: row.aluno_nome,
    dias_sem_checkin: row.dias_sem_checkin,
    ultimo_checkin_em: row.ultimo_checkin_em,
    ultimo_contato_em: row.ultimo_contato_em,
    motivo: 'checkin_ausente',
    mensagem: `${row.aluno_nome} sem check-in há ${row.dias_sem_checkin ?? checkinDays}+ dias — agendar retorno?`,
    tipo_sugerido: 'acompanhamento',
    prioridade_sugerida: row.dias_sem_checkin >= 21 ? 'alta' : 'normal',
  }));
}

module.exports = {
  recordUltimoContatoFromAgenda,
  upsertAgendaFromPlan,
  syncAgendaAfterDiet,
  syncAgendaAfterWorkout,
  snoozeAgendaEvent,
  getAgendaSuggestions,
  TIPO_LABEL,
};
