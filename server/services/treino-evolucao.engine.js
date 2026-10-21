/**
 * Motor puro da evolução de treino (aluno × próprio histórico).
 * Sem I/O. IA não entra aqui — só métricas determinísticas.
 */

const LOAD_EPS = 0.05;
const REPS_EPS = 0.5;
const DROPSET_LOAD_RATIO = 0.9;

const NON_NUMERIC_LOAD = /^(bw|pc|peso\s*corporal|body\s*weight|el[aá]stic[oa]?s?|banda|bodyweight)$/i;

function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso, delta) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function isoWeekday(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00.000Z`);
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

/** Semana calendário segunda–domingo (igual ao check-in / fotos). */
function startOfWeekMonday(iso) {
  const day = String(iso).slice(0, 10);
  const wd = isoWeekday(day);
  return addDaysIso(day, 1 - wd);
}

function weekBounds(iso) {
  const start = startOfWeekMonday(iso);
  return { start, end: addDaysIso(start, 6) };
}

function inInclusiveRange(iso, start, end) {
  const d = String(iso).slice(0, 10);
  return d >= start && d <= end;
}

function parseCarga(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (NON_NUMERIC_LOAD.test(s)) return null;

  const lower = s.toLowerCase();
  let unidade = 'kg';
  if (/(lbs?|libras?)/.test(lower)) unidade = 'lb';
  else if (/(kgs?|quilos?)/.test(lower)) unidade = 'kg';

  const normalized = s.replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const valor = Number(match[0]);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { valor, unidade };
}

function parsePrescribedSets(series) {
  if (series == null || series === '') return 3;
  if (typeof series === 'number' && Number.isFinite(series)) {
    return Math.min(20, Math.max(1, Math.round(series)));
  }
  const s = String(series).trim();
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.min(20, Math.max(1, parseInt(range[1], 10)));
  const n = s.match(/(\d+)/);
  if (n) return Math.min(20, Math.max(1, parseInt(n[1], 10)));
  return 3;
}

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeExerciseName(name) {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  );
}

function exerciseKey({ slot_key: slotKey, exercise_name: name }) {
  if (isUuid(slotKey)) return `slot:${String(slotKey).toLowerCase()}`;
  const n = normalizeExerciseName(name);
  return n ? `name:${n}` : null;
}

function formatNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  const v = Number(n);
  const rounded = Math.abs(v - Math.round(v)) < 0.001 ? String(Math.round(v)) : v.toFixed(1).replace('.', ',');
  return rounded;
}

function formatLoad(valor, unidade) {
  if (valor == null) return null;
  const u = unidade === 'lb' ? ' lb' : ' kg';
  return `${formatNumber(valor)}${u}`;
}

function formatDeltaLoad(delta, unidade) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${formatNumber(delta)}${unidade === 'lb' ? ' lb' : ' kg'}`;
}

function formatDeltaReps(delta) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const sign = delta > 0 ? '+' : '';
  const n = Math.abs(delta - Math.round(delta)) < 0.001 ? Math.round(delta) : delta;
  return `${sign}${n} reps`;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveSetLoad(set) {
  if (set.carga_valor != null && Number.isFinite(Number(set.carga_valor)) && Number(set.carga_valor) > 0) {
    const unidade = set.carga_unidade === 'lb' ? 'lb' : 'kg';
    return { valor: Number(set.carga_valor), unidade };
  }
  return parseCarga(set.carga);
}

/**
 * Top-set: maior carga numérica; empate → mais reps.
 * Séries com carga < 90% do máximo são drop-sets e não definem as reps do top-set.
 */
function pickTopSet(sets) {
  const parsed = [];
  for (const set of sets || []) {
    const load = resolveSetLoad(set);
    const reps = toNum(set.repeticoes);
    parsed.push({ set, load, reps });
  }
  const numeric = parsed.filter((p) => p.load);
  if (numeric.length === 0) {
    const withReps = parsed.filter((p) => p.reps != null);
    const bestReps = withReps.sort((a, b) => (b.reps || 0) - (a.reps || 0))[0];
    return {
      carga: null,
      unidade: null,
      reps: bestReps?.reps ?? null,
      carga_label: null,
      numeric: false,
    };
  }

  numeric.sort((a, b) => {
    if (b.load.valor !== a.load.valor) return b.load.valor - a.load.valor;
    return (b.reps || 0) - (a.reps || 0);
  });
  const top = numeric[0];
  const peak = top.load.valor;
  const sameLoad = numeric.filter((p) => p.load.valor >= peak * DROPSET_LOAD_RATIO);
  const bestRepsAmong = [...sameLoad].sort((a, b) => (b.reps || 0) - (a.reps || 0))[0];

  return {
    carga: top.load.valor,
    unidade: top.load.unidade,
    reps: bestRepsAmong?.reps ?? top.reps,
    carga_label: formatLoad(top.load.valor, top.load.unidade),
    numeric: true,
  };
}

function sessionVolume(sets) {
  let volume = 0;
  let unidade = null;
  let counted = 0;
  for (const set of sets || []) {
    const load = resolveSetLoad(set);
    const reps = toNum(set.repeticoes);
    if (!load || reps == null) continue;
    if (unidade && load.unidade !== unidade) return { volume: null, unidade: null, mixed: true };
    unidade = load.unidade;
    volume += load.valor * reps;
    counted += 1;
  }
  if (counted === 0) return { volume: null, unidade, mixed: false };
  return { volume, unidade, mixed: false };
}

function displayNameFromSets(sets) {
  const named = (sets || []).find((s) => String(s.exercise_name || '').trim());
  return named ? String(named.exercise_name).trim() : 'Exercício';
}

function groupSetsByExercise(sets) {
  const groups = new Map();
  for (const set of sets || []) {
    const key = exerciseKey(set);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(set);
  }
  return groups;
}

function sessionExerciseMarks(session) {
  const groups = groupSetsByExercise(session.series || []);
  const marks = [];
  for (const [key, sets] of groups) {
    const top = pickTopSet(sets);
    const vol = sessionVolume(sets);
    marks.push({
      key,
      name: displayNameFromSets(sets),
      date: String(session.data_ref).slice(0, 10),
      treino_id: session.treino_id,
      status: session.status,
      top,
      volume: vol.mixed ? null : vol.volume,
      volume_unidade: vol.unidade,
      series_count: sets.length,
    });
  }
  return marks;
}

function bestMark(marks) {
  if (!marks.length) return null;
  const numeric = marks.filter((m) => m.top.numeric);
  const pool = numeric.length ? numeric : marks;
  return [...pool].sort((a, b) => {
    const ca = a.top.carga || 0;
    const cb = b.top.carga || 0;
    if (cb !== ca) return cb - ca;
    return (b.top.reps || 0) - (a.top.reps || 0);
  })[0];
}

function classifyPair(current, previous) {
  if (!current) return 'dados_incompletos';
  if (!previous) return 'novo';
  if (!current.top.numeric && current.top.reps == null) return 'dados_incompletos';
  if (!previous.top.numeric && previous.top.reps == null) return 'dados_incompletos';

  if (current.top.numeric && previous.top.numeric) {
    if (current.top.unidade && previous.top.unidade && current.top.unidade !== previous.top.unidade) {
      return 'unidade_mista';
    }
    const dLoad = current.top.carga - previous.top.carga;
    if (dLoad > LOAD_EPS) return 'subiu_carga';
    if (dLoad < -LOAD_EPS) return 'abaixo_ultimo';
    const cReps = current.top.reps;
    const pReps = previous.top.reps;
    if (cReps != null && pReps != null) {
      if (cReps - pReps > REPS_EPS) return 'subiu_reps';
      if (pReps - cReps > REPS_EPS) return 'abaixo_ultimo';
    }
    return 'estavel';
  }

  if (!current.top.numeric || !previous.top.numeric) {
    const cReps = current.top.reps;
    const pReps = previous.top.reps;
    if (cReps != null && pReps != null) {
      if (cReps - pReps > REPS_EPS) return 'subiu_reps';
      if (pReps - cReps > REPS_EPS) return 'abaixo_ultimo';
      return 'estavel';
    }
    return 'dados_incompletos';
  }
  return 'estavel';
}

function confidenceFrom({
  sessionsLoggedCurrent,
  comparableCount,
  sessionsInLookback,
  numericShare,
}) {
  if (sessionsLoggedCurrent <= 0) return 'none';
  if (sessionsLoggedCurrent === 1 || comparableCount < 3) return 'low';
  if (sessionsInLookback >= 4 && comparableCount >= 3 && numericShare >= 0.5) return 'high';
  if (sessionsLoggedCurrent >= 2 && comparableCount >= 3) return 'medium';
  return 'low';
}

function confidenceLabel(level, sessionsLoggedCurrent, comparableCount) {
  if (level === 'none') {
    return 'Continue registrando seus treinos para acompanhar sua evolução.';
  }
  if (level === 'low') {
    return 'Temos poucos registros para avaliar sua evolução com precisão.';
  }
  if (level === 'high') {
    return `Análise baseada em ${sessionsLoggedCurrent} registros desta semana e histórico de 4 semanas.`;
  }
  return `Análise baseada em ${sessionsLoggedCurrent} registros nesta semana (${comparableCount} exercícios comparáveis).`;
}

function buildHeadline({ confidence, counts, audience }) {
  if (confidence === 'none') {
    return {
      title: 'Precisamos de mais dados.',
      body: 'Continue registrando suas cargas e repetições para acompanhar sua evolução com mais precisão.',
      tone: 'insufficient',
    };
  }
  if (confidence === 'low') {
    return {
      title: 'Temos poucos registros.',
      body: 'Ainda não dá para ler a tendência com precisão. Continue registrando série a série.',
      tone: 'insufficient',
    };
  }

  const upLoad = counts.subiu_carga || 0;
  const upReps = counts.subiu_reps || 0;
  const estavel = counts.estavel || 0;
  const down = counts.abaixo_ultimo || 0;
  const novos = counts.novo || 0;
  const improved = upLoad + upReps;
  const comparable = upLoad + upReps + estavel + down;

  // Rotação / nomes que não cruzam: não deixar 4 "abaixo" falarem pela semana inteira.
  if (novos > comparable && novos >= 3) {
    return {
      title: 'Poucos exercícios desta semana têm histórico comparável.',
      body: audience === 'coach'
        ? `${novos} exercícios não cruzam com a janela de 4 semanas (rotação ou nome diferente). Isso não é uma queda. Os comparáveis estão nos detalhes.`
        : `${novos} exercícios ainda não têm marca anterior nesta janela. Isso não é uma queda — pode ser treino diferente ou exercício novo.`,
      tone: 'stable',
    };
  }

  if (down >= 2 && down > improved) {
    return {
      title: audience === 'coach'
        ? 'Vários exercícios ficaram abaixo do último registro.'
        : 'Alguns exercícios ficaram abaixo da última marca.',
      body:
        down === 1
          ? 'A carga registrada em 1 exercício ficou abaixo da sua última marca. Vale observar se isso se repete nos próximos treinos.'
          : `A carga registrada em ${down} exercícios ficou abaixo da última marca. Vale observar se isso se repete nos próximos treinos.`,
      tone: 'attention',
    };
  }

  if (upLoad >= 1 && upLoad >= down) {
    const stableBit = estavel > 0 ? ` e manteve a performance em outros ${estavel}` : '';
    return {
      title: 'Boa evolução nesta semana.',
      body: `Você aumentou a carga em ${upLoad} exercício${upLoad === 1 ? '' : 's'}${stableBit}.`,
      tone: 'positive',
    };
  }

  if (upReps >= 1 && upLoad === 0 && down === 0) {
    return {
      title: 'Boa evolução nesta semana.',
      body: `Você aumentou as repetições em ${upReps} exercício${upReps === 1 ? '' : 's'} com a mesma carga.`,
      tone: 'positive',
    };
  }

  if (estavel > 0 && estavel >= improved && down <= 1) {
    return {
      title: 'Seu desempenho ficou estável nesta semana.',
      body: 'A maioria dos exercícios manteve carga e repetições semelhantes às semanas anteriores.',
      tone: 'stable',
    };
  }

  return {
    title: 'Leitura mista nesta semana.',
    body: 'Alguns exercícios avançaram e outros ficaram estáveis ou abaixo da última marca. Os detalhes estão abaixo.',
    tone: 'stable',
  };
}

function buildChartComment({ confidence, exercises, audience }) {
  if (confidence === 'none' || confidence === 'low') return null;
  const up = exercises.filter((e) => e.status === 'subiu_carga');
  if (up.length > 0) {
    const best = [...up].sort((a, b) => (b.delta_carga || 0) - (a.delta_carga || 0))[0];
    const delta = formatDeltaLoad(best.delta_carga, best.current?.unidade);
    return {
      title: audience === 'coach' ? 'Progressão de carga nos exercícios acompanhados' : 'Você está progredindo',
      body: `A carga aumentou em ${up.length} dos exercícios acompanhados nesta semana. O maior avanço foi em ${best.name}${delta ? `, com ${delta} em relação ao último registro` : ''}.`,
    };
  }
  const upReps = exercises.filter((e) => e.status === 'subiu_reps');
  if (upReps.length > 0) {
    const best = [...upReps].sort((a, b) => (b.delta_reps || 0) - (a.delta_reps || 0))[0];
    return {
      title: audience === 'coach' ? 'Progressão de repetições' : 'Você está progredindo nas repetições',
      body: `A carga manteve-se e as repetições subiram em ${upReps.length} exercício${upReps.length === 1 ? '' : 's'}. Destaque: ${best.name}${best.delta_reps != null ? ` (${formatDeltaReps(best.delta_reps)})` : ''}.`,
    };
  }
  const stable = exercises.filter((e) => e.status === 'estavel');
  if (stable.length > 0) {
    return {
      title: 'Desempenho estável',
      body: 'O gráfico mostra cargas semelhantes às semanas anteriores — isso não é automaticamente estagnação.',
    };
  }
  const down = exercises.filter((e) => e.status === 'abaixo_ultimo');
  if (down.length > 0) {
    const worst = down[0];
    return {
      title: 'Carga abaixo da última marca',
      body: `A carga registrada em ${worst.name} ficou abaixo do último registro. Uma sessão isolada não define tendência.`,
    };
  }
  return null;
}

function buildInsights({ confidence, counts, consistency, exercises }) {
  const insights = [];
  if (confidence === 'none' || confidence === 'low') {
    insights.push({
      kind: 'dados_insuficientes',
      text: 'Ainda temos poucos registros para identificar uma tendência.',
    });
    return insights;
  }

  const comparable =
    (counts.subiu_carga || 0) +
    (counts.subiu_reps || 0) +
    (counts.estavel || 0) +
    (counts.abaixo_ultimo || 0);
  const novosDominam = (counts.novo || 0) > comparable && (counts.novo || 0) >= 3;

  if (novosDominam) {
    insights.push({
      kind: 'dados_insuficientes',
      text: `${counts.novo} exercícios desta semana ainda não têm histórico comparável na janela analisada. Isso não significa queda.`,
    });
  }
  if (counts.subiu_carga > 0) {
    insights.push({
      kind: 'evolucao',
      text: `Você aumentou a carga em ${counts.subiu_carga} exercício${counts.subiu_carga === 1 ? '' : 's'} nesta semana.`,
    });
  }
  const down = exercises.filter((e) => e.status === 'abaixo_ultimo');
  if (down.length > 0) {
    insights.push({
      kind: 'atencao',
      text:
        down.length === 1
          ? 'Um exercício ficou abaixo da última marca. Uma sessão isolada não define tendência.'
          : `${down.length} exercícios ficaram abaixo da última marca. Uma sessão isolada não define tendência.`,
    });
  }
  if (
    !novosDominam &&
    counts.estavel > 0 &&
    counts.estavel >= counts.subiu_carga + counts.subiu_reps &&
    counts.estavel >= down.length
  ) {
    insights.push({
      kind: 'estabilidade',
      text: 'Seu desempenho ficou estável na maioria dos exercícios comparáveis.',
    });
  }
  if (consistency.fill_pct != null && consistency.series_logged > 0) {
    insights.push({
      kind: 'consistencia',
      text: `Você registrou ${Math.round(consistency.fill_pct)}% das séries prescritas nas sessões acompanhadas.`,
    });
  }
  return insights;
}

function visibleExercisesForAudience(exercises, audience) {
  if (audience === 'coach') return exercises;
  const comparable = exercises.filter((e) => e.comparable);
  const novos = exercises.filter((e) => e.status === 'novo').slice(0, 3);
  const incomplete = exercises.filter(
    (e) => e.status === 'dados_incompletos' && e.sessions_this_week > 0,
  );
  const seen = new Set();
  const out = [];
  for (const item of [...comparable, ...novos, ...incomplete]) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

function pickHighlights(exercises) {
  const highlights = {};
  const upLoad = exercises.filter((e) => e.status === 'subiu_carga' && e.delta_carga != null);
  if (upLoad.length) {
    const best = [...upLoad].sort((a, b) => b.delta_carga - a.delta_carga)[0];
    highlights.maior_carga = {
      name: best.name,
      delta: formatDeltaLoad(best.delta_carga, best.current.unidade),
    };
  }
  const upReps = exercises.filter((e) => e.status === 'subiu_reps' && e.delta_reps != null);
  if (upReps.length) {
    const best = [...upReps].sort((a, b) => b.delta_reps - a.delta_reps)[0];
    highlights.maior_reps = {
      name: best.name,
      delta: formatDeltaReps(best.delta_reps),
    };
  }
  const stable = exercises.filter((e) => e.status === 'estavel');
  if (stable.length) {
    highlights.estavel = {
      name: stable[0].name,
      detail: 'mesma carga',
    };
  }
  const down = exercises.filter((e) => e.status === 'abaixo_ultimo');
  if (down.length) {
    highlights.atencao = {
      name: down[0].name,
      detail: 'redução em relação ao último registro',
    };
  }
  return highlights;
}

function weekLabel(startIso) {
  const [y, m, d] = startIso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * @param {object} input
 * @param {Array} input.sessions  { id, data_ref, treino_id, status, series: [...] }
 * @param {number[]} input.agendaWeekdays  ISO 1–7
 * @param {Record<string, number>} [input.prescribedSetsByTreino]
 * @param {string} [input.asOf]
 * @param {'aluno'|'coach'} [input.audience]
 */
function analyzeWeeklyEvolution(input) {
  const audience = input.audience === 'coach' ? 'coach' : 'aluno';
  const asOf = String(input.asOf || todayIso()).slice(0, 10);
  const current = weekBounds(asOf);
  const previous = weekBounds(addDaysIso(current.start, -1));
  const lookbackStart = addDaysIso(current.start, -21);
  const weekStarts = [0, 1, 2, 3].map((i) => addDaysIso(current.start, -7 * (3 - i)));

  const sessions = (input.sessions || []).filter((s) => s && s.data_ref);
  const currentSessions = sessions.filter((s) => inInclusiveRange(s.data_ref, current.start, current.end));
  const lookbackSessions = sessions.filter((s) => inInclusiveRange(s.data_ref, lookbackStart, current.end));

  const loggedDates = new Set(
    currentSessions
      .filter((s) => (s.series && s.series.length > 0) || s.status === 'completed')
      .map((s) => String(s.data_ref).slice(0, 10)),
  );
  const completedDates = new Set(
    currentSessions.filter((s) => s.status === 'completed').map((s) => String(s.data_ref).slice(0, 10)),
  );

  const agenda = Array.isArray(input.agendaWeekdays) ? input.agendaWeekdays.map(Number).filter((n) => n >= 1 && n <= 7) : [];
  let planned = null;
  if (agenda.length > 0) {
    planned = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDaysIso(current.start, i);
      if (agenda.includes(isoWeekday(day))) planned += 1;
    }
  }

  let seriesLogged = 0;
  let seriesPrescribed = 0;
  const prescribedMap = input.prescribedSetsByTreino || {};
  for (const s of currentSessions) {
    const logs = s.series || [];
    seriesLogged += logs.length;
    const prescribed = prescribedMap[s.treino_id];
    if (prescribed != null) seriesPrescribed += prescribed;
  }

  const fillPct =
    seriesPrescribed > 0 ? Math.min(100, Math.round((seriesLogged / seriesPrescribed) * 100)) : null;

  const consistency = {
    sessions_logged: loggedDates.size,
    sessions_completed: completedDates.size,
    sessions_planned: planned,
    series_logged: seriesLogged,
    series_prescribed: seriesPrescribed > 0 ? seriesPrescribed : null,
    fill_pct: fillPct,
  };

  const empty =
    sessions.length === 0 ||
    lookbackSessions.every((s) => !s.series || s.series.length === 0);

  if (loggedDates.size === 0 && input.allowFallback !== false) {
    const priorWithSeries = sessions.filter((s) => {
      const day = String(s.data_ref).slice(0, 10);
      return day < current.start && Array.isArray(s.series) && s.series.length > 0;
    });
    if (priorWithSeries.length > 0) {
      const lastDate = priorWithSeries
        .map((s) => String(s.data_ref).slice(0, 10))
        .sort()
        .at(-1);
      const prior = analyzeWeeklyEvolution({
        ...input,
        asOf: lastDate,
        allowFallback: false,
      });
      if (prior && !prior.empty) {
        return {
          ...prior,
          empty: false,
          is_fallback: true,
          requested_week: current,
          fallback_label:
            audience === 'coach'
              ? `Sem registros na semana de ${weekLabel(current.start)} a ${weekLabel(current.end)}. Leitura da última semana com treinos.`
              : 'Ainda não há treinos registados nesta semana. Abaixo está a última semana com registros.',
        };
      }
    }
  }

  if (empty || loggedDates.size === 0) {
    const level = 'none';
    return {
      audience,
      week: current,
      previous_week: previous,
      lookback_start: lookbackStart,
      confidence: level,
      confidence_label: confidenceLabel(level, 0, 0),
      headline: buildHeadline({ confidence: level, counts: {}, audience }),
      chart_comment: null,
      primary_chart: { type: 'none', series: [] },
      volume_chart: null,
      consistency,
      highlights: {},
      insights: buildInsights({
        confidence: level,
        counts: { subiu_carga: 0, subiu_reps: 0, estavel: 0, abaixo_ultimo: 0 },
        consistency,
        exercises: [],
      }),
      exercises: [],
      empty: true,
    };
  }

  const marksByKey = new Map();
  for (const session of lookbackSessions) {
    for (const mark of sessionExerciseMarks(session)) {
      if (!marksByKey.has(mark.key)) marksByKey.set(mark.key, []);
      marksByKey.get(mark.key).push(mark);
    }
  }

  const exercises = [];
  for (const [key, marks] of marksByKey) {
    const currentMarks = marks.filter((m) => inInclusiveRange(m.date, current.start, current.end));
    if (currentMarks.length === 0) continue;

    const previousMarks = marks.filter((m) => inInclusiveRange(m.date, previous.start, previous.end));
    const priorMarks = marks.filter((m) => m.date < current.start);
    const currentBest = bestMark(currentMarks);
    const previousBest = previousMarks.length ? bestMark(previousMarks) : bestMark(priorMarks);
    const status = classifyPair(currentBest, previousBest);

    const deltaCarga =
      currentBest?.top.numeric && previousBest?.top.numeric && currentBest.top.unidade === previousBest.top.unidade
        ? Math.round((currentBest.top.carga - previousBest.top.carga) * 100) / 100
        : null;
    const deltaReps =
      currentBest?.top.reps != null && previousBest?.top.reps != null
        ? Math.round((currentBest.top.reps - previousBest.top.reps) * 100) / 100
        : null;

    const weekPoints = weekStarts.map((ws) => {
      const we = addDaysIso(ws, 6);
      const inWeek = marks.filter((m) => inInclusiveRange(m.date, ws, we));
      const best = bestMark(inWeek);
      return {
        week_start: ws,
        label: weekLabel(ws),
        carga: best?.top.numeric ? best.top.carga : null,
        unidade: best?.top.unidade || null,
        volume: best?.volume ?? null,
      };
    });

    exercises.push({
      key,
      name: currentBest.name,
      status,
      comparable: status !== 'novo' && status !== 'dados_incompletos' && status !== 'unidade_mista',
      current: {
        carga: currentBest.top.carga,
        carga_label: currentBest.top.carga_label,
        reps: currentBest.top.reps,
        volume: currentBest.volume,
        unidade: currentBest.top.unidade,
        date: currentBest.date,
      },
      previous: previousBest
        ? {
            carga: previousBest.top.carga,
            carga_label: previousBest.top.carga_label,
            reps: previousBest.top.reps,
            volume: previousBest.volume,
            unidade: previousBest.top.unidade,
            date: previousBest.date,
          }
        : null,
      delta_carga: deltaCarga,
      delta_reps: deltaReps,
      sessions_this_week: new Set(currentMarks.map((m) => m.date)).size,
      week_points: weekPoints,
    });
  }

  exercises.sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  const counts = {
    subiu_carga: exercises.filter((e) => e.status === 'subiu_carga').length,
    subiu_reps: exercises.filter((e) => e.status === 'subiu_reps').length,
    estavel: exercises.filter((e) => e.status === 'estavel').length,
    abaixo_ultimo: exercises.filter((e) => e.status === 'abaixo_ultimo').length,
    novo: exercises.filter((e) => e.status === 'novo').length,
    dados_incompletos: exercises.filter((e) => e.status === 'dados_incompletos').length,
    unidade_mista: exercises.filter((e) => e.status === 'unidade_mista').length,
  };

  const comparableCount = exercises.filter((e) => e.comparable).length;
  const numericCount = exercises.filter((e) => e.current?.carga != null).length;
  const numericShare = exercises.length ? numericCount / exercises.length : 0;
  const lookbackDates = new Set(
    lookbackSessions.filter((s) => s.series && s.series.length).map((s) => String(s.data_ref).slice(0, 10)),
  );

  const confidence = confidenceFrom({
    sessionsLoggedCurrent: loggedDates.size,
    comparableCount,
    sessionsInLookback: lookbackDates.size,
    numericShare,
  });

  const chartExercises = [...exercises]
    .filter((e) => e.week_points.some((p) => p.carga != null))
    .sort((a, b) => {
      const rank = (s) =>
        ({ subiu_carga: 0, subiu_reps: 1, abaixo_ultimo: 2, estavel: 3 }[s] ?? 9);
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      return Math.abs(b.delta_carga || 0) - Math.abs(a.delta_carga || 0);
    })
    .slice(0, audience === 'coach' ? 6 : 3);

  const showVolume = confidence === 'medium' || confidence === 'high';
  let volume_chart = null;
  if (showVolume) {
    const points = weekStarts.map((ws) => {
      let total = 0;
      let any = false;
      for (const ex of exercises) {
        const p = ex.week_points.find((x) => x.week_start === ws);
        if (p?.volume != null) {
          total += p.volume;
          any = true;
        }
      }
      return { week_start: ws, label: weekLabel(ws), volume: any ? Math.round(total) : null };
    });
    if (points.filter((p) => p.volume != null).length >= 2) {
      volume_chart = { points };
    }
  }

  return {
    audience,
    week: current,
    previous_week: previous,
    lookback_start: lookbackStart,
    confidence,
    confidence_label: confidenceLabel(confidence, loggedDates.size, comparableCount),
    headline: buildHeadline({ confidence, counts, audience }),
    chart_comment: buildChartComment({ confidence, exercises, audience }),
    primary_chart: {
      type: chartExercises.length ? 'load' : 'none',
      series: chartExercises.map((e) => ({
        exercise_name: e.name,
        points: e.week_points.map((p) => ({
          week_start: p.week_start,
          label: p.label,
          carga: p.carga,
          unidade: p.unidade,
        })),
      })),
    },
    volume_chart,
    consistency,
    highlights: pickHighlights(exercises),
    insights: buildInsights({ confidence, counts, consistency, exercises }),
    exercises: visibleExercisesForAudience(exercises, audience),
    empty: false,
    counts,
  };
}

const PERIOD_DAYS = {
  '7': 7,
  '30': 30,
  '90': 90,
  '180': 180,
  all: null,
};

const TREND_LABELS = {
  evoluindo: 'Evoluindo',
  estavel: 'Estável',
  em_queda: 'Em queda',
  dados_insuficientes: 'Dados insuficientes',
};

/**
 * Classifica tendência de carga ao longo de sessões (ordenadas por data).
 * Regra principal: delta = última carga − primeira carga (LOAD_EPS = 0,05).
 * Requer ≥ 2 sessões com carga numérica; caso contrário → dados_insuficientes.
 * Com ≥ 4 sessões, reforço: se ≥ 2 das últimas 3 transições forem no mesmo sentido
 * e não conflitarem com first→last, mantém-se o status reforçado.
 */
function classifyTrend(points) {
  const numeric = (points || []).filter((p) => p.carga != null && Number.isFinite(p.carga));
  if (numeric.length < 2) return 'dados_insuficientes';

  const first = numeric[0];
  const last = numeric[numeric.length - 1];
  if (first.unidade && last.unidade && first.unidade !== last.unidade) {
    return 'dados_insuficientes';
  }

  const delta = last.carga - first.carga;
  let trend = 'estavel';
  if (delta > LOAD_EPS) trend = 'evoluindo';
  else if (delta < -LOAD_EPS) trend = 'em_queda';

  if (numeric.length >= 4) {
    const recent = numeric.slice(-4);
    let up = 0;
    let down = 0;
    for (let i = 1; i < recent.length; i++) {
      const d = recent[i].carga - recent[i - 1].carga;
      if (d > LOAD_EPS) up += 1;
      else if (d < -LOAD_EPS) down += 1;
    }
    if (up >= 2 && down === 0 && trend !== 'em_queda') trend = 'evoluindo';
    else if (down >= 2 && up === 0 && trend !== 'evoluindo') trend = 'em_queda';
  }

  return trend;
}

function periodBounds(periodKey, asOf = todayIso()) {
  const end = String(asOf).slice(0, 10);
  const days = PERIOD_DAYS[periodKey];
  if (days == null) {
    return { key: periodKey || 'all', days: null, start: null, end };
  }
  return {
    key: String(periodKey),
    days,
    start: addDaysIso(end, -(days - 1)),
    end,
  };
}

function buildProgressionSummary(exercise, period, trend) {
  if (!exercise || exercise.points.length === 0) return null;
  const numeric = exercise.points.filter((p) => p.carga != null);
  const periodLabel =
    period.days != null ? `últimos ${period.days} dias` : 'todo o período registrado';

  if (trend === 'dados_insuficientes') {
    return {
      title: 'Evolução recente',
      body:
        numeric.length === 0
          ? 'Ainda não há registros de carga suficientes para este exercício.'
          : 'Poucos registros disponíveis para identificar uma tendência.',
      trend,
    };
  }

  const deltaLabel = exercise.delta_label;
  if (trend === 'evoluindo' && deltaLabel) {
    return {
      title: 'Evolução recente',
      body: `O aluno aumentou a carga utilizada em ${exercise.name} em ${deltaLabel.replace(/^\+/, '')} nos ${periodLabel}.`,
      trend,
    };
  }
  if (trend === 'em_queda') {
    return {
      title: 'Evolução recente',
      body: 'A carga utilizada apresentou redução nas últimas sessões.',
      trend,
    };
  }
  if (trend === 'estavel' && numeric.length >= 4) {
    const n = Math.min(numeric.length, 4);
    return {
      title: 'Evolução recente',
      body: `A carga permanece estável nas últimas ${n} sessões.`,
      trend,
    };
  }
  return {
    title: 'Evolução recente',
    body: `A carga de ${exercise.name} manteve-se sem alteração relevante nos ${periodLabel}.`,
    trend,
  };
}

/**
 * Progressão de cargas por sessão (Logbook como fonte de verdade).
 * @param {object} input
 * @param {Array} input.sessions
 * @param {string} [input.periodKey] 7|30|90|180|all
 * @param {string} [input.asOf]
 * @param {string} [input.exerciseKey] filtro opcional
 */
function analyzeLoadProgression(input) {
  const periodKey = PERIOD_DAYS[input.periodKey] !== undefined ? input.periodKey : '30';
  const asOf = String(input.asOf || todayIso()).slice(0, 10);
  const period = periodBounds(periodKey, asOf);
  const filterKey = input.exerciseKey ? String(input.exerciseKey) : null;

  let sessions = (input.sessions || []).filter((s) => s && s.data_ref);
  if (period.start) {
    sessions = sessions.filter((s) => {
      const d = String(s.data_ref).slice(0, 10);
      return d >= period.start && d <= period.end;
    });
  } else {
    sessions = sessions.filter((s) => String(s.data_ref).slice(0, 10) <= period.end);
  }

  const marksByKey = new Map();
  for (const session of sessions) {
    const groups = groupSetsByExercise(session.series || []);
    for (const [key, sets] of groups) {
      if (filterKey && key !== filterKey) continue;
      const top = pickTopSet(sets);
      const vol = sessionVolume(sets);
      if (!marksByKey.has(key)) marksByKey.set(key, []);
      marksByKey.get(key).push({
        key,
        name: displayNameFromSets(sets),
        date: String(session.data_ref).slice(0, 10),
        sessao_id: session.id,
        carga: top.numeric ? top.carga : null,
        unidade: top.unidade,
        reps: top.reps,
        carga_label: top.carga_label,
        series_count: sets.length,
        volume: vol.mixed ? null : vol.volume,
      });
    }
  }

  const exercises = [];
  for (const [key, marks] of marksByKey) {
    marks.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.sessao_id).localeCompare(String(b.sessao_id));
    });

    const points = marks.map((m) => ({
      date: m.date,
      carga: m.carga,
      unidade: m.unidade,
      reps: m.reps,
      series_count: m.series_count,
      volume: m.volume,
      carga_label: m.carga_label,
    }));

    const numeric = points.filter((p) => p.carga != null);
    const lastNumeric = numeric.length ? numeric[numeric.length - 1] : null;
    const firstNumeric = numeric.length ? numeric[0] : null;
    let deltaCarga = null;
    let deltaLabel = null;
    if (
      firstNumeric &&
      lastNumeric &&
      firstNumeric.unidade === lastNumeric.unidade &&
      numeric.length >= 2
    ) {
      deltaCarga = Math.round((lastNumeric.carga - firstNumeric.carga) * 100) / 100;
      deltaLabel = formatDeltaLoad(deltaCarga, lastNumeric.unidade);
    }

    const trend = classifyTrend(points);
    exercises.push({
      key,
      name: marks[0]?.name || 'Exercício',
      sessions_count: points.length,
      ultima_carga_label: lastNumeric?.carga_label ?? null,
      delta_carga: deltaCarga,
      delta_label: deltaLabel,
      trend,
      trend_label: TREND_LABELS[trend],
      points,
    });
  }

  exercises.sort((a, b) => {
    if (b.sessions_count !== a.sessions_count) return b.sessions_count - a.sessions_count;
    return a.name.localeCompare(b.name, 'pt');
  });

  const hasAnyLoad = exercises.some((e) => e.points.some((p) => p.carga != null));
  const empty = exercises.length === 0 || !hasAnyLoad;

  let selected = null;
  if (filterKey) {
    selected = exercises.find((e) => e.key === filterKey) || null;
  } else if (exercises.length > 0) {
    selected = exercises.find((e) => e.points.some((p) => p.carga != null)) || exercises[0];
  }

  const summary = selected ? buildProgressionSummary(selected, period, selected.trend) : null;

  return {
    period,
    source: 'logbook',
    empty,
    exercises,
    selected_exercise: selected,
    summary,
  };
}

module.exports = {
  todayIso,
  addDaysIso,
  isoWeekday,
  startOfWeekMonday,
  weekBounds,
  parseCarga,
  parsePrescribedSets,
  normalizeExerciseName,
  exerciseKey,
  formatLoad,
  formatDeltaLoad,
  formatDeltaReps,
  pickTopSet,
  sessionVolume,
  classifyPair,
  classifyTrend,
  periodBounds,
  confidenceFrom,
  analyzeWeeklyEvolution,
  analyzeLoadProgression,
  PERIOD_DAYS,
  TREND_LABELS,
};
