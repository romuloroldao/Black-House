import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Send, MessageSquare, Search, Plus, UserPlus } from "lucide-react";
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

interface Aluno {
  id: string;
  nome: string;
  email: string;
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
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [isNovaConversaOpen, setIsNovaConversaOpen] = useState(false);
  const [buscaAluno, setBuscaAluno] = useState("");

  // Carregar alunos
  const carregarAlunos = async () => {
    if (!user) return;

    const result = await apiClient.requestSafe<any[]>('/api/alunos');
    const data = result.success && Array.isArray(result.data) ? result.data : [];
    const filtrados = data
      .filter((a: any) => a.coach_id === user.id)
      .sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
    setAlunos(filtrados);
    if (!result.success) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os alunos",
        variant: "destructive",
      });
    }
  };

  // Carregar conversas
  const carregarConversas = async () => {
    if (!user) return;

    const conversasResult = await apiClient.requestSafe<any[]>('/api/conversas');
    const mensagensResult = await apiClient.requestSafe<any[]>('/api/mensagens');
    const alunosResult = await apiClient.requestSafe<any[]>('/api/alunos');

    const conversasData = conversasResult.success && Array.isArray(conversasResult.data) ? conversasResult.data : [];
    const mensagensData = mensagensResult.success && Array.isArray(mensagensResult.data) ? mensagensResult.data : [];
    const alunosData = alunosResult.success && Array.isArray(alunosResult.data) ? alunosResult.data : [];
    const alunosMap = new Map(alunosData.map((a: any) => [a.id, a]));

    const filtradas = conversasData
      .filter((c: any) => c.coach_id === user.id)
      .sort((a: any, b: any) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());

    const conversasComNomes = filtradas.map((conversa: any) => {
      const alunoData = alunosMap.get(conversa.aluno_id);
      const mensagensNaoLidas = mensagensData.filter(
        (m: any) => m.conversa_id === conversa.id && m.lida === false && m.remetente_id !== user.id
      ).length;

      return {
        ...conversa,
        aluno_nome: alunoData?.nome || "Aluno",
        mensagens_nao_lidas: mensagensNaoLidas,
      };
    });

    setConversas(conversasComNomes);
    if (!conversasResult.success) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  // Carregar mensagens de uma conversa
  const carregarMensagens = async (conversaId: string) => {
    const result = await apiClient.requestSafe<any[]>('/api/mensagens');
    const data = result.success && Array.isArray(result.data) ? result.data : [];
    const ordenadas = data
      .filter((m: any) => m.conversa_id === conversaId)
      .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    setMensagens(ordenadas);

    if (user) {
      const mensagensNaoLidas = ordenadas.filter(
        (m: any) => m.remetente_id !== user.id && m.lida === false
      );
      for (const msg of mensagensNaoLidas) {
        await apiClient.requestSafe(`/api/mensagens/${msg.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ lida: true }),
        });
      }
    }
  };

  // Iniciar nova conversa
  const iniciarNovaConversa = async (alunoId: string) => {
    if (!user) return;

    const conversasResult = await apiClient.requestSafe<any[]>('/api/conversas');
    const conversasData = conversasResult.success && Array.isArray(conversasResult.data) ? conversasResult.data : [];
    const conversaExistente = conversasData.find(
      (c: any) => c.coach_id === user.id && c.aluno_id === alunoId
    );

    if (conversaExistente) {
      const conversa = conversas.find(c => c.id === conversaExistente.id);
      if (conversa) {
        setConversaSelecionada(conversa);
      }
    } else {
      const createResult = await apiClient.requestSafe<any>('/api/conversas', {
        method: 'POST',
        body: JSON.stringify({
          coach_id: user.id,
          aluno_id: alunoId,
        }),
      });
      const novaConversa = createResult.success ? createResult.data : null;
      if (!novaConversa) {
        toast({
          title: "Erro",
          description: "Não foi possível iniciar a conversa",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Conversa iniciada!",
        description: "Agora você pode enviar mensagens",
      });

      await carregarConversas();
      const aluno = alunos.find(a => a.id === alunoId);
      if (aluno) {
        setConversaSelecionada({
          ...novaConversa,
          aluno_nome: aluno.nome,
          mensagens_nao_lidas: 0,
        });
      }
    }

    setIsNovaConversaOpen(false);
    setBuscaAluno("");
  };

  // Enviar mensagem
  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada || !user) return;

    setEnviando(true);

    const sendResult = await apiClient.requestSafe('/api/mensagens', {
      method: 'POST',
      body: JSON.stringify({
        conversa_id: conversaSelecionada.id,
        remetente_id: user.id,
        conteudo: novaMensagem.trim(),
      }),
    });
    if (!sendResult.success) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
      setEnviando(false);
      return;
    }

    await apiClient.requestSafe(`/api/conversas/${conversaSelecionada.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ultima_mensagem: novaMensagem.trim(),
        ultima_mensagem_em: new Date().toISOString(),
      }),
    });

    setNovaMensagem("");
    await carregarConversas();
    setEnviando(false);
  };

  // Realtime subscription
  useEffect(() => {
    if (!conversaSelecionada) return;

    // Realtime removido - recarregar mensagens periodicamente ou após ações
    // Alternativa: usar polling ou WebSocket próprio no futuro
    const intervalId = setInterval(() => {
      if (conversaSelecionada) {
        carregarMensagens(conversaSelecionada.id);
      }
    }, 5000); // Recarregar a cada 5 segundos

    return () => {
      clearInterval(intervalId);
    };
  }, [conversaSelecionada]);

  useEffect(() => {
    carregarAlunos();
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

  const alunosFiltrados = alunos.filter((a) =>
    a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) &&
    !conversas.some(c => c.aluno_id === a.id)
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Conversas
            </CardTitle>
            <Dialog open={isNovaConversaOpen} onOpenChange={setIsNovaConversaOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Iniciar Nova Conversa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar aluno..."
                      value={buscaAluno}
                      onChange={(e) => setBuscaAluno(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <ScrollArea className="h-[300px]">
                    {alunosFiltrados.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        {buscaAluno ? "Nenhum aluno encontrado" : "Todos os alunos já têm conversas"}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {alunosFiltrados.map((aluno) => (
                          <button
                            key={aluno.id}
                            onClick={() => iniciarNovaConversa(aluno.id)}
                            className="w-full p-3 flex items-center gap-3 hover:bg-muted rounded-lg transition-colors"
                          >
                            <Avatar>
                              <AvatarFallback>
                                {aluno.nome.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                              <p className="font-medium">{aluno.nome}</p>
                              <p className="text-sm text-muted-foreground">
                                {aluno.email}
                              </p>
                            </div>
                            <UserPlus className="w-4 h-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
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
