import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const StudentChatView = () => {
  const { user } = useAuth();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [coachNome, setCoachNome] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // DESIGN-ROLE-MESSAGING-ISOLATION-001: Apenas alunos podem acessar mensagens
    if (user && user.role === 'aluno') {
      loadChat();
    }
  }, [user]);

  useEffect(() => {
    // DESIGN-ROLE-MESSAGING-ISOLATION-001: Polling só para alunos
    if (conversaId && user?.role === 'aluno') {
      // Polling para atualizações (substitui realtime)
      const intervalId = setInterval(() => {
        loadChatMessages();
      }, 5000); // Atualizar a cada 5 segundos

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [conversaId, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChat = async () => {
    // DESIGN-ROLE-MESSAGING-ISOLATION-001: Apenas alunos podem acessar mensagens
    if (!user?.id || user.role !== 'aluno') {
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

    const mensagensResult = await apiClient.requestSafe<any[]>('/api/mensagens');
    const mensagens = mensagensResult.success && Array.isArray(mensagensResult.data) ? mensagensResult.data : [];

    const conversaIdFromMessages = mensagens.length > 0 ? mensagens[0].conversa_id : null;
    if (!conversaIdFromMessages) {
      const novaMensagem = await apiClient.requestSafe<any>('/api/mensagens', {
        method: 'POST',
        body: JSON.stringify({
          conteudo: 'Iniciando conversa'
        })
      });

      if (novaMensagem.success && novaMensagem.data?.conversa_id) {
        setConversaId(novaMensagem.data.conversa_id);
        await loadChatMessages(novaMensagem.data.conversa_id);
      }
      return;
    }

    setConversaId(conversaIdFromMessages);
    await loadChatMessages(conversaIdFromMessages);
  };

  const loadChatMessages = async (conversaIdParam?: string) => {
    const id = conversaIdParam || conversaId;
    if (!id) return;

    // DESIGN-ROLE-MESSAGING-ISOLATION-001: Apenas alunos podem carregar mensagens
    if (!user || user.role !== 'aluno') return;

    const mensagensResult = await apiClient.requestSafe<any[]>(`/api/mensagens?conversaId=${id}`);
    const mensagens = mensagensResult.success && Array.isArray(mensagensResult.data) ? mensagensResult.data : [];

    setMensagens(mensagens);
    setTimeout(scrollToBottom, 100);

    const mensagensNaoLidas = mensagens.filter(
      (msg: any) => msg.destinatario_id === user.id && !msg.lida
    );

    for (const msg of mensagensNaoLidas) {
      await apiClient.requestSafe(`/api/mensagens/${msg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lida: true }),
      });
    }
  };

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaId) return;

    // DESIGN-ROLE-MESSAGING-ISOLATION-001: Apenas alunos podem enviar mensagens
    if (!user?.id || user.role !== 'aluno') {
      toast.error("Acesso negado. Apenas alunos podem enviar mensagens.");
      return;
    }

    const result = await apiClient.requestSafe('/api/mensagens', {
      method: 'POST',
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
    <div className="space-y-6 h-[calc(100vh-12rem)]">
      <div>
        <h1 className="text-3xl font-bold mb-2">Chat com Coach</h1>
        <p className="text-muted-foreground">
          Tire suas dúvidas e receba orientações
        </p>
      </div>

      <Card className="shadow-card flex flex-col h-full">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Conversa com seu Coach
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensagens.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Inicie a conversa com seu coach</p>
              </div>
            </div>
          ) : (
            mensagens.map((mensagem) => {
              const isMe = mensagem.remetente_id === user?.id;
              return (
                <div
                  key={mensagem.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm">{mensagem.conteudo}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(mensagem.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleEnviarMensagem();
                }
              }}
            />
            <Button onClick={handleEnviarMensagem}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StudentChatView;
