/**
 * Utilitários de data/hora com fuso IANA (sem dependências externas).
 */

function partsInTimeZone(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? 0 : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: map.weekday,
  };
}

function weekdayToIndex(weekday) {
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

/** Segunda-feira 00:00 na timezone do aluno, como Date UTC. */
function startOfWeekInTimeZone(date, timeZone) {
  const parts = partsInTimeZone(date, timeZone);
  const dayIdx = weekdayToIndex(parts.weekday);
  const diff = dayIdx === 0 ? -6 : 1 - dayIdx;
  const monday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + diff, 12, 0, 0));
  const mon = partsInTimeZone(monday, timeZone);
  return localDateTimeToUtc(
    { year: mon.year, month: mon.month, day: mon.day, hour: 0, minute: 0, second: 0 },
    timeZone,
  );
}

function weekKeyInTimeZone(date, timeZone) {
  return startOfWeekInTimeZone(date, timeZone).toISOString().slice(0, 10);
}

/**
 * Converte componentes locais (timezone IANA) para instante UTC.
 */
function localDateTimeToUtc({ year, month, day, hour, minute = 0, second = 0 }, timeZone) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const target = { year, month, day, hour, minute };

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const parts = partsInTimeZone(new Date(guess), timeZone);
    if (
      parts.year === target.year &&
      parts.month === target.month &&
      parts.day === target.day &&
      parts.hour === target.hour &&
      parts.minute === target.minute
    ) {
      return new Date(guess);
    }
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const desiredAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
    guess += desiredAsUtc - localAsUtc;
  }

  return new Date(guess);
}

function endOfWeekDeadlineInTimeZone(date, timeZone) {
  const weekStart = startOfWeekInTimeZone(date, timeZone);
  const parts = partsInTimeZone(weekStart, timeZone);
  return localDateTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day + 6, hour: 23, minute: 59, second: 59 },
    timeZone,
  );
}

/** YYYY-MM-DD no fuso IANA (ex.: America/Sao_Paulo). */
function civilDateKeyInTimeZone(date = new Date(), timeZone = 'America/Sao_Paulo') {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const parts = partsInTimeZone(d, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Âncora de calendário: string YYYY-MM-DD pura, ou instante → dia civil no fuso.
 * Evita slice(0,10) de ISO UTC (ex.: 2026-06-11T00:29Z = 10/06 em BRT).
 */
function civilDateAtNoonInTimeZone(value, timeZone = 'America/Sao_Paulo') {
  if (value == null || value === '') return null;
  let ymd = null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) ymd = trimmed;
    else {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) ymd = civilDateKeyInTimeZone(parsed, timeZone);
    }
  } else if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    ymd = civilDateKeyInTimeZone(value, timeZone);
  }
  if (!ymd) return null;
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffCivilDays(from, to) {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

module.exports = {
  partsInTimeZone,
  startOfWeekInTimeZone,
  weekKeyInTimeZone,
  localDateTimeToUtc,
  endOfWeekDeadlineInTimeZone,
  civilDateKeyInTimeZone,
  civilDateAtNoonInTimeZone,
  diffCivilDays,
};
