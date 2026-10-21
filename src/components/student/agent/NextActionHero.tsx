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
  /** Abre a tela especializada (secundário — answer-first) */
  onOpenDetails: () => void;
  /** Pergunta ao agente com prompt contextual (primário) */
  onAskAgent: () => void;
  className?: string;
};

function iconFor(type?: string) {
  if (type === "today_workout") return Dumbbell;
  if (type === "checkin") return ClipboardCheck;
  if (type === "next_meal" || type === "open_diet") return Utensils;
  return Sparkles;
}

/** CTA primário: responde no chat */
function askLabel(type?: string): string {
  if (type === "today_workout") return "Ver treino no chat";
  if (type === "checkin") return "Perguntar sobre o check-in";
  if (type === "next_meal") return "Ver refeição no chat";
  if (type === "open_diet") return "Ver dieta no chat";
  if (type === "idle") return "O que faço agora?";
  return "Perguntar ao agente";
}

/** CTA secundário: UI especializada */
function detailsLabel(type?: string): string {
  if (type === "today_workout") return "Abrir sessão";
  if (type === "checkin") return "Abrir check-in";
  if (type === "next_meal") return "Ver detalhes";
  if (type === "open_diet") return "Abrir dieta";
  if (type === "idle") return "Explorar plano";
  return "Ver detalhes";
}

export function askPromptForAcao(type?: string): string {
  if (type === "today_workout") return "Qual meu treino de hoje?";
  if (type === "checkin") return "Preciso fazer o check-in.";
  if (type === "next_meal") return "Qual minha próxima refeição?";
  if (type === "open_diet") return "Como está minha dieta hoje?";
  return "O que faço agora?";
}

const NextActionHero = ({
  loading,
  acao,
  onOpenDetails,
  onAskAgent,
  className,
}: NextActionHeroProps) => {
  if (loading) {
    return (
      <div className={cn("space-y-2 rounded-2xl border border-border/60 p-4", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-56" />
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
      ? "Você está em dia. Pergunte qualquer coisa ao agente."
      : "Sua próxima ação está pronta — respondo no chat.");

  return (
    <section
      className={cn(
        "rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm",
        className,
      )}
      aria-labelledby="next-action-heading"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Próxima ação
      </p>
      <div className="mt-2 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="next-action-heading" className="text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto motion-safe:active:scale-[0.98] motion-safe:transition-transform motion-safe:duration-100"
          onClick={onAskAgent}
        >
          {askLabel(type)}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto motion-safe:active:scale-[0.98] motion-safe:transition-transform motion-safe:duration-100"
          onClick={onOpenDetails}
        >
          {detailsLabel(type)}
        </Button>
      </div>
    </section>
  );
};

export default NextActionHero;
