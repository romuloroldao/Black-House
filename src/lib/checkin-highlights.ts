import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";

/** Mínimo de caracteres no relato para contar como "relato longo". */
export const PRIORIDADE_RELATO_MIN_CHARS = 100;

/** Adesão ao plano ≤ este valor conta como adesão baixa. */
export const PRIORIDADE_ADESAO_MAX = 2;

function isStressOn(checkin: WeeklyCheckinRecord): boolean {
  return checkin.estresse_semana === true || checkin.estresse_semana === "sim";
}

export function hasCheckinEstresse(checkin: WeeklyCheckinRecord): boolean {
  return isStressOn(checkin);
}

export function hasCheckinAdesaoBaixa(checkin: WeeklyCheckinRecord): boolean {
  const nota = checkin.seguiu_plano_nota;
  return nota != null && nota <= PRIORIDADE_ADESAO_MAX;
}

export function hasCheckinRelatoLongo(checkin: WeeklyCheckinRecord): boolean {
  const text = checkin.nao_cumpriu_porque?.trim() ?? "";
  return text.length >= PRIORIDADE_RELATO_MIN_CHARS;
}

/** Prioridade = estresse + adesão baixa + relato longo (triagem BH-CHECKIN-007). */
export function isCheckinPrioridade(checkin: WeeklyCheckinRecord): boolean {
  return (
    hasCheckinEstresse(checkin) &&
    hasCheckinAdesaoBaixa(checkin) &&
    hasCheckinRelatoLongo(checkin)
  );
}

/** Motivos parciais (útil no drawer mesmo sem prioridade total). */
export function getCheckinHighlightFlags(checkin: WeeklyCheckinRecord): string[] {
  const flags: string[] = [];
  if (hasCheckinEstresse(checkin)) flags.push("Estresse");
  if (hasCheckinAdesaoBaixa(checkin)) flags.push("Adesão baixa");
  if (hasCheckinRelatoLongo(checkin)) flags.push("Relato longo");
  return flags;
}

export function getCheckinPrioridadeSummary(checkin: WeeklyCheckinRecord): string {
  return getCheckinHighlightFlags(checkin).join(" · ");
}

/** Ordenação: prioridade primeiro, depois mais recente. */
export function compareCheckinsForTriagem(
  a: WeeklyCheckinRecord,
  b: WeeklyCheckinRecord,
): number {
  const pa = isCheckinPrioridade(a) ? 0 : 1;
  const pb = isCheckinPrioridade(b) ? 0 : 1;
  if (pa !== pb) return pa - pb;

  const ta = new Date(a.created_at || 0).getTime();
  const tb = new Date(b.created_at || 0).getTime();
  return tb - ta;
}
