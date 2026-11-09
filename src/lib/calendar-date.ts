/** Calendário civil com fuso IANA (sem libs externas). */

export const APP_TIME_ZONE = "America/Sao_Paulo";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function partsInTimeZone(date: Date, timeZone: string): DateParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** YYYY-MM-DD no fuso indicado (default America/Sao_Paulo). */
export function civilDateKey(
  date: Date | string | number = new Date(),
  timeZone: string = APP_TIME_ZONE,
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const { year, month, day } = partsInTimeZone(d, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Dia civil de um valor vindo da API: "YYYY-MM-DD" é usado como está;
 * um instante (ex.: created_at) é convertido para o dia no fuso indicado.
 */
export function civilDateKeyFromValue(
  value: string | Date | null | undefined,
  timeZone: string = APP_TIME_ZONE,
): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isDateKey(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : civilDateKey(parsed, timeZone);
  }
  if (Number.isNaN(value.getTime())) return null;
  return civilDateKey(value, timeZone);
}

/** Dias entre duas chaves YYYY-MM-DD (to − from), independente do fuso do navegador. */
export function diffDateKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** "Hoje", "Amanhã", "Ontem" ou "qua., 12/11". */
export function relativeDayLabel(key: string, todayKey: string): string {
  const diff = diffDateKeys(todayKey, key);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Ex.: "quarta-feira, 12 de novembro". */
export function longDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
