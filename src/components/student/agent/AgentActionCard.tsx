import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentActionCardModel, AgentCardAction } from "@/hooks/useStudentAgent";

type AgentActionCardProps = {
  card: AgentActionCardModel;
  disabled?: boolean;
  onAction: (action: AgentCardAction) => void;
};

function labelForAction(action: AgentCardAction | null | undefined, fallback: string): string {
  if (!action) return fallback;
  if (action.name === "apply_substitution") return "Usar esta opção";
  if (action.name === "clear_substitution") return "Desfazer";
  if (action.name === "complete_meal") return "Concluir refeição";
  if (action.name === "log_body_weight" || action.name === "ask_weight" || action.name === "prompt_weight") {
    return "Registar peso";
  }
  if (action.name === "open_ui") {
    const t = String(action.args?.target || "");
    if (t === "dieta") return fallback === "Ver mais" ? "Ver mais detalhes" : "Ver dieta";
    if (t === "treino" || t === "treino_sessao") return t === "treino_sessao" ? "Começar treino" : "Ver treino";
    if (t === "meal_photo") return "Tirar foto";
    if (t === "checkin") return "Abrir check-in";
    if (t === "coach_chat") return "Falar com o coach";
    if (t === "progress" || t === "progress_photos") {
      return t === "progress_photos" ? "Comparar fotos" : "Ver evolução completa";
    }
    if (t === "reports") return "Ver relatórios";
    if (t === "videos") return "Ver vídeos";
    if (t === "profile") return "Abrir perfil";
    return "Abrir";
  }
  if (action.type === "approve") return "Enviar";
  if (action.type === "reject") return "Descartar";
  return fallback;
}

const AgentActionCard = ({ card, disabled, onAction }: AgentActionCardProps) => {
  const hasItems = Array.isArray(card.items) && card.items.length > 0;
  const clickableItems = hasItems && card.items!.some((i) => i.action);

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border/70 bg-card p-3 shadow-sm",
        "space-y-2",
      )}
    >
      {card.title && (
        <p className="break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
          {card.title}
        </p>
      )}
      {hasItems && clickableItems ? (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/50">
          {card.items!.slice(0, 8).map((item, idx) => {
            const label = item.quantity
              ? `${item.name} · ${item.quantity}`
              : item.name;
            if (item.action) {
              return (
                <li key={`${item.name}-${idx}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAction(item.action!)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm",
                      "hover:bg-muted/60 disabled:opacity-50",
                      "motion-safe:active:scale-[0.99] motion-safe:transition-transform",
                    )}
                  >
                    <span className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">
                      {label}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            }
            return (
              <li
                key={`${item.name}-${idx}`}
                className="px-3 py-2 text-sm text-muted-foreground"
              >
                {label}
              </li>
            );
          })}
        </ul>
      ) : hasItems ? (
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {card.items!.slice(0, 8).map((item, idx) => (
            <li key={`${item.name}-${idx}`} className="break-words [overflow-wrap:anywhere]">
              {item.quantity ? `${item.name} · ${item.quantity}` : item.name}
            </li>
          ))}
        </ul>
      ) : card.body ? (
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {card.body}
        </p>
      ) : null}
      {(card.primary_action || card.secondary_action) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {card.primary_action && (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => onAction(card.primary_action!)}
            >
              {labelForAction(card.primary_action, "Continuar")}
            </Button>
          )}
          {card.secondary_action && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onAction(card.secondary_action!)}
            >
              {labelForAction(card.secondary_action, "Ver mais")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentActionCard;
