/** Calendário civil com fuso IANA (sem libs externas). */

export const APP_TIME_ZONE = "America/Sao_Paulo";

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

/** Date estável ao meio-dia local do runtime a partir de YYYY-MM-DD (ou instante → civil TZ). */
export function civilDateAtNoon(
  value: string | Date | null | undefined,
  timeZone: string = APP_TIME_ZONE,
): Date | null {
  if (value == null || value === "") return null;

  let ymd: string | null = null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      ymd = trimmed;
    } else {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) ymd = civilDateKey(parsed, timeZone);
    }
  } else if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    ymd = civilDateKey(value, timeZone);
  }

  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function diffCivilDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}
