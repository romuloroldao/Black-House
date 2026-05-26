import { subDays } from "date-fns";
import { hasRelato, isCheckinRespondido } from "@/lib/checkin-display";
import { isCheckinPrioridade } from "@/lib/checkin-highlights";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";

export type InboxFilterId =
  | "pendentes"
  | "respondidos"
  | "prioridade"
  | "7d"
  | "30d"
  | "all"
  | "relato"
  | "adesao_baixa"
  | "estresse";

export type InboxFilterOption = {
  id: InboxFilterId;
  label: string;
};

export const INBOX_FILTER_OPTIONS: InboxFilterOption[] = [
  { id: "pendentes", label: "Pendentes de resposta" },
  { id: "prioridade", label: "Prioridade" },
  { id: "respondidos", label: "Respondidos" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "all", label: "Todo o período" },
  { id: "relato", label: "Com relato" },
  { id: "adesao_baixa", label: "Adesão baixa (≤2)" },
  { id: "estresse", label: "Com estresse" },
];

function isTruthyStress(value: unknown): boolean {
  return value === true || value === "sim";
}

export function matchesInboxFilter(
  checkin: WeeklyCheckinRecord,
  filter: InboxFilterId,
  now: Date = new Date(),
): boolean {
  const created = new Date(checkin.created_at || 0);
  if (Number.isNaN(created.getTime())) return false;

  switch (filter) {
    case "7d":
      return created >= subDays(now, 7);
    case "30d":
      return created >= subDays(now, 30);
    case "all":
      return true;
    case "pendentes":
      return !isCheckinRespondido(checkin);
    case "respondidos":
      return isCheckinRespondido(checkin);
    case "prioridade":
      return isCheckinPrioridade(checkin);
    case "relato":
      return hasRelato(checkin);
    case "adesao_baixa":
      return (checkin.seguiu_plano_nota ?? 5) <= 2;
    case "estresse":
      return isTruthyStress(checkin.estresse_semana);
    default:
      return true;
  }
}

export function countByInboxFilter(
  checkins: WeeklyCheckinRecord[],
  filter: InboxFilterId,
): number {
  return checkins.filter((c) => matchesInboxFilter(c, filter)).length;
}

export function formatFilterLabel(option: InboxFilterOption, count: number): string {
  if (count <= 0) return option.label;
  return `${option.label} (${count})`;
}
