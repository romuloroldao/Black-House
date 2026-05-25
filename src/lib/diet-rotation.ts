import type { DietPlano } from "@/lib/diet-student-utils";

export type DietRotationConfig = {
  rotacao_ativa?: boolean | null;
  rotacao_dias_plano_a?: number | null;
  rotacao_dias_plano_b?: number | null;
  rotacao_plano_inicial?: string | null;
  rotacao_data_inicio?: string | null;
  created_at?: string | null;
};

export type DietRotationDayInfo = {
  plano: DietPlano;
  /** Ex.: "3 dias Plano A · 1 dia Plano B" */
  cycleSummary: string;
  /** Ex.: "Hoje: Plano A (dia 2 de 3)" */
  todayLabel: string;
  dayInBlock: number;
  blockLength: number;
  cycleLength: number;
  dayIndexInCycle: number;
};

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = String(value).slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfCalendarDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function diffCalendarDays(from: Date, to: Date): number {
  const a = startOfCalendarDay(from).getTime();
  const b = startOfCalendarDay(to).getTime();
  return Math.round((b - a) / 86400000);
}

export function isRotationEnabled(config: DietRotationConfig | null | undefined): boolean {
  if (!config?.rotacao_ativa) return false;
  const a = Number(config.rotacao_dias_plano_a) || 0;
  const b = Number(config.rotacao_dias_plano_b) || 0;
  return a >= 1 && b >= 1;
}

export function buildRotationSequence(config: DietRotationConfig): DietPlano[] {
  const diasA = Math.max(0, Number(config.rotacao_dias_plano_a) || 0);
  const diasB = Math.max(0, Number(config.rotacao_dias_plano_b) || 0);
  const inicial = String(config.rotacao_plano_inicial || "A").toUpperCase() === "B" ? "B" : "A";
  const seq: DietPlano[] = [];
  if (inicial === "A") {
    for (let i = 0; i < diasA; i++) seq.push("A");
    for (let i = 0; i < diasB; i++) seq.push("B");
  } else {
    for (let i = 0; i < diasB; i++) seq.push("B");
    for (let i = 0; i < diasA; i++) seq.push("A");
  }
  return seq;
}

function blockAtIndex(sequence: DietPlano[], index: number) {
  const plano = sequence[index];
  let start = index;
  while (start > 0 && sequence[start - 1] === plano) start -= 1;
  let end = index;
  while (end < sequence.length - 1 && sequence[end + 1] === plano) end += 1;
  return {
    plano,
    dayInBlock: index - start + 1,
    blockLength: end - start + 1,
  };
}

export function getRotationForDate(
  config: DietRotationConfig,
  date: Date = new Date(),
): DietRotationDayInfo | null {
  if (!isRotationEnabled(config)) return null;

  const sequence = buildRotationSequence(config);
  if (sequence.length === 0) return null;

  const anchor =
    parseDateOnly(config.rotacao_data_inicio) ||
    parseDateOnly(config.created_at) ||
    startOfCalendarDay(date);

  const days = diffCalendarDays(anchor, date);
  const idx = ((days % sequence.length) + sequence.length) % sequence.length;
  const block = blockAtIndex(sequence, idx);

  const diasA = Number(config.rotacao_dias_plano_a) || 0;
  const diasB = Number(config.rotacao_dias_plano_b) || 0;
  const cycleSummary = `${diasA} dia${diasA !== 1 ? "s" : ""} Plano A · ${diasB} dia${diasB !== 1 ? "s" : ""} Plano B`;

  return {
    plano: block.plano,
    cycleSummary,
    todayLabel: `Hoje: Plano ${block.plano} (dia ${block.dayInBlock} de ${block.blockLength})`,
    dayInBlock: block.dayInBlock,
    blockLength: block.blockLength,
    cycleLength: sequence.length,
    dayIndexInCycle: idx + 1,
  };
}

export function getPlanoForToday(config: DietRotationConfig): DietPlano | null {
  return getRotationForDate(config)?.plano ?? null;
}
