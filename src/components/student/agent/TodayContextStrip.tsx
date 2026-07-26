import { Dumbbell, Utensils, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AlunoHojeResponse } from "@/types/aluno-hoje";

type TodayContextStripProps = {
  loading?: boolean;
  data: AlunoHojeResponse | null;
  onOpenDiet: () => void;
  onOpenWorkout: () => void;
  onOpenPending: () => void;
  className?: string;
};

const TodayContextStrip = ({
  loading,
  data,
  onOpenDiet,
  onOpenWorkout,
  onOpenPending,
  className,
}: TodayContextStripProps) => {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-3 gap-2", className)}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const treinoNome =
    data?.treino?.descanso_hoje
      ? "Descanso"
      : data?.treino?.detalhe?.nome || "Sem treino";
  const dietaLabel =
    data?.dieta_rotacao?.today_label ||
    (data?.dieta as { nome?: string } | null)?.nome ||
    "Dieta";
  const pendencias = data?.contadores?.pendencias_total ?? data?.pendencias?.length ?? 0;

  const items = [
    {
      id: "diet",
      label: "Dieta",
      value: dietaLabel,
      icon: Utensils,
      onClick: onOpenDiet,
    },
    {
      id: "workout",
      label: "Treino",
      value: treinoNome,
      icon: Dumbbell,
      onClick: onOpenWorkout,
    },
    {
      id: "pending",
      label: "Pendências",
      value: pendencias > 0 ? String(pendencias) : "Em dia",
      icon: ListTodo,
      onClick: onOpenPending,
    },
  ] as const;

  return (
    <div
      className={cn("grid grid-cols-3 gap-2", className)}
      role="group"
      aria-label="Resumo de hoje"
    >
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="outline"
          className="h-auto min-h-[4.25rem] flex-col items-start gap-1 px-2.5 py-2 text-left"
          onClick={item.onClick}
        >
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <item.icon className="h-3 w-3" aria-hidden />
            {item.label}
          </span>
          <span className="line-clamp-2 w-full text-xs font-semibold text-foreground">
            {item.value}
          </span>
        </Button>
      ))}
    </div>
  );
};

export default TodayContextStrip;
