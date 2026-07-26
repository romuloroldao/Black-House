import { Dumbbell, ClipboardCheck, Utensils, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ProximaAcao = {
  type?: string;
  title?: string;
  description?: string;
  tab?: string;
  payload?: {
    dieta_id?: string;
    meal_key?: string;
    plano?: string;
    treino_id?: string;
    sessao_id?: string;
    status?: string;
  };
};

type NextActionHeroProps = {
  loading?: boolean;
  acao: ProximaAcao | null;
  onPrimary: () => void;
  onAskAgent: () => void;
  className?: string;
};

function iconFor(type?: string) {
  if (type === "today_workout") return Dumbbell;
  if (type === "checkin") return ClipboardCheck;
  if (type === "next_meal" || type === "open_diet") return Utensils;
  return Sparkles;
}

function primaryLabel(type?: string): string {
  if (type === "today_workout") return "Começar treino";
  if (type === "checkin") return "Abrir check-in";
  if (type === "next_meal") return "Ver refeição";
  if (type === "open_diet") return "Abrir dieta";
  if (type === "idle") return "Ver plano";
  return "Continuar";
}

const NextActionHero = ({
  loading,
  acao,
  onPrimary,
  onAskAgent,
  className,
}: NextActionHeroProps) => {
  if (loading) {
    return (
      <div className={cn("space-y-2 rounded-2xl border border-border/60 p-4", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const type = acao?.type || "idle";
  const Icon = iconFor(type);
  const title = acao?.title || "Seguir o plano de hoje";
  const body =
    acao?.description ||
    (type === "idle"
      ? "Estás em dia. Podes perguntar qualquer coisa ao agente."
      : "A tua próxima acção está pronta.");

  return (
    <section
      className={cn(
        "rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm",
        className,
      )}
      aria-labelledby="next-action-heading"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Próxima acção
      </p>
      <div className="mt-2 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="next-action-heading" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" className="min-h-11" onClick={onPrimary}>
          {primaryLabel(type)}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={onAskAgent}>
          Perguntar ao agente
        </Button>
      </div>
    </section>
  );
};

export default NextActionHero;
