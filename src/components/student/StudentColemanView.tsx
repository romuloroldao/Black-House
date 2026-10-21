import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Bot, MessageSquare, Send, Loader2, Sparkles } from "lucide-react";
import { trackStudentEvent } from "@/lib/studentAnalytics";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const CHIPS = [
  "O que tem no meu treino de hoje?",
  "Qual minha próxima refeição no cardápio?",
  "Como faço o check-in semanal?",
  "Posso trocar um alimento da dieta?",
];

type Props = {
  onNavigate?: (tab: string) => void;
};

const StudentColemanView = ({ onNavigate }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o Coleman. Posso ajudar com dúvidas do seu treino, dieta e check-in — com base no plano que seu coach atribuiu. Para mudanças de plano ou saúde, fale com o coach.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackStudentEvent("coleman_opened");
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;

    setShowEscalate(false);
    setInput("");
    const nextHistory = [...messages, { role: "user" as const, content: message }];
    setMessages(nextHistory);
    setLoading(true);
    trackStudentEvent("coleman_message_sent");

    try {
      const history = nextHistory
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(0, -1)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("coleman-assist", {
        body: { message, history },
      });

      if (error) throw error;

      const reply =
        data?.reply ||
        "Não consegui responder. Prefira o Chat com seu coach.";
      const escalate = !!data?.escalate;

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (escalate) {
        setShowEscalate(true);
        trackStudentEvent("coleman_escalated");
      }
    } catch (e: any) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "O Coleman está indisponível no momento. Use o Chat com seu coach para não ficar sem resposta.",
        },
      ]);
      setShowEscalate(true);
      trackStudentEvent("coleman_escalated");
      toast.error("Coleman indisponível — tente o Chat do coach.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] max-w-2xl mx-auto">
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Coleman</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Assistente do seu plano — não substitui o coach
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Dieta</Badge>
          <Badge variant="secondary">Treino</Badge>
          <Badge variant="secondary">Check-in</Badge>
          <Badge variant="outline">Sem diagnóstico médico</Badge>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {m.role === "assistant" && (
                  <Sparkles className="h-3.5 w-3.5 inline mr-1.5 opacity-70" />
                )}
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pensando…
            </div>
          )}
          <div ref={endRef} />
        </CardContent>

        {showEscalate && (
          <div className="px-4 pb-2">
            <Button
              variant="outline"
              className="w-full min-h-[44px]"
              onClick={() => onNavigate?.("chat")}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Falar com o coach
            </Button>
          </div>
        )}

        <div className="p-3 border-t space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {CHIPS.map((chip) => (
              <Button
                key={chip}
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 h-9 text-xs"
                disabled={loading}
                onClick={() => send(chip)}
              >
                {chip}
              </Button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre treino, dieta ou check-in…"
              disabled={loading}
              className="min-h-[44px]"
              maxLength={2000}
            />
            <Button
              type="submit"
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0"
              disabled={loading || !input.trim()}
              aria-label="Enviar"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default StudentColemanView;
