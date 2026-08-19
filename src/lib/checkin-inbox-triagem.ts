import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";
import { isCheckinPrioridade } from "@/lib/checkin-highlights";
import {
  computeAdherenceAttentionScore,
  isQuedaExecucao7d,
  type AdherenceScoreInput,
} from "@/lib/adherence-carteira-score";

export type InboxTriagemSignals = AdherenceScoreInput & {
  pendingCheckin?: boolean;
};

export type InboxTriagemItem = {
  checkin: WeeklyCheckinRecord;
  studentId?: string;
  signals?: InboxTriagemSignals;
  attentionScore?: number;
};

export function attentionScoreFromSignals(signals?: InboxTriagemSignals): number {
  return computeAdherenceAttentionScore({
    pendingCheckin: signals?.pendingCheckin,
    missDays: signals?.missDays,
    mealPct: signals?.mealPct,
    workoutPct: signals?.workoutPct,
  }).score;
}

export function hasQuedaExecucao7d(signals?: InboxTriagemSignals): boolean {
  return isQuedaExecucao7d({
    missDays: signals?.missDays,
    mealPct: signals?.mealPct,
    workoutPct: signals?.workoutPct,
  });
}

/**
 * Ranking determinístico da inbox: atenção 7d + check-in pendente, depois prioridade, depois recência.
 * Sem LLM.
 */
export function compareInboxForTriagem(a: InboxTriagemItem, b: InboxTriagemItem): number {
  const sa = a.attentionScore ?? attentionScoreFromSignals(a.signals);
  const sb = b.attentionScore ?? attentionScoreFromSignals(b.signals);
  if (sb !== sa) return sb - sa;

  const pa = isCheckinPrioridade(a.checkin) ? 0 : 1;
  const pb = isCheckinPrioridade(b.checkin) ? 0 : 1;
  if (pa !== pb) return pa - pb;

  const ta = new Date(a.checkin.created_at || 0).getTime();
  const tb = new Date(b.checkin.created_at || 0).getTime();
  return tb - ta;
}
