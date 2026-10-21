export function formatDateBR(value: string | number | Date | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function maskDateBR(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 8);
  if (clean.length > 4) return clean.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
  if (clean.length > 2) return clean.replace(/(\d{2})(\d{1,2})/, "$1/$2");
  return clean;
}

export function parseBRDateToISO(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

const APP_TIME_ZONE = "America/Sao_Paulo";
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dia civil (YYYY-MM-DD) no fuso da plataforma. */
export function todayDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Colunas `date` chegam da API como timestamp (meia-noite em São Paulo); devolve o dia civil. */
export function dateKeyFromApi(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && DATE_KEY_RE.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return todayDateKey(date);
}

function dateKeyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysToDateKey(key: string, days: number): string {
  return new Date(dateKeyToUtcMs(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Dias de `fromKey` até `toKey` (0 = mesmo dia, negativo = já passou). */
export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  return Math.round((dateKeyToUtcMs(toKey) - dateKeyToUtcMs(fromKey)) / DAY_MS);
}

export function formatISODateToBR(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

