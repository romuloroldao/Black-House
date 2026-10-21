import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";

/** Normaliza termo para comparação (minúsculas, sem acentos). */
export function normalizeCheckinSearchTerm(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Padrão ILIKE com escape de % e _ (espelha o backend). */
export function toIlikePattern(term: string): string | null {
  const trimmed = term.trim();
  if (trimmed.length < 2) return null;
  const escaped = trimmed.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${escaped}%`;
}

export function matchesCheckinSearch(
  checkin: WeeklyCheckinRecord,
  studentName: string,
  rawTerm: string,
): boolean {
  const term = normalizeCheckinSearchTerm(rawTerm);
  if (!term) return true;

  const name = normalizeCheckinSearchTerm(studentName ?? "");
  if (name.includes(term)) return true;

  const relato = normalizeCheckinSearchTerm(checkin.nao_cumpriu_porque ?? "");
  return relato.includes(term);
}
