/**
 * Agregação para GET /api/alunos/me/hoje — portal do aluno (ecrã Hoje / dashboard).
 */

function parseDateOnly(value) {
  if (value == null || value === '') return null;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffCalendarDays(target, from = new Date()) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatReturnLabel(days) {
  if (days > 1) return `Retorno em ${days} dias`;
  if (days === 1) return 'Retorno amanhã';
  if (days === 0) return 'Retorno é hoje';
  const overdue = Math.abs(days);
  if (overdue === 1) return 'Retorno há 1 dia';
  return `Retorno há ${overdue} dias`;
}

function pickReturnCountdown(dieta, alunoTreino, treinoNome) {
  const candidates = [];
  const dietaDate = parseDateOnly(dieta?.data_retorno);
  if (dietaDate) {
    candidates.push({
      date: dietaDate,
      iso: String(dieta.data_retorno).slice(0, 10),
      source: 'dieta',
      planName: dieta?.nome ?? null,
    });
  }
  const treinoDate = parseDateOnly(alunoTreino?.data_retorno);
  if (treinoDate) {
    candidates.push({
      date: treinoDate,
      iso: String(alunoTreino.data_retorno).slice(0, 10),
      source: 'treino',
      planName: treinoNome ?? null,
    });
  }
  if (candidates.length === 0) return null;

  const today = new Date();
  const future = candidates
    .map((c) => ({ ...c, days: diffCalendarDays(c.date, today) }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days);
  const pick =
    future[0] ??
    candidates
      .map((c) => ({ ...c, days: diffCalendarDays(c.date, today) }))
      .sort((a, b) => b.days - a.days)[0];

  const days = pick.days;
  return {
    date: pick.iso,
    days,
    label: formatReturnLabel(days),
    source: pick.source,
    plan_name: pick.planName,
    overdue: days < 0,
  };
}

const {
  startOfCalendarWeek,
  weekKeyFromDate,
  hasCheckinThisWeek,
} = require('../utils/checkin-week');

function computeCheckinStreak(checkins) {
  const weeks = new Set();
  for (const c of checkins) {
    if (c.created_at) weeks.add(weekKeyFromDate(c.created_at));
  }
  const estaSemana = weekKeyFromDate(new Date());
  let streak = 0;
  let cursor = new Date(`${estaSemana}T12:00:00`);
  while (weeks.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  let badge = null;
  if (streak >= 8) badge = '8+ semanas firme';
  else if (streak >= 4) badge = '4 check-ins seguidos';
  else if (streak >= 2) badge = 'Em sequência';
  return {
    semanas_consecutivas: streak,
    fez_esta_semana: weeks.has(estaSemana),
    total_checkins: checkins.length,
    badge,
  };
}

const { getRotationForDate } = require('../utils/diet-rotation');
const { civilDateKeyInTimeZone } = require('../utils/zoned-time');
const { isoDayOfWeek } = require('./aluno-treino-agenda.service');

const APP_TIME_ZONE = 'America/Sao_Paulo';

function buildPendencias({ checkinDue, unreadChat, unreadAvisos }) {
  const tasks = [];
  if (checkinDue) {
    tasks.push({
      id: 'checkin-weekly',
      title: 'Check-in semanal',
      description:
        'Ainda não enviou esta semana. Pode fazer quando quiser — não bloqueia dieta nem treino.',
      tab: 'checkin',
      priority: 'normal',
    });
  }
  if (unreadChat > 0) {
    tasks.push({
      id: 'chat-unread',
      title:
        unreadChat === 1
          ? '1 mensagem nova no chat'
          : `${unreadChat} mensagens novas no chat`,
      description: 'Seu coach enviou uma mensagem. Responda quando puder.',
      tab: 'coach',
      search_params: { coachView: 'chat' },
      priority: 'high',
    });
  }
  if (unreadAvisos > 0) {
    tasks.push({
      id: 'announcements-unread',
      title: unreadAvisos === 1 ? '1 aviso do coach' : `${unreadAvisos} avisos do coach`,
      description: 'Leia os avisos do coach na aba Coach.',
      tab: 'coach',
      search_params: { coachView: 'avisos' },
      priority: 'normal',
    });
  }
  return tasks;
}

async function enrichPlanoNome(pool, aluno) {
  const copy = { ...aluno };
  const raw = copy.plano != null ? String(copy.plano).trim() : '';
  if (!raw) return copy;
  const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  try {
    if (looksUuid) {
      const pr = await pool.query(
        'SELECT nome FROM public.payment_plans WHERE id = $1::uuid LIMIT 1',
        [raw],
      );
      copy.plano_nome = pr.rows[0]?.nome || 'Plano de pagamento';
    } else {
      copy.plano_nome = raw;
    }
  } catch {
    copy.plano_nome = looksUuid ? 'Plano de pagamento' : raw;
  }
  return copy;
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ aluno: object, userId: string }} ctx
 */
async function getAlunoHoje(pool, { aluno, userId }) {
  const alunoId = aluno.id;
  // Dia civil em America/Sao_Paulo — nunca toISOString().slice (UTC muda o dia à noite BRT)
  const hojeIso = civilDateKeyInTimeZone(new Date(), APP_TIME_ZONE);
  const diaHoje = isoDayOfWeek(new Date());

  const [
    agendaHojeRes,
    agendaCountRes,
    alunoTreinoFallbackRes,
    dietaRes,
    checkinsRes,
    checkinsStreakRes,
    unreadChatRes,
    turmasRes,
    avisosRes,
    eventosRes,
    fotosRes,
  ] = await Promise.all([
    pool.query(
      `SELECT at.*, t.nome AS treino_nome, t.descricao AS treino_descricao,
              t.categoria AS treino_categoria, t.dificuldade AS treino_dificuldade,
              t.duracao AS treino_duracao,
              a.dia_semana AS agenda_dia_semana
       FROM public.aluno_treino_agenda a
       INNER JOIN public.alunos_treinos at ON at.id = a.aluno_treino_id
       INNER JOIN public.treinos t ON t.id = at.treino_id
       WHERE a.aluno_id = $1
         AND a.dia_semana = $2
         AND COALESCE(at.ativo, true) = true
       ORDER BY a.ordem ASC
       LIMIT 1`,
      [alunoId, diaHoje],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM public.aluno_treino_agenda WHERE aluno_id = $1`,
      [alunoId],
    ),
    pool.query(
      `SELECT at.*, t.nome AS treino_nome, t.descricao AS treino_descricao,
              t.categoria AS treino_categoria, t.dificuldade AS treino_dificuldade,
              t.duracao AS treino_duracao
       FROM public.alunos_treinos at
       INNER JOIN public.treinos t ON t.id = at.treino_id
       WHERE at.aluno_id = $1 AND COALESCE(at.ativo, true) = true
       ORDER BY at.created_at DESC NULLS LAST
       LIMIT 1`,
      [alunoId],
    ),
    pool.query(
      `SELECT id, aluno_id, nome, objetivo, data_retorno, ativa, created_at,
              rotacao_ativa, rotacao_dias_plano_a, rotacao_dias_plano_b,
              rotacao_plano_inicial, rotacao_data_inicio, rotacao_sequencia,
              refeicao_livre_ativa, refeicao_livre_observacao, refeicao_livre_content_id
       FROM public.dietas
       WHERE aluno_id = $1
       ORDER BY (CASE WHEN COALESCE(ativa, true) THEN 0 ELSE 1 END), created_at DESC NULLS LAST
       LIMIT 1`,
      [alunoId],
    ),
    pool.query(
      `SELECT id, created_at FROM public.weekly_checkins
       WHERE aluno_id = $1 AND created_at >= $2::timestamptz
       ORDER BY created_at DESC LIMIT 20`,
      [alunoId, startOfCalendarWeek().toISOString()],
    ),
    pool.query(
      `SELECT id, created_at FROM public.weekly_checkins
       WHERE aluno_id = $1
       ORDER BY created_at DESC NULLS LAST
       LIMIT 120`,
      [alunoId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.mensagens m
       INNER JOIN public.conversas c ON c.id = m.conversa_id
       WHERE c.aluno_id = $1 AND m.lida = false AND m.remetente_id <> $2`,
      [alunoId, userId],
    ),
    pool.query(
      'SELECT turma_id FROM public.turmas_alunos WHERE aluno_id = $1',
      [alunoId],
    ),
    pool.query(
      `SELECT id, aluno_id, turma_id, lido FROM public.avisos_destinatarios
       WHERE lido = false AND (aluno_id = $1 OR turma_id IS NOT NULL)`,
      [alunoId],
    ),
    pool.query(
      `SELECT id, titulo, data_evento, hora_evento, tipo, status
       FROM public.agenda_eventos
       WHERE aluno_id = $1 AND data_evento >= $2::date
       ORDER BY data_evento ASC, hora_evento ASC NULLS LAST
       LIMIT 5`,
      [alunoId, hojeIso],
    ),
    pool.query(
      `SELECT f.id, f.url, f.created_at,
              (SELECT COUNT(*)::int FROM public.fotos_alunos WHERE aluno_id = $1) AS total
       FROM public.fotos_alunos f
       WHERE f.aluno_id = $1
       ORDER BY f.created_at DESC NULLS LAST
       LIMIT 1`,
      [alunoId],
    ),
  ]);

  const fromAgenda = agendaHojeRes.rows[0] || null;
  const hasAgenda = (agendaCountRes.rows[0]?.total ?? 0) > 0;
  // Com agenda: dia vazio = descanso (não cair no "último treino atribuído").
  const alunoTreinoRow = fromAgenda
    || (!hasAgenda ? alunoTreinoFallbackRes.rows[0] || null : null);
  const dieta = dietaRes.rows[0] || null;
  const treinoFromAgenda = Boolean(fromAgenda);

  let treino = null;
  if (alunoTreinoRow) {
    treino = {
      vinculo: {
        id: alunoTreinoRow.id,
        aluno_id: alunoTreinoRow.aluno_id,
        treino_id: alunoTreinoRow.treino_id,
        ativo: alunoTreinoRow.ativo,
        data_retorno: alunoTreinoRow.data_retorno,
        data_inicio: alunoTreinoRow.data_inicio,
      },
      detalhe: {
        id: alunoTreinoRow.treino_id,
        nome: alunoTreinoRow.treino_nome,
        descricao: alunoTreinoRow.treino_descricao,
        categoria: alunoTreinoRow.treino_categoria,
        dificuldade: alunoTreinoRow.treino_dificuldade,
        duracao: alunoTreinoRow.treino_duracao,
      },
      from_agenda: treinoFromAgenda,
      agenda_dia_semana: treinoFromAgenda ? diaHoje : null,
      descanso_hoje: false,
    };
  } else if (hasAgenda) {
    treino = {
      vinculo: null,
      detalhe: null,
      from_agenda: true,
      agenda_dia_semana: diaHoje,
      descanso_hoje: true,
    };
  }

  const turmaIds = turmasRes.rows.map((r) => r.turma_id);
  const unreadAvisos = avisosRes.rows.filter(
    (a) => a.aluno_id === alunoId || (a.turma_id && turmaIds.includes(a.turma_id)),
  ).length;

  const unreadChat = unreadChatRes.rows[0]?.total ?? 0;
  const checkinDue = !hasCheckinThisWeek(checkinsRes.rows);
  const checkin_streak = computeCheckinStreak(checkinsStreakRes.rows);

  const ultimaFoto = fotosRes.rows[0] || null;
  const weekStart = startOfCalendarWeek();
  const enviouEstaSemana = ultimaFoto?.created_at
    ? new Date(ultimaFoto.created_at) >= weekStart
    : false;
  const fotosTotal = Number(ultimaFoto?.total ?? 0);
  const fotos_evolucao = {
    total: fotosTotal,
    ultima_em: ultimaFoto?.created_at ?? null,
    ultima_url: ultimaFoto?.url ?? null,
    enviou_esta_semana: enviouEstaSemana,
  };
  const retorno = pickReturnCountdown(
    dieta,
    alunoTreinoRow,
    alunoTreinoRow?.treino_nome ?? null,
  );

  const alunoEnriched = await enrichPlanoNome(pool, aluno);

  const dieta_rotacao = dieta ? getRotationForDate(dieta) : null;

  // Phase 1a: execução diária (conclusões + sessão de treino)
  let execucao = {
    refeicoes_concluidas: [],
    treino_sessao: null,
  };
  try {
    const conclusoesRes = await pool.query(
      `SELECT meal_key, plano, concluido, concluido_em, dieta_id
       FROM public.refeicao_conclusoes
       WHERE aluno_id = $1 AND data_ref = $2::date AND concluido = true
       ORDER BY meal_key ASC`,
      [alunoId, hojeIso],
    );
    execucao.refeicoes_concluidas = conclusoesRes.rows;

    const treinoIdHoje = treino?.detalhe?.id || null;
    if (treinoIdHoje) {
      const sessaoRes = await pool.query(
        `SELECT id, status, metadata, started_at, completed_at, treino_id
         FROM public.treino_sessoes
         WHERE aluno_id = $1 AND treino_id = $2 AND data_ref = $3::date
         LIMIT 1`,
        [alunoId, treinoIdHoje, hojeIso],
      );
      const sessao = sessaoRes.rows[0] || null;
      if (sessao) {
        const seriesRes = await pool.query(
          `SELECT COUNT(*)::int AS total FROM public.treino_serie_logs WHERE sessao_id = $1`,
          [sessao.id],
        );
        execucao.treino_sessao = {
          id: sessao.id,
          status: sessao.status,
          completed_indexes: Array.isArray(sessao.metadata?.completedIndexes)
            ? sessao.metadata.completedIndexes
            : [],
          series_count: seriesRes.rows[0]?.total ?? 0,
          started_at: sessao.started_at,
          completed_at: sessao.completed_at,
        };
      }
    }
  } catch (err) {
    // Tabela ainda não migrada: não quebrar o Hoje
    if (err && err.code !== '42P01') {
      console.warn('aluno-hoje execucao:', err.message);
    }
  }

  let behavioral_insight = null;
  try {
    const behavioral = require('./behavioral-insight.service');
    behavioral_insight = await behavioral.getBehavioralInsight(pool, { id: alunoId }, { days: 7 });
  } catch (err) {
    console.warn('aluno-hoje behavioral_insight:', err.message);
  }

  return {
    aluno: alunoEnriched,
    treino,
    dieta,
    dieta_rotacao,
    retorno,
    fotos_evolucao,
    pendencias: buildPendencias({ checkinDue, unreadChat, unreadAvisos }),
    proximos_eventos: eventosRes.rows,
    checkin_streak,
    contadores: {
      unread_chat: unreadChat,
      unread_avisos: unreadAvisos,
      checkin_due: checkinDue,
      pendencias_total: buildPendencias({
        checkinDue,
        unreadChat,
        unreadAvisos,
      }).length,
    },
    execucao,
    behavioral_insight,
    gerado_em: new Date().toISOString(),
  };
}

module.exports = {
  getAlunoHoje,
  pickReturnCountdown,
  buildPendencias,
};
