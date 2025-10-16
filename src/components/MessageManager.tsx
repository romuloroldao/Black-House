import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversa {
  id: string;
  aluno_id: string;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  aluno_nome?: string;
  mensagens_nao_lidas?: number;
}

interface Mensagem {
  id: string;
  remetente_id: string;
  conteudo: string;
  lida: boolean;
  created_at: string;
}

const MessageManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");

  // Carregar conversas
  const carregarConversas = async () => {
    if (!user) return;

    try {
      const { data: conversasData, error } = await supabase
        .from("conversas")
        .select(`
          id,
          aluno_id,
          ultima_mensagem,
          ultima_mensagem_em,
          updated_at
        `)
        .eq("coach_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Buscar nomes dos alunos
      const conversasComNomes = await Promise.all(
        (conversasData || []).map(async (conversa) => {
          const { data: alunoData } = await supabase
            .from("alunos")
            .select("nome")
            .eq("id", conversa.aluno_id)
            .single();

          // Contar mensagens não lidas
          const { count } = await supabase
            .from("mensagens")
            .select("*", { count: "exact", head: true })
            .eq("conversa_id", conversa.id)
            .eq("lida", false)
            .neq("remetente_id", user.id);

          return {
            ...conversa,
            aluno_nome: alunoData?.nome || "Aluno",
            mensagens_nao_lidas: count || 0,
          };
        })
      );

      setConversas(conversasComNomes);
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar mensagens de uma conversa
  const carregarMensagens = async (conversaId: string) => {
    try {
      const { data, error } = await supabase
        .from("mensagens")
        .select("*")
        .eq("conversa_id", conversaId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMensagens(data || []);

      // Marcar mensagens como lidas
      if (user) {
        await supabase
          .from("mensagens")
          .update({ lida: true })
          .eq("conversa_id", conversaId)
          .neq("remetente_id", user.id)
          .eq("lida", false);
      }
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  };

  // Enviar mensagem
  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada || !user) return;

    try {
      setEnviando(true);

      const { error } = await supabase.from("mensagens").insert({
        conversa_id: conversaSelecionada.id,
        remetente_id: user.id,
        conteudo: novaMensagem.trim(),
      });

      if (error) throw error;

      // Atualizar última mensagem da conversa
      await supabase
        .from("conversas")
        .update({
          ultima_mensagem: novaMensagem.trim(),
          ultima_mensagem_em: new Date().toISOString(),
        })
        .eq("id", conversaSelecionada.id);

      setNovaMensagem("");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };

  // Realtime subscription
  useEffect(() => {
    if (!conversaSelecionada) return;

    const channel = supabase
      .channel("mensagens-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `conversa_id=eq.${conversaSelecionada.id}`,
        },
        (payload) => {
          setMensagens((prev) => [...prev, payload.new as Mensagem]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversaSelecionada]);

  useEffect(() => {
    carregarConversas();
  }, [user]);

  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.id);
    }
  }, [conversaSelecionada]);

  const conversasFiltradas = conversas.filter((c) =>
    c.aluno_nome?.toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Lista de Conversas */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Conversas
          </CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-340px)]">
            {conversasFiltradas.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhuma conversa encontrada
              </div>
            ) : (
              conversasFiltradas.map((conversa) => (
                <button
                  key={conversa.id}
                  onClick={() => setConversaSelecionada(conversa)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors border-b border-border ${
                    conversaSelecionada?.id === conversa.id ? "bg-muted" : ""
                  }`}
                >
                  <Avatar>
                    <AvatarFallback>
                      {conversa.aluno_nome?.charAt(0) || "A"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">
                        {conversa.aluno_nome}
                      </span>
                      {conversa.mensagens_nao_lidas! > 0 && (
                        <Badge variant="default" className="text-xs">
                          {conversa.mensagens_nao_lidas}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversa.ultima_mensagem || "Sem mensagens"}
                    </p>
                    {conversa.ultima_mensagem_em && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(
                          new Date(conversa.ultima_mensagem_em),
                          "dd/MM/yyyy HH:mm",
                          { locale: ptBR }
                        )}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Área de Chat */}
      <Card className="lg:col-span-2 flex flex-col">
        {conversaSelecionada ? (
          <>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {conversaSelecionada.aluno_nome?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">
                    {conversaSelecionada.aluno_nome}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {mensagens.length} mensagens
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {mensagens.map((mensagem) => {
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
                          <p
                            className={`text-xs mt-1 ${
                              isMe
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {format(
                              new Date(mensagem.created_at),
                              "HH:mm",
                              { locale: ptBR }
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && enviarMensagem()}
                    disabled={enviando}
                  />
                  <Button
                    onClick={enviarMensagem}
                    disabled={enviando || !novaMensagem.trim()}
                    size="icon"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MessageManager;
