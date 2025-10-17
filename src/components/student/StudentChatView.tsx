import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
    if (user) {
      loadChat();
    }
  }, [user]);

  useEffect(() => {
    if (conversaId) {
      const channel = supabase
        .channel(`mensagens:${conversaId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "mensagens",
            filter: `conversa_id=eq.${conversaId}`,
          },
          (payload) => {
            setMensagens((prev) => [...prev, payload.new]);
            scrollToBottom();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [conversaId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChat = async () => {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id, coach_id")
      .eq("email", user?.email)
      .single();

    if (aluno) {
      // Buscar ou criar conversa
      let { data: conversa } = await supabase
        .from("conversas")
        .select("*")
        .eq("aluno_id", aluno.id)
        .eq("coach_id", aluno.coach_id)
        .single();

      if (!conversa) {
        const { data: novaConversa } = await supabase
          .from("conversas")
          .insert({
            aluno_id: aluno.id,
            coach_id: aluno.coach_id,
          })
          .select()
          .single();
        conversa = novaConversa;
      }

      if (conversa) {
        setConversaId(conversa.id);

        // Carregar mensagens
        const { data: mensagensData } = await supabase
          .from("mensagens")
          .select("*")
          .eq("conversa_id", conversa.id)
          .order("created_at", { ascending: true });

        setMensagens(mensagensData || []);
        setTimeout(scrollToBottom, 100);

        // Marcar mensagens como lidas
        await supabase
          .from("mensagens")
          .update({ lida: true })
          .eq("conversa_id", conversa.id)
          .neq("remetente_id", user.id);
      }
    }
  };

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaId) return;

    const { error } = await supabase.from("mensagens").insert({
      conversa_id: conversaId,
      remetente_id: user?.id,
      conteudo: novaMensagem,
    });

    if (error) {
      toast.error("Erro ao enviar mensagem");
      return;
    }

    // Atualizar última mensagem da conversa
    await supabase
      .from("conversas")
      .update({
        ultima_mensagem: novaMensagem,
        ultima_mensagem_em: new Date().toISOString(),
      })
      .eq("id", conversaId);

    setNovaMensagem("");
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
