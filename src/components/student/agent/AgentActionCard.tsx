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

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card p-3 shadow-sm",
        "space-y-2",
      )}
    >
      {card.title && <p className="text-sm font-semibold text-foreground">{card.title}</p>}
      {hasItems ? (
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {card.items!.slice(0, 8).map((item, idx) => (
            <li key={`${item.name}-${idx}`}>
              {item.quantity ? `${item.quantity} · ${item.name}` : item.name}
            </li>
          ))}
        </ul>
      ) : card.body ? (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{card.body}</p>
      ) : null}
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
    </div>
  );
};

export default AgentActionCard;
