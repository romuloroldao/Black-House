import { normalizePlanoLetter, sortPlanos, type DietPlano } from "@/lib/diet-plano";
import {
  APP_TIME_ZONE,
  civilDateAtNoon,
  civilDateKey,
  diffCivilDays,
} from "@/lib/calendar-date";

export type { DietPlano };

export type RotationBlock = {
  plano: DietPlano;
  dias: number;
};

export type DietRotationConfig = {
  rotacao_ativa?: boolean | null;
  rotacao_sequencia?: RotationBlock[] | null;
  rotacao_dias_plano_a?: number | null;
  rotacao_dias_plano_b?: number | null;
  rotacao_plano_inicial?: string | null;
  rotacao_data_inicio?: string | null;
  created_at?: string | null;
};

export type DietRotationDayInfo = {
  plano: DietPlano;
  cycleSummary: string;
  todayLabel: string;
  dayInBlock: number;
  blockLength: number;
  cycleLength: number;
  dayIndexInCycle: number;
  /** Blocos do ciclo (para UI). */
  blocks: RotationBlock[];
  /** True quando a data ainda é anterior a rotacao_data_inicio. */
  beforeStart?: boolean;
};

function parseJsonBlocks(raw: unknown): RotationBlock[] | null {
  if (!raw) return null;
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const blocks: RotationBlock[] = [];
  for (const entry of arr) {
    const plano = normalizePlanoLetter(entry?.plano);
    const dias = Number(entry?.dias);
    if (!plano || !Number.isFinite(dias) || dias < 1) continue;
    blocks.push({ plano, dias: Math.min(14, Math.floor(dias)) });
  }
  return blocks.length > 0 ? blocks : null;
}

/** Normaliza ciclo: JSON → legado A/B. */
export function normalizeRotationBlocks(config: DietRotationConfig | null | undefined): RotationBlock[] {
  const fromJson = parseJsonBlocks(config?.rotacao_sequencia);
  if (fromJson?.length) return fromJson;

  const a = Number(config?.rotacao_dias_plano_a) || 0;
  const b = Number(config?.rotacao_dias_plano_b) || 0;
  if (a < 1 || b < 1) return [];

  const inicial = String(config?.rotacao_plano_inicial || "A").toUpperCase() === "B" ? "B" : "A";
  if (inicial === "B") {
    return [
      { plano: "B", dias: b },
      { plano: "A", dias: a },
    ];
  }
  return [
    { plano: "A", dias: a },
    { plano: "B", dias: b },
  ];
}

export function formatRotationBlocksSummary(blocks: RotationBlock[]): string {
  if (!blocks.length) return "";
  return blocks
    .map((b) => `${b.dias} dia${b.dias !== 1 ? "s" : ""} Plano ${b.plano}`)
    .join(" · ");
}

export function formatRotationBadgeLabel(
  config: DietRotationConfig | null | undefined,
): string | null {
  if (!isRotationEnabled(config)) return null;
  const blocks = normalizeRotationBlocks(config);
  const short = blocks.map((b) => `${b.dias}${b.plano}`).join("·");
  return `Ciclo ${short} activo`;
}

export function getPlanosFromRotationConfig(
  config: DietRotationConfig | null | undefined,
): DietPlano[] {
  return sortPlanos(normalizeRotationBlocks(config).map((b) => b.plano));
}

export function isRotationEnabled(config: DietRotationConfig | null | undefined): boolean {
  if (!config?.rotacao_ativa) return false;
  return normalizeRotationBlocks(config).length > 0;
}

export function buildRotationSequence(config: DietRotationConfig): DietPlano[] {
  const blocks = normalizeRotationBlocks(config);
  const seq: DietPlano[] = [];
  for (const block of blocks) {
    for (let i = 0; i < block.dias; i++) seq.push(block.plano);
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

/**
 * Âncora do ciclo em dia civil America/Sao_Paulo.
 * Preferir rotacao_data_inicio; created_at usa o dia BRT (não fatia UTC).
 */
export function resolveRotationAnchor(
  config: DietRotationConfig,
  timeZone: string = APP_TIME_ZONE,
): Date | null {
  if (config.rotacao_data_inicio) {
    const fromStart = civilDateAtNoon(config.rotacao_data_inicio, timeZone);
    if (fromStart) return fromStart;
  }
  if (config.created_at) {
    return civilDateAtNoon(config.created_at, timeZone);
  }
  return null;
}

export function getRotationForDate(
  config: DietRotationConfig,
  date: Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
): DietRotationDayInfo | null {
  if (!isRotationEnabled(config)) return null;

  const blocks = normalizeRotationBlocks(config);
  const sequence = buildRotationSequence(config);
  if (sequence.length === 0) return null;

  const today = civilDateAtNoon(civilDateKey(date, timeZone), timeZone);
  if (!today) return null;

  const anchor = resolveRotationAnchor(config, timeZone) || today;
  const daysRaw = diffCivilDays(anchor, today);
  // Antes da data de início: permanece no 1º dia do ciclo (não envelopa).
  const beforeStart = daysRaw < 0;
  const days = beforeStart ? 0 : daysRaw;
  const idx = days % sequence.length;
  const block = blockAtIndex(sequence, idx);

  return {
    plano: block.plano,
    cycleSummary: formatRotationBlocksSummary(blocks),
    todayLabel: beforeStart
      ? `Ciclo inicia em breve · Plano ${block.plano} (pré-início)`
      : `Hoje: Plano ${block.plano} (dia ${block.dayInBlock} de ${block.blockLength})`,
    dayInBlock: block.dayInBlock,
    blockLength: block.blockLength,
    cycleLength: sequence.length,
    dayIndexInCycle: idx + 1,
    blocks,
    beforeStart,
  };
}

export function getPlanoForToday(config: DietRotationConfig): DietPlano | null {
  return getRotationForDate(config)?.plano ?? null;
}

/** Converte blocos para payload API (com campos legados A/B quando aplicável). */
export function rotationBlocksToPayload(
  ativa: boolean,
  blocks: RotationBlock[],
  dataInicio: string | null,
): Record<string, unknown> {
  const clean = blocks
    .map((b) => ({
      plano: normalizePlanoLetter(b.plano),
      dias: Math.min(14, Math.max(1, Math.floor(Number(b.dias) || 0))),
    }))
    .filter((b): b is RotationBlock => Boolean(b.plano && b.dias >= 1));

  const blockA = clean.find((b) => b.plano === "A");
  const blockB = clean.find((b) => b.plano === "B");

  return {
    rotacao_ativa: ativa && clean.length > 0,
    rotacao_sequencia: ativa && clean.length > 0 ? clean : null,
    rotacao_dias_plano_a: ativa && blockA ? blockA.dias : null,
    rotacao_dias_plano_b: ativa && blockB ? blockB.dias : null,
    rotacao_plano_inicial: clean[0]?.plano ?? "A",
    rotacao_data_inicio: ativa && dataInicio ? dataInicio : null,
  };
}

/** Sugere ciclo a partir dos cardápios presentes nas refeições. */
export function inferRotationBlocksFromPlanos(
  planos: DietPlano[],
  options?: { diasA?: number; diasB?: number },
): RotationBlock[] {
  const sorted = sortPlanos(planos);
  if (sorted.length < 2) return [];

  if (sorted.length === 2) {
    const diasA = options?.diasA ?? 3;
    const diasB = options?.diasB ?? 1;
    return [
      { plano: sorted[0], dias: diasA },
      { plano: sorted[1], dias: diasB },
    ];
  }

  return sorted.map((plano) => ({ plano, dias: 1 }));
}
