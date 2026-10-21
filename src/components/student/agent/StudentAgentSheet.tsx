import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import AgentActionCard from "@/components/student/agent/AgentActionCard";
import { AGENT_BASE_CHIPS } from "@/components/student/agent/agent-chips";
import type { AgentCardAction, AgentThreadItem } from "@/hooks/useStudentAgent";

type StudentAgentSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: AgentThreadItem[];
  status: "idle" | "sending" | "error";
  error: string | null;
  onSend: (text: string) => void;
  onCardAction: (action: AgentCardAction) => void;
};

const StudentAgentSheet = ({
  open,
  onOpenChange,
  thread,
  status,
  error,
  onSend,
  onCardAction,
}: StudentAgentSheetProps) => {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const sending = status === "sending";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread, open, sending]);

  const submit = () => {
    const t = draft.trim();
    if (!t || sending) return;
    setDraft("");
    onSend(t);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "flex max-h-[85vh] flex-col gap-0 rounded-t-2xl p-0",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <SheetHeader className="border-b border-border/60 px-4 pb-3 pt-4 text-left">
          <SheetTitle className="text-base">Assistente do dia</SheetTitle>
          <SheetDescription className="text-xs">
            Diz o que precisas ou usa um atalho. Sempre com o teu plano real.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {AGENT_BASE_CHIPS.map((chip) => (
              <Button
                key={chip.label}
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-full text-xs"
                disabled={sending}
                onClick={() => onSend(chip.text)}
              >
                {chip.label}
              </Button>
            ))}
          </div>

          {thread.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Experimenta “O que faço agora?” para ver a próxima acção do plano.
            </p>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A pensar…
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border/60 px-4 py-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreve aqui…"
              disabled={sending}
              className="flex-1"
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Enviar">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StudentAgentSheet;
