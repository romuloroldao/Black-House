import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isIncomingUnreadMessage } from "@/lib/message-read";

const StudentChatView = () => {
  const { user } = useAuth();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && user.role === "aluno") {
      loadChat();
    }
  }, [user]);

  useEffect(() => {
    if (conversaId && user?.role === "aluno") {
      const intervalId = setInterval(() => {
        loadChatMessages();
      }, 5000);
      return () => clearInterval(intervalId);
    }
  }, [conversaId, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChat = async () => {
    if (!user?.id || user.role !== "aluno") {
      toast.error("Acesso negado. Apenas alunos podem acessar mensagens.");
      return;
    }

    const alunoResult = await apiClient.getMeSafe();
    if (!alunoResult.success || !alunoResult.data) {
      toast.error("Aluno não encontrado. Verifique se seu perfil está vinculado corretamente.");
      return;
    }

    if (!alunoResult.data.coach_id) {
      toast.error("Você não tem um coach vinculado.");
      return;
    }

    const mensagensResult = await apiClient.requestSafe<any[]>("/api/mensagens");
    const mensagensData =
      mensagensResult.success && Array.isArray(mensagensResult.data) ? mensagensResult.data : [];

    const conversaIdFromMessages = mensagensData.length > 0 ? mensagensData[0].conversa_id : null;
    if (!conversaIdFromMessages) {
      const novaMensagemRes = await apiClient.requestSafe<any>("/api/mensagens", {
        method: "POST",
        body: JSON.stringify({
          conteudo: "Iniciando conversa",
        }),
      });

      if (novaMensagemRes.success && novaMensagemRes.data?.conversa_id) {
        setConversaId(novaMensagemRes.data.conversa_id);
        await loadChatMessages(novaMensagemRes.data.conversa_id);
      }
      return;
    }

    setConversaId(conversaIdFromMessages);
    await loadChatMessages(conversaIdFromMessages);
  };

  const loadChatMessages = async (conversaIdParam?: string) => {
    const id = conversaIdParam || conversaId;
    if (!id) return;
    if (!user || user.role !== "aluno") return;

    const mensagensResult = await apiClient.requestSafe<any[]>(`/api/mensagens?conversaId=${id}`);
    const mensagensData =
      mensagensResult.success && Array.isArray(mensagensResult.data) ? mensagensResult.data : [];

    setMensagens(mensagensData);
    setTimeout(scrollToBottom, 100);

    const hasUnread = mensagensData.some((msg: any) => isIncomingUnreadMessage(msg, user.id));
    if (hasUnread) {
      await apiClient.requestSafe("/api/mensagens/mark-read", {
        method: "POST",
        body: JSON.stringify({ conversa_id: id }),
      });
      setMensagens((prev) =>
        prev.map((msg) =>
          isIncomingUnreadMessage(msg, user.id) ? { ...msg, lida: true } : msg,
        ),
      );
    }
  };

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaId) return;

    if (!user?.id || user.role !== "aluno") {
      toast.error("Acesso negado. Apenas alunos podem enviar mensagens.");
      return;
    }

    const result = await apiClient.requestSafe("/api/mensagens", {
      method: "POST",
      body: JSON.stringify({
        conversa_id: conversaId,
        conteudo: novaMensagem.trim(),
      }),
    });

    if (!result.success) {
      toast.error(result.error || "Erro ao enviar mensagem. Tente novamente.");
      return;
    }

    setNovaMensagem("");
    await loadChatMessages();
  };

  return (
    <div className="mx-auto w-full max-w-3xl md:max-w-4xl">
      <Card className="flex max-h-[min(72dvh,720px)] min-h-[min(420px,55dvh)] flex-col overflow-hidden rounded-xl border-border/80 shadow-card md:min-h-[min(520px,62dvh)]">
        <CardHeader className="shrink-0 border-b border-border/80 px-4 py-4 md:px-8 md:py-5">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
            Conversa com seu coach
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-5 md:px-8 md:py-6">
          {mensagens.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center px-4">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-3 h-12 w-12 opacity-50" aria-hidden />
                <p>Inicie a conversa com seu coach</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {mensagens.map((mensagem) => {
                const isMe = mensagem.remetente_id === user?.id;
                return (
                  <div
                    key={mensagem.id}
                    className={cn("flex w-full", isMe ? "justify-end pl-6 md:pl-12" : "justify-start pr-6 md:pr-12")}
                  >
                    <div
                      className={cn(
                        "max-w-[min(100%,18rem)] rounded-2xl px-4 py-2.5 md:max-w-[min(100%,22rem)] md:px-5 md:py-3",
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/80 text-foreground",
                      )}
                    >
                      <p className="text-sm leading-relaxed">{mensagem.conteudo}</p>
                      <p className="mt-1.5 text-xs opacity-70">
                        {new Date(mensagem.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1 shrink-0" aria-hidden />
            </div>
          )}
        </CardContent>

        <div className="shrink-0 border-t border-border/80 px-4 py-4 md:px-8 md:py-5">
          <div className="flex gap-3">
            <Input
              placeholder="Digite sua mensagem..."
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleEnviarMensagem();
                }
              }}
              className="min-h-11 flex-1"
            />
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={handleEnviarMensagem}
              aria-label="Enviar mensagem"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StudentChatView;
