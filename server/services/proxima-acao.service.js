/**
 * Próxima acção determinística do aluno (sem LLM).
 * Usado por /hoje e pelo Daily Agent.
 *
 * Prioridade (execução do dia > check-in semanal):
 * 1) próxima refeição / abrir dieta
 * 2) treino do dia
 * 3) check-in semanal (não bloqueia 1–2)
 * 4) outras pendências
 */

const { getAlunoHoje } = require('./aluno-hoje.service');
const refeicaoService = require('./refeicao-conclusao.service');
const treinoService = require('./treino-sessao.service');

/** Ordem canónica alinhada a diet-student-utils MEAL_ORDER_KEYWORDS */
const MEAL_ORDER_KEYWORDS = [
  { keys: ['cafe', 'desjejum', 'manha'], order: 0 },
  { keys: ['lanche da manha', 'lanche manha', 'colacao'], order: 1 },
  { keys: ['almoco'], order: 2 },
  { keys: ['lanche da tarde', 'lanche tarde'], order: 3 },
  { keys: ['pre-treino', 'pre treino'], order: 4 },
  { keys: ['pos-treino', 'pos treino'], order: 5 },
  { keys: ['jantar'], order: 6 },
  { keys: ['ceia'], order: 7 },
];

function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function mealOrder(mealKey) {
  const k = normalizeKey(mealKey);
  for (const entry of MEAL_ORDER_KEYWORDS) {
    if (entry.keys.some((x) => k.includes(x))) return entry.order;
  }
  return 50;
}

function sortMealKeys(keys) {
  return [...keys].sort((a, b) => {
    const d = mealOrder(a) - mealOrder(b);
    if (d !== 0) return d;
    return String(a).localeCompare(String(b));
  });
}

function findCheckinPend(hoje) {
  return (hoje.pendencias || []).find((p) => p.id === 'checkin-weekly') || null;
}

/**
 * Extrai meal_keys da dieta (mesmo algoritmo do frontend buildMealGroups).
 * Evita cair no check-in quando o caller não envia meal_keys.
 */
async function listMealKeysFromDieta(pool, dietaId) {
  if (!dietaId) return [];
  const r = await pool.query(
    `SELECT refeicao FROM public.itens_dieta WHERE dieta_id = $1 LIMIT 200`,
    [dietaId],
  );
  const keys = new Set();
  for (const row of r.rows) {
    let base = String(row.refeicao || '').trim();
    if (!base) continue;
    base = base.replace(/\s*\(substituto\)\s*$/i, '').trim();
    const paren = base.match(/\s*\(([^)]+)\)\s*$/);
    if (paren) {
      const inner = paren[1];
      if (/\bplano\s*[a-z]\b/i.test(inner) || /^[a-z]\b/i.test(inner.trim())) {
        base = base.slice(0, paren.index).trim();
      }
    }
    base = base
      .replace(/\s*[-–]\s*plano\s*[a-z]\s*$/i, '')
      .replace(/\s+plano\s*[a-z]\s*$/i, '')
      .replace(/\s*[-–]\s*[a-z]\s*$/i, '')
      .trim();
    const key = normalizeKey(base);
    if (key) keys.add(key);
  }
  return [...keys];
}

function checkinAction(checkinPend, dataRef) {
  return {
    type: 'checkin',
    priority: 'normal',
    title: checkinPend.title,
    description: checkinPend.description,
    tab: 'checkin',
    data_ref: dataRef,
    payload: { pendencia: checkinPend },
  };
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ aluno: object, userId: string, now?: Date, mealKeys?: string[], prefer?: 'meal'|'workout'|null }} opts
 */
async function getProximaAcao(pool, { aluno, userId, now = new Date(), mealKeys = null, prefer = null } = {}) {
  const hoje = await getAlunoHoje(pool, { aluno, userId });
  const dataRef = now.toISOString().slice(0, 10);
  const plano = hoje.dieta_rotacao?.plano || 'A';
  const checkinPend = findCheckinPend(hoje);

  async function resolveMeal() {
    const dietaId = hoje.dieta?.id;
    if (!dietaId) return null;

    const conclusoes = await refeicaoService.listForAluno(pool, aluno.id, { date: dataRef });
    const doneKeys = new Set(
      conclusoes
        .filter((c) => c.concluido && String(c.plano).toUpperCase() === String(plano).toUpperCase())
        .map((c) => c.meal_key),
    );

    let keys = Array.isArray(mealKeys) && mealKeys.length > 0 ? mealKeys : null;
    if (!keys) {
      keys = await listMealKeysFromDieta(pool, dietaId);
    }

    if (Array.isArray(keys) && keys.length > 0) {
      const ordered = sortMealKeys(keys.map(normalizeKey));
      const nextKey = ordered.find((k) => !doneKeys.has(k));
      if (nextKey) {
        return {
          type: 'next_meal',
          priority: 'normal',
          title: 'Próxima refeição',
          description: nextKey,
          tab: 'diet',
          data_ref: dataRef,
          payload: {
            dieta_id: dietaId,
            meal_key: nextKey,
            plano,
            concluida: false,
            checkin_due: Boolean(checkinPend),
          },
        };
      }
      // Todas as refeições do plano concluídas
      return null;
    }

    // Sem keys resolvíveis: só sugerir dieta se ainda não há execução registada
    if (conclusoes.length === 0 && hoje.dieta) {
      return {
        type: 'open_diet',
        priority: 'normal',
        title: 'Seguir a dieta de hoje',
        description: hoje.dieta.nome || 'Dieta activa',
        tab: 'diet',
        data_ref: dataRef,
        payload: {
          dieta_id: dietaId,
          plano,
          checkin_due: Boolean(checkinPend),
        },
      };
    }
    return null;
  }

  async function resolveWorkout() {
    if (hoje.treino?.descanso_hoje) return null;
    if (!hoje.treino?.detalhe?.id) return null;

    const treinoId = hoje.treino.detalhe.id;
    const day = await treinoService.getDayPayload(pool, aluno.id, { date: dataRef, treinoId });
    const sessao = day.sessoes[0] || null;
    if (sessao && sessao.status === 'completed') return null;

    return {
      type: 'today_workout',
      priority: 'normal',
      title: hoje.treino.detalhe.nome || 'Treino de hoje',
      description: sessao?.status === 'in_progress' ? 'Continuar treino' : 'Iniciar treino',
      tab: 'workouts',
      data_ref: dataRef,
      payload: {
        treino_id: treinoId,
        aluno_treino_id: hoje.treino.vinculo?.id || null,
        sessao_id: sessao?.id || null,
        status: sessao?.status || null,
        completed_indexes: sessao?.completed_indexes || [],
        checkin_due: Boolean(checkinPend),
      },
    };
  }

  // Preferências explícitas (perguntas «próxima refeição» / treino)
  if (prefer === 'meal') {
    const meal = await resolveMeal();
    if (meal) return meal;
    return {
      type: 'idle',
      priority: 'low',
      title: 'Refeições em dia',
      description: checkinPend
        ? 'Não há refeição pendente agora. Ainda podes fazer o check-in semanal quando quiseres.'
        : 'Não há refeição pendente no plano de hoje.',
      tab: 'diet',
      data_ref: dataRef,
      payload: { checkin_due: Boolean(checkinPend) },
    };
  }

  if (prefer === 'workout') {
    const workout = await resolveWorkout();
    if (workout) return workout;
    if (hoje.treino?.descanso_hoje) {
      return {
        type: 'idle',
        priority: 'low',
        title: 'Descanso hoje',
        description: 'Hoje é dia de descanso na agenda de treino.',
        tab: 'workouts',
        data_ref: dataRef,
        payload: { checkin_due: Boolean(checkinPend) },
      };
    }
    return {
      type: 'idle',
      priority: 'low',
      title: 'Treino em dia',
      description: checkinPend
        ? 'Não há treino pendente agora. Ainda podes fazer o check-in semanal quando quiseres.'
        : 'Não há treino pendente para hoje.',
      tab: 'workouts',
      data_ref: dataRef,
      payload: { checkin_due: Boolean(checkinPend) },
    };
  }

  // Fluxo normal: execução do dia primeiro; check-in não bloqueia
  const meal = await resolveMeal();
  if (meal) return meal;

  const workout = await resolveWorkout();
  if (workout) return workout;

  if (checkinPend) {
    return checkinAction(checkinPend, dataRef);
  }

  const other = (hoje.pendencias || []).find((p) => p.id !== 'checkin-weekly');
  if (other) {
    return {
      type: 'pendencia',
      priority: other.priority || 'normal',
      title: other.title,
      description: other.description,
      tab: other.tab,
      data_ref: dataRef,
      payload: { pendencia: other },
    };
  }

  return {
    type: 'idle',
    priority: 'low',
    title: 'Estás em dia',
    description: 'Não há acções pendentes para agora.',
    tab: 'hoje',
    data_ref: dataRef,
    payload: {},
  };
}

module.exports = {
  getProximaAcao,
  sortMealKeys,
  mealOrder,
  normalizeKey,
  listMealKeysFromDieta,
};
