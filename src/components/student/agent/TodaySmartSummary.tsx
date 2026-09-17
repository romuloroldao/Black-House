import { getTimeGreeting } from "@/components/student/agent/compose-home-opening";
import { Camera, Check, Dumbbell, Flame, Utensils } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getAlunoFirstName } from "@/lib/aluno-display";
import { cn } from "@/lib/utils";
import type { AlunoHojeResponse } from "@/types/aluno-hoje";
import type { ProximaAcao } from "@/components/student/agent/NextActionHero";

export type TodaySmartFact = {
  id: string;
  icon: typeof Utensils;
  label: string;
};

type TodaySmartSummaryProps = {
  loading?: boolean;
  data: AlunoHojeResponse | null;
  proxima?: ProximaAcao | null;
  className?: string;
};

/** Lista compacta legada (Home agent: briefing vai no chat 1×/dia). */
export function buildTodaySmartFacts(
  data: AlunoHojeResponse | null,
  proxima?: ProximaAcao | null,
): TodaySmartFact[] {
  const facts: TodaySmartFact[] = [];
  const mealPending = proxima?.type === "next_meal" || proxima?.type === "open_diet";
  if (mealPending) {
    facts.push({
      id: "diet",
      icon: Utensils,
      label: proxima?.description ? `Próxima: ${proxima.description}` : "Refeição pendente",
    });
  } else {
    facts.push({ id: "diet", icon: Check, label: "Dieta em dia" });
  }
  if (data?.treino?.descanso_hoje) {
    facts.push({ id: "workout", icon: Dumbbell, label: "Treino de descanso" });
  } else if (data?.treino?.detalhe?.nome) {
    facts.push({ id: "workout", icon: Dumbbell, label: `Treino · ${data.treino.detalhe.nome}` });
  }
  if (
    data?.contadores?.checkin_due ||
    (data?.fotos_evolucao && !data.fotos_evolucao.enviou_esta_semana)
  ) {
    facts.push({ id: "photo", icon: Camera, label: "Foto semanal pendente" });
  }
  const weeks = data?.checkin_streak?.semanas_consecutivas;
  if (weeks != null && weeks > 0) {
    facts.push({ id: "streak", icon: Flame, label: `${weeks} semanas consecutivas` });
  }
  return facts.slice(0, 4);
}

/** Compat mínima — Home agent não renderiza isto. */
const TodaySmartSummary = ({ loading, data, className }: TodaySmartSummaryProps) => {
  const firstName = getAlunoFirstName(
    data?.aluno as { nome?: string; email?: string } | null,
    "atleta",
  );
  if (loading) {
    return (
      <div className={cn("py-0.5", className)} aria-busy>
        <Skeleton className="h-6 w-44" />
      </div>
    );
  }
  return (
    <header className={cn("py-0.5", className)} aria-label="Saudação">
      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
        {getTimeGreeting()}, {firstName}
      </h1>
    </header>
  );
};

export default TodaySmartSummary;
