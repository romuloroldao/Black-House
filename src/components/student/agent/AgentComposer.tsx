import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AgentComposerProps = {
  status: "idle" | "sending" | "error";
  onSend: (text: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
};

const AgentComposer = ({
  status,
  onSend,
  autoFocus = false,
  placeholder = "O que precisas agora?",
  className,
}: AgentComposerProps) => {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sending = status === "sending";

  useEffect(() => {
    if (!autoFocus) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [autoFocus]);

  const submit = () => {
    const t = draft.trim();
    if (!t || sending) return;
    setDraft("");
    onSend(t);
  };

  return (
    <form
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm",
        "ring-offset-background focus-within:ring-2 focus-within:ring-ring/40",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-label="Enviar mensagem ao agente"
    >
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        disabled={sending}
        className="min-h-11 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        autoComplete="off"
        aria-label="Mensagem para o agente"
      />
      <Button
        type="submit"
        size="icon"
        className="h-11 w-11 shrink-0 motion-safe:active:scale-[0.96] motion-safe:transition-transform motion-safe:duration-100"
        disabled={sending || !draft.trim()}
        aria-label="Enviar"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </form>
  );
};

export default AgentComposer;
