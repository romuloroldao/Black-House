import { useEffect, useRef } from "react";
import { Loader2, MessageCircle } from "lucide-react";
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
  emptyHint = "Pergunte qualquer coisa — respondo com o seu plano de hoje.",
  className,
}: AgentThreadProps) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const sending = status === "sending";
  const isEmpty = thread.length === 0;

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    el.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [thread, sending]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <div className="flex shrink-0 flex-wrap gap-2" role="group" aria-label="Atalhos do agente">
        {chips.slice(0, 4).map((chip, idx) => (
          <Button
            key={chip.label}
            type="button"
            size="sm"
            variant={isEmpty && idx === 0 ? "default" : "secondary"}
            className={cn(
              "min-h-9 rounded-full text-xs",
              "motion-safe:active:scale-[0.98] motion-safe:transition-transform motion-safe:duration-100",
            )}
            disabled={sending}
            onClick={() => onSend(chip.text)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <div
        className="min-h-0 flex-1 space-y-3"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={sending}
      >
        {isEmpty && (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">O que você precisa agora?</p>
            <p className="text-sm text-muted-foreground">{emptyHint}</p>
          </div>
        )}

        {thread.map((item) => (
          <div
            key={item.id}
            className={cn(
              "max-w-[95%] space-y-2",
              item.role === "user" ? "ml-auto" : "mr-auto",
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200",
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-3 py-2 text-sm whitespace-pre-line",
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
            <Loader2
              className="h-4 w-4 motion-safe:animate-spin motion-reduce:opacity-70"
              aria-hidden
            />
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
