import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AgentActionCard from "@/components/student/agent/AgentActionCard";
import type { AgentChip } from "@/components/student/agent/agent-chips";
import type { AgentCardAction, AgentThreadItem } from "@/hooks/useStudentAgent";

type AgentThreadProps = {
  thread: AgentThreadItem[];
  status: "idle" | "sending" | "error";
  error: string | null;
  chips: AgentChip[];
  onSend: (text: string) => void;
  onCardAction: (action: AgentCardAction) => void;
  emptyHint?: string;
  className?: string;
};

const AgentThread = ({
  thread,
  status,
  error,
  chips,
  onSend,
  onCardAction,
  emptyHint = "Pergunta qualquer coisa ou usa um atalho. O plano de hoje está ligado.",
  className,
}: AgentThreadProps) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const sending = status === "sending";

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    // nearest evita “saltar” o scroll do main para o fim da página
    el.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [thread, sending]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos do agente">
        {chips.slice(0, 8).map((chip) => (
          <Button
            key={chip.label}
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-9 rounded-full text-xs"
            disabled={sending}
            onClick={() => onSend(chip.text)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3" aria-live="polite" aria-relevant="additions" aria-busy={sending}>
        {thread.length === 0 && (
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        )}

        {thread.map((item) => (
          <div
            key={item.id}
            className={cn(
              "max-w-[95%] space-y-2",
              item.role === "user" ? "ml-auto" : "mr-auto",
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-3 py-2 text-sm",
                item.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {item.content}
            </div>
            {item.role === "assistant" &&
              item.cards?.map((card, idx) => (
                <AgentActionCard
                  key={`${item.id}-card-${idx}`}
                  card={card}
                  disabled={sending}
                  onAction={onCardAction}
                />
              ))}
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            A pensar…
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default AgentThread;
