import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  hora_evento: string | null;
  tipo: string;
  status: string;
  prioridade: string;
  aluno_id: string | null;
  aluno_nome?: string;
}

const AgendaManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    data_evento: format(new Date(), "yyyy-MM-dd"),
    hora_evento: "",
    tipo: "retorno",
    status: "pendente",
    prioridade: "normal",
    aluno_id: "",
  });

  useEffect(() => {
    if (user) {
      carregarDados();
    }
  }, [user]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar alunos
      const alunosRes = await apiClient.requestSafe<any[]>('/api/alunos');
      const alunosData = alunosRes.success && Array.isArray(alunosRes.data) ? alunosRes.data : [];
      const alunosFiltrados = alunosData
        .filter((a: any) => a.coach_id === user?.id)
        .sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
      setAlunos(alunosFiltrados);

      // Carregar eventos
      await carregarEventos();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarEventos = async () => {
    try {
      if (!user?.id) {
        console.warn("Usuário não autenticado, não é possível carregar eventos");
        return;
      }

      const eventosRes = await apiClient.requestSafe<any[]>('/api/agenda-eventos');
      const data = eventosRes.success && Array.isArray(eventosRes.data) ? eventosRes.data : [];
      const eventosCoach = data.filter((e: any) => e.coach_id === user.id);

      console.log("Eventos carregados:", data);

      // Buscar nomes dos alunos
      const alunosRes = await apiClient.requestSafe<any[]>('/api/alunos');
      const alunosData = alunosRes.success && Array.isArray(alunosRes.data) ? alunosRes.data : [];
      const alunosMap = new Map(alunosData.map((a: any) => [a.id, a]));
      const eventosComNomes = eventosCoach.map((evento: any) => {
        if (evento.aluno_id) {
          const alunoData = alunosMap.get(evento.aluno_id);
          return {
            ...evento,
            aluno_nome: alunoData?.nome || "Aluno",
          };
        }
        return evento;
      });

      // Ordenar eventos por data e hora
      eventosComNomes.sort((a, b) => {
        const dataA = new Date(`${a.data_evento} ${a.hora_evento || '00:00'}`);
        const dataB = new Date(`${b.data_evento} ${b.hora_evento || '00:00'}`);
        return dataA.getTime() - dataB.getTime();
      });

      setEventos(eventosComNomes);
      console.log("Eventos processados:", eventosComNomes.length);
      console.log("Eventos com datas:", eventosComNomes.map(e => ({ 
        id: e.id, 
        titulo: e.titulo, 
        data_evento: e.data_evento,
        data_normalizada: e.data_evento ? e.data_evento.split('T')[0] : null
      })));
    } catch (error) {
      console.error("Erro ao carregar eventos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os eventos",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo || !formData.data_evento || !formData.tipo) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return;
    }

    try {
      const eventoData = {
        ...formData,
        coach_id: user.id,
        aluno_id: formData.aluno_id || null,
        hora_evento: formData.hora_evento || null,
        descricao: formData.descricao || null,
      };

      if (eventoSelecionado) {
        // Atualizar - remover id do objeto de atualização
        const { id, ...updateData } = eventoData;
        const updateResult = await apiClient.requestSafe(`/api/agenda-eventos/${eventoSelecionado.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        });
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Erro ao atualizar evento');
        }

        toast({
          title: "Evento atualizado!",
          description: "As alterações foram salvas com sucesso.",
        });
      } else {
        // Criar
        const result = await apiClient.requestSafe('/api/agenda-eventos', {
          method: 'POST',
          body: JSON.stringify(eventoData),
        });
        if (!result.success) {
          throw new Error(result.error || 'Erro ao criar evento');
        }

        console.log("Evento criado:", result);

        toast({
          title: "Evento criado!",
          description: "O evento foi adicionado à agenda.",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      
      // Aguardar um pouco antes de recarregar para garantir que o banco foi atualizado
      setTimeout(() => {
        carregarEventos();
      }, 300);
    } catch (error) {
      console.error("Erro ao salvar evento:", error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível salvar o evento";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (eventoId: string) => {
    if (!confirm("Tem certeza que deseja deletar este evento?")) return;

    try {
      const deleteResult = await apiClient.requestSafe(`/api/agenda-eventos/${eventoId}`, { method: 'DELETE' });
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Erro ao deletar evento');
      }

      toast({
        title: "Evento deletado!",
        description: "O evento foi removido da agenda.",
      });

      carregarEventos();
    } catch (error) {
      console.error("Erro ao deletar evento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível deletar o evento",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (evento: Evento) => {
    setEventoSelecionado(evento);
    setFormData({
      titulo: evento.titulo,
      descricao: evento.descricao || "",
      data_evento: evento.data_evento,
      hora_evento: evento.hora_evento || "",
      tipo: evento.tipo,
      status: evento.status,
      prioridade: evento.prioridade,
      aluno_id: evento.aluno_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleNovoEvento = () => {
    setEventoSelecionado(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      titulo: "",
      descricao: "",
      data_evento: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      hora_evento: "",
      tipo: "retorno",
      status: "pendente",
      prioridade: "normal",
      aluno_id: "",
    });
  };

  const toggleStatus = async (evento: Evento) => {
    const novoStatus = evento.status === "pendente" ? "concluido" : "pendente";
    
    try {
      const updateResult = await apiClient.requestSafe(`/api/agenda-eventos/${evento.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Erro ao atualizar status');
      }

      toast({
        title: novoStatus === "concluido" ? "Evento concluído!" : "Evento reaberto",
      });

      carregarEventos();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const tiposEvento = [
    { value: "retorno", label: "Retorno", color: "bg-primary" },
    { value: "ajuste_dieta", label: "Ajuste de Dieta", color: "bg-primary" },
    { value: "alteracao_treino", label: "Alteração de Treino", color: "bg-warning" },
    { value: "avaliacao", label: "Avaliação", color: "bg-accent" },
    { value: "outro", label: "Outro", color: "bg-muted" },
  ];

  const prioridades = [
    { value: "baixa", label: "Baixa", color: "text-muted-foreground" },
    { value: "normal", label: "Normal", color: "text-primary" },
    { value: "alta", label: "Alta", color: "text-destructive" },
  ];

  const eventosFiltrados = eventos.filter((evento) => {
    const matchTipo = filtroTipo === "todos" || evento.tipo === filtroTipo;
    const matchStatus = filtroStatus === "todos" || evento.status === filtroStatus;
    
    // Comparar datas normalizando o formato (pode vir com hora/timezone do banco)
    let matchData = true;
    if (date) {
      const dataSelecionada = format(date, "yyyy-MM-dd");
      // Normalizar data_evento (pode vir como "2026-01-13" ou "2026-01-13T00:00:00.000Z")
      const dataEvento = evento.data_evento ? evento.data_evento.split('T')[0] : null;
      matchData = dataEvento === dataSelecionada;
    }
    
    return matchTipo && matchStatus && matchData;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "concluido": return <CheckCircle2 className="w-4 h-4 text-primary" />;
      case "cancelado": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <AlertCircle className="w-4 h-4 text-warning" />;
    }
  };

  const getTipoColor = (tipo: string) => {
    return tiposEvento.find(t => t.value === tipo)?.color || "bg-muted";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Agenda
          </h1>
          <p className="text-muted-foreground">
            Gerencie retornos, ajustes e compromissos com seus alunos
          </p>
        </div>
        <Button onClick={handleNovoEvento} className="shadow-glow">
          <Plus className="w-4 h-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Calendário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className={cn("rounded-md border pointer-events-auto")}
              locale={ptBR}
            />

            {/* Filtros */}
            <div className="space-y-3 mt-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Tipo de Evento</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Tipos</SelectItem>
                    {tiposEvento.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="concluido">Concluídos</SelectItem>
                    <SelectItem value="cancelado">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Eventos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Eventos {date && `- ${format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
              </CardTitle>
              <Badge variant="secondary">
                {eventosFiltrados.length} {eventosFiltrados.length === 1 ? 'evento' : 'eventos'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {eventosFiltrados.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground">Nenhum evento para esta data</p>
                  <Button onClick={handleNovoEvento} variant="outline" className="mt-4">
                    Criar Primeiro Evento
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {eventosFiltrados.map((evento) => (
                    <Card key={evento.id} className="overflow-hidden">
                      <div className={`h-1 ${getTipoColor(evento.tipo)}`} />
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(evento.status)}
                              <h3 className="font-semibold">{evento.titulo}</h3>
                            </div>

                            {evento.descricao && (
                              <p className="text-sm text-muted-foreground">{evento.descricao}</p>
                            )}

                            <div className="flex flex-wrap gap-2 text-sm">
                              {evento.hora_evento && (
                                <Badge variant="outline" className="gap-1">
                                  <Clock className="w-3 h-3" />
                                  {evento.hora_evento}
                                </Badge>
                              )}

                              {evento.aluno_nome && (
                                <Badge variant="outline" className="gap-1">
                                  <User className="w-3 h-3" />
                                  {evento.aluno_nome}
                                </Badge>
                              )}

                              <Badge variant="outline">
                                {tiposEvento.find(t => t.value === evento.tipo)?.label}
                              </Badge>

                              <Badge 
                                variant="outline"
                                className={prioridades.find(p => p.value === evento.prioridade)?.color}
                              >
                                {prioridades.find(p => p.value === evento.prioridade)?.label}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleStatus(evento)}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(evento)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(evento.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para Criar/Editar Evento */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {eventoSelecionado ? "Editar Evento" : "Novo Evento"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex: Retorno - João Silva"
                  required
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Detalhes do evento..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposEvento.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aluno_id">Aluno</Label>
                <Select value={formData.aluno_id || "none"} onValueChange={(value) => setFormData({ ...formData, aluno_id: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um aluno (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum aluno</SelectItem>
                    {alunos.map(aluno => (
                      <SelectItem key={aluno.id} value={aluno.id}>
                        {aluno.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_evento">Data *</Label>
                <Input
                  id="data_evento"
                  type="date"
                  value={formData.data_evento}
                  onChange={(e) => setFormData({ ...formData, data_evento: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora_evento">Horário</Label>
                <Input
                  id="hora_evento"
                  type="time"
                  value={formData.hora_evento}
                  onChange={(e) => setFormData({ ...formData, hora_evento: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select value={formData.prioridade} onValueChange={(value) => setFormData({ ...formData, prioridade: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {prioridades.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {eventoSelecionado ? "Atualizar" : "Criar"} Evento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgendaManager;