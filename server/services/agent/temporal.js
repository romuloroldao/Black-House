/**
 * Parsing temporal determinístico para o Daily Agent (sem LLM).
 * Evita gafes do tipo «treino de amanhã» → resposta de «hoje».
 */

const WEEKDAY_NAMES = {
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado',
  7: 'domingo',
};

const WEEKDAY_PATTERNS = [
  { re: /segunda(\s*-?\s*feira)?/, dia: 1 },
  { re: /terca(\s*-?\s*feira)?/, dia: 2 },
  { re: /quarta(\s*-?\s*feira)?/, dia: 3 },
  { re: /quinta(\s*-?\s*feira)?/, dia: 4 },
  { re: /sexta(\s*-?\s*feira)?/, dia: 5 },
  { re: /sabado/, dia: 6 },
  { re: /domingo/, dia: 7 },
];

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function isoDayOfWeek(date) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, n) {
  const d = toDateOnly(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Offset até ao próximo dia da semana ISO (1–7). Se for hoje, offset 0;
 * se pedir "próxima segunda" e hoje é segunda, avança 7.
 */
function daysUntilWeekday(fromDate, targetDia, { forceNext = false } = {}) {
  const current = isoDayOfWeek(fromDate);
  let delta = (targetDia - current + 7) % 7;
  if (forceNext && delta === 0) delta = 7;
  if (!forceNext && delta === 0) return 0;
  return delta === 0 ? 7 : delta;
}

/**
 * @returns {{
 *   offsetDays: number,
 *   date: Date,
 *   dateIso: string,
 *   label: string,
 *   diaSemana: number,
 *   explicit: boolean,
 *   raw?: string
 * }}
 */
function parseRelativeDay(text, now = new Date()) {
  const t = normalizeText(text);
  const base = toDateOnly(now);

  if (!t) {
    return buildResult(base, 0, false, 'hoje');
  }

  if (/\bdepois\s+de\s+amanha\b|\bdepois\s+amanha\b/.test(t)) {
    return buildResult(addDays(base, 2), 2, true, 'depois de amanhã');
  }
  if (/\bamanha\b/.test(t)) {
    return buildResult(addDays(base, 1), 1, true, 'amanhã');
  }
  if (/\bhoje\b/.test(t)) {
    return buildResult(base, 0, true, 'hoje');
  }

  const forceNext = /\bproxim[oa]\b|\bque\s+vem\b/.test(t);
  for (const { re, dia } of WEEKDAY_PATTERNS) {
    if (re.test(t)) {
      const offset = daysUntilWeekday(base, dia, { forceNext });
      const date = addDays(base, offset);
      const name = WEEKDAY_NAMES[dia];
      const label = offset === 0 ? `hoje (${name})` : name;
      return buildResult(date, offset, true, label);
    }
  }

  // Sem marcador temporal → assume hoje (implícito)
  return buildResult(base, 0, false, 'hoje');
}

function buildResult(date, offsetDays, explicit, label) {
  return {
    offsetDays,
    date,
    dateIso: toIsoDate(date),
    label,
    diaSemana: isoDayOfWeek(date),
    explicit: Boolean(explicit),
  };
}

module.exports = {
  normalizeText,
  parseRelativeDay,
  isoDayOfWeek,
  toIsoDate,
  WEEKDAY_NAMES,
};
