import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Calendar } from "./ui/calendar";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus, Trash2, Users, Clock } from "lucide-react";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";

interface Turma {
  id: string;
  nome: string;
  cor: string;
}

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  data_inicio: string;
  hora_inicio: string;
  duracao_minutos: number;
  recorrencia: string;
  status: string;
  link_online: string | null;
  turma_id: string | null;
  turmas?: { nome: string };
  eventos_participantes?: { aluno_id: string; alunos: Aluno }[];
}

export function EventsCalendar() {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    data_inicio: "",
    hora_inicio: "",
    duracao_minutos: 60,
    recorrencia: "unica",
    link_online: "",
    turma_id: "",
  });
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);

  useEffect(() => {
    loadEventos();
    loadTurmas();
    loadAlunos();
  }, [user]);

  const loadEventos = async () => {
    if (!user) return;

    try {
      const [eventosRes, turmasRes, participantesRes, alunosRes] = await Promise.all([
        apiClient.requestSafe<any[]>('/api/eventos'),
        apiClient.requestSafe<any[]>('/api/turmas'),
        apiClient.requestSafe<any[]>('/api/eventos-participantes'),
        apiClient.requestSafe<any[]>('/api/alunos'),
      ]);

      const eventosData = eventosRes.success && Array.isArray(eventosRes.data) ? eventosRes.data : [];
      const turmasData = turmasRes.success && Array.isArray(turmasRes.data) ? turmasRes.data : [];
      const participantesData = participantesRes.success && Array.isArray(participantesRes.data) ? participantesRes.data : [];
      const alunosData = alunosRes.success && Array.isArray(alunosRes.data) ? alunosRes.data : [];

      const turmasMap = new Map(turmasData.map((t: any) => [t.id, t]));
      const alunosMap = new Map(alunosData.map((a: any) => [a.id, a]));
      const participantesByEvento = participantesData.reduce((acc: Record<string, any[]>, p: any) => {
        if (!acc[p.evento_id]) acc[p.evento_id] = [];
        acc[p.evento_id].push(p);
        return acc;
      }, {});

      const eventosComRelacoes = eventosData
        .filter((e: any) => e.coach_id === user.id)
        .sort((a: any, b: any) => new Date(a.data_inicio || 0).getTime() - new Date(b.data_inicio || 0).getTime())
        .map((evento: any) => {
          const turma = evento.turma_id ? turmasMap.get(evento.turma_id) : null;
          const participantes = participantesByEvento[evento.id] || [];
          const participantesComAlunos = participantes.map((p: any) => ({
            ...p,
            alunos: alunosMap.get(p.aluno_id) || null
          }));
          return {
            ...evento,
            turmas: turma ? { nome: turma.nome } : null,
            eventos_participantes: participantesComAlunos
          };
        });

      setEventos(eventosComRelacoes);
    } catch (error) {
      console.error("Erro ao carregar eventos:", error);
      toast.error("Erro ao carregar eventos");
    }
  };

  const loadTurmas = async () => {
    if (!user) return;

    try {
      const result = await apiClient.requestSafe<any[]>('/api/turmas');
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      setTurmas(data.filter((t: any) => t.coach_id === user.id && t.ativo === true));
    } catch (error) {
      console.error("Erro ao carregar turmas:", error);
    }
  };

  const loadAlunos = async () => {
    if (!user) return;

    try {
      const result = await apiClient.requestSafe<any[]>('/api/alunos');
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      const filtrados = data
        .filter((a: any) => a.coach_id === user.id)
        .sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
      setAlunos(filtrados);
    } catch (error) {
      console.error("Erro ao carregar alunos:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.turma_id && selectedAlunos.length === 0) {
      toast.error("Selecione uma turma ou alunos específicos");
      return;
    }

    setLoading(true);

    const eventoResult = await apiClient.requestSafe<any>('/api/eventos', {
      method: 'POST',
      body: JSON.stringify({
        coach_id: user.id,
        titulo: formData.titulo,
        descricao: formData.descricao,
        data_inicio: formData.data_inicio,
        hora_inicio: formData.hora_inicio,
        duracao_minutos: formData.duracao_minutos,
        recorrencia: formData.recorrencia,
        link_online: formData.link_online || null,
        turma_id: formData.turma_id || null,
      }),
    });

    const eventoData = eventoResult.success ? eventoResult.data : null;
    if (!eventoData) {
      toast.error("Erro ao criar evento");
      setLoading(false);
      return;
    }

    // Adicionar participantes
    let participantesIds: string[] = [];
    
    if (formData.turma_id) {
      const membrosRes = await apiClient.requestSafe<any[]>(`/api/turmas-alunos?turma_id=${formData.turma_id}`);
      const membros = membrosRes.success && Array.isArray(membrosRes.data) ? membrosRes.data : [];
      participantesIds = membros.map(m => m.aluno_id);
    } else {
      participantesIds = selectedAlunos;
    }

    if (participantesIds.length > 0) {
      const participantes = participantesIds.map(alunoId => ({
        evento_id: eventoData.id,
        aluno_id: alunoId,
      }));

      // DESIGN-SUPABASE-PURGE-GLOBAL-003: Usar rota semântica ao invés de from()
      await apiClient.requestSafe('/api/eventos-participantes', {
        method: 'POST',
        body: JSON.stringify(participantes),
      });

      // Criar notificações para os participantes
      for (const alunoId of participantesIds) {
        // DESIGN-SUPABASE-PURGE-GLOBAL-003: Usar rota semântica ao invés de from()
        await apiClient.requestSafe('/api/notificacoes', {
          method: 'POST',
          body: JSON.stringify({
            coach_id: user.id,
            aluno_id: alunoId,
            tipo: "novo_evento",
            titulo: `Novo evento: ${formData.titulo}`,
            mensagem: `Você foi convidado para o evento "${formData.titulo}" no dia ${new Date(formData.data_inicio).toLocaleDateString("pt-BR")}`,
            link: "/student-portal?tab=calendar",
          }),
        });
      }
    }

    toast.success("Evento criado com sucesso!");
    setLoading(false);
    setIsDialogOpen(false);
    resetForm();
    loadEventos();
  };

  const handleCancelEvento = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este evento?")) return;

    try {
      await apiClient.requestSafe(`/api/eventos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: "cancelado" }),
      });
    } catch (error) {
      toast.error("Erro ao cancelar evento");
      return;
    }

    // Notificar participantes
    const evento = eventos.find(e => e.id === id);
    if (evento?.eventos_participantes) {
      for (const p of evento.eventos_participantes) {
        // DESIGN-SUPABASE-PURGE-GLOBAL-003: Usar rota semântica ao invés de from()
        await apiClient.request('/api/notificacoes', {
          method: 'POST',
          body: JSON.stringify({
            coach_id: user!.id,
            aluno_id: p.aluno_id,
            tipo: "evento_cancelado",
            titulo: `Evento cancelado: ${evento.titulo}`,
            mensagem: `O evento "${evento.titulo}" foi cancelado`,
          }),
        });
      }
    }

    toast.success("Evento cancelado e participantes notificados!");
    loadEventos();
  };

  const resetForm = () => {
    setFormData({
      titulo: "",
      descricao: "",
      data_inicio: "",
      hora_inicio: "",
      duracao_minutos: 60,
      recorrencia: "unica",
      link_online: "",
      turma_id: "",
    });
    setSelectedAlunos([]);
  };

  const eventosDoMes = eventos.filter(e => {
    if (!selectedDate) return true;
    const eventoDate = new Date(e.data_inicio);
    return (
      eventoDate.getMonth() === selectedDate.getMonth() &&
      eventoDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Calendário de Eventos</h2>
          <p className="text-muted-foreground">
            Gerencie eventos e lembretes automáticos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Evento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Nome do evento"
                  required
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva o evento..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="data_inicio">Data</Label>
                  <Input
                    id="data_inicio"
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="hora_inicio">Horário</Label>
                  <Input
                    id="hora_inicio"
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duracao_minutos">Duração (minutos)</Label>
                  <Input
                    id="duracao_minutos"
                    type="number"
                    value={formData.duracao_minutos}
                    onChange={(e) => setFormData({ ...formData, duracao_minutos: parseInt(e.target.value) })}
                    min="15"
                    step="15"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="recorrencia">Recorrência</Label>
                  <Select value={formData.recorrencia} onValueChange={(v) => setFormData({ ...formData, recorrencia: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unica">Única</SelectItem>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="link_online">Link Online (opcional)</Label>
                <Input
                  id="link_online"
                  value={formData.link_online}
                  onChange={(e) => setFormData({ ...formData, link_online: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label htmlFor="turma_id">Turma (opcional)</Label>
                <Select value={formData.turma_id} onValueChange={(v) => setFormData({ ...formData, turma_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma turma ou alunos específicos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma (alunos específicos)</SelectItem>
                    {turmas.map((turma) => (
                      <SelectItem key={turma.id} value={turma.id}>
                        {turma.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!formData.turma_id && (
                <div>
                  <Label>Selecionar Alunos</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                    {alunos.map((aluno) => (
                      <div key={aluno.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`aluno-${aluno.id}`}
                          checked={selectedAlunos.includes(aluno.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAlunos([...selectedAlunos, aluno.id]);
                            } else {
                              setSelectedAlunos(selectedAlunos.filter(id => id !== aluno.id));
                            }
                          }}
                        />
                        <label htmlFor={`aluno-${aluno.id}`} className="cursor-pointer">
                          {aluno.nome}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Criando..." : "Criar Evento"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Calendário</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Eventos</CardTitle>
            <CardDescription>
              {eventosDoMes.length} evento(s) este mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            {eventosDoMes.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nenhum evento agendado para este mês
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {eventosDoMes.map((evento) => (
                  <div key={evento.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{evento.titulo}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(evento.data_inicio)} às {evento.hora_inicio}
                        </p>
                      </div>
                      <Badge variant={evento.status === "cancelado" ? "destructive" : "default"}>
                        {evento.status}
                      </Badge>
                    </div>
                    {evento.descricao && (
                      <p className="text-sm mb-2">{evento.descricao}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {evento.duracao_minutos} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {evento.eventos_participantes?.length || 0} participantes
                      </span>
                    </div>
                    {evento.turmas && (
                      <Badge variant="secondary" className="mt-2">
                        {evento.turmas.nome}
                      </Badge>
                    )}
                    {evento.status !== "cancelado" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleCancelEvento(evento.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Cancelar Evento
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}