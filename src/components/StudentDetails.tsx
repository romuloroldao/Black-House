import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Loader2, Save, Plus, Dumbbell, MessageSquare, Trash2, User, Utensils, TrendingUp, Activity, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StudentProgressDashboard from "./student/StudentProgressDashboard";
import StudentFinancialManagement from "./student/StudentFinancialManagement";

interface Student {
  id: string;
  nome: string;
  email: string;
  data_nascimento: string | null;
  peso: number | null;
  objetivo: string | null;
  created_at: string;
}

interface Feedback {
  id: string;
  feedback: string;
  updated_at: string;
}

interface Treino {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  dificuldade: string;
  duracao: number;
  alunoTreinoId?: string;
  dataExpiracao?: string | null;
  diasAntecedenciaNotificacao?: number | null;
}

interface Dieta {
  id: string;
  nome: string;
  objetivo: string | null;
  data_criacao: string;
}

interface Foto {
  id: string;
  url: string;
  descricao: string | null;
  created_at: string;
}

export default function StudentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [treinos, setTreinos] = useState<Array<Treino & { alunoTreinoId: string }>>([]);
  const [dieta, setDieta] = useState<Dieta | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [selectedFoto, setSelectedFoto] = useState<string | null>(null);
  
  // Estados para atribuir treino
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<Treino[]>([]);
  const [isAtribuirTreinoOpen, setIsAtribuirTreinoOpen] = useState(false);
  const [treinoSelecionado, setTreinoSelecionado] = useState<string>("");
  const [diasValidade, setDiasValidade] = useState<string>("45");
  const [diasAntecedenciaNotif, setDiasAntecedenciaNotif] = useState<string>("7");
  
  // Estados para criar dieta
  const [isCriarDietaOpen, setIsCriarDietaOpen] = useState(false);
  const [novaDieta, setNovaDieta] = useState({
    nome: "",
    objetivo: "",
  });

  useEffect(() => {
    if (id) {
      carregarDadosAluno();
      carregarTreinosDisponiveis();
    }
  }, [id]);

  const carregarDadosAluno = async () => {
    try {
      setLoading(true);

      // Carregar dados do aluno
      const alunoData = await apiClient
        .from("alunos")
        .select("*")
        .eq("id", id);

      const aluno = Array.isArray(alunoData) && alunoData.length > 0 ? alunoData[0] : null;
      if (aluno) {
        setStudent(aluno);
      }

      // Carregar feedback
      const feedbackData = await apiClient
        .from("feedbacks_alunos")
        .select("*")
        .eq("aluno_id", id)
        .order("updated_at", { ascending: false })
        .limit(1);

      const feedback = Array.isArray(feedbackData) && feedbackData.length > 0 ? feedbackData[0] : null;
      if (feedback) {
        setFeedback(feedback.feedback);
        setFeedbackId(feedback.id);
      }

      // Carregar todos os treinos ativos - buscar alunos_treinos e depois treinos
      const alunosTreinosData = await apiClient
        .from("alunos_treinos")
        .select("*")
        .eq("aluno_id", id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      const alunosTreinos = Array.isArray(alunosTreinosData) ? alunosTreinosData : [];
      
      // Buscar dados dos treinos para cada aluno_treino
      const treinosFormatados = await Promise.all(
        alunosTreinos.map(async (item: any) => {
          const treinoData = await apiClient
            .from("treinos")
            .select("*")
            .eq("id", item.treino_id);
          
          const treino = Array.isArray(treinoData) && treinoData.length > 0 ? treinoData[0] : null;
          if (treino) {
            return {
              ...treino,
              alunoTreinoId: item.id,
              dataExpiracao: item.data_expiracao,
              diasAntecedenciaNotificacao: item.dias_antecedencia_notificacao
            };
          }
          return null;
        })
      );

      setTreinos(treinosFormatados.filter((t): t is Treino & { alunoTreinoId: string } => t !== null));

      // Carregar dieta atual
      const dietaData = await apiClient
        .from("dietas")
        .select("*")
        .eq("aluno_id", id)
        .order("data_criacao", { ascending: false })
        .limit(1);

      const dieta = Array.isArray(dietaData) && dietaData.length > 0 ? dietaData[0] : null;
      if (dieta) {
        setDieta(dieta);
      }

      // Carregar fotos
      const fotosData = await apiClient
        .from("fotos_alunos")
        .select("*")
        .eq("aluno_id", id)
        .order("created_at", { ascending: false });

      const fotos = Array.isArray(fotosData) ? fotosData : [];
      setFotos(fotos);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFeedback = async () => {
    if (!feedback.trim()) {
      toast({
        title: "Atenção",
        description: "Digite um feedback antes de salvar",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Usar um coach_id temporário (pode ser substituído quando autenticação for implementada)
      const coachId = "00000000-0000-0000-0000-000000000000";

      if (feedbackId) {
        // Atualizar feedback existente
        await apiClient
          .from("feedbacks_alunos")
          .update({ feedback, id: feedbackId });
      } else {
        // Criar novo feedback
        const data = await apiClient
          .from("feedbacks_alunos")
          .insert({
            aluno_id: id,
            coach_id: coachId,
            feedback,
          });

        const feedbackRecord = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (feedbackRecord) setFeedbackId(feedbackRecord.id);
      }

      toast({
        title: "Sucesso!",
        description: "Feedback salvo com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar feedback",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const carregarTreinosDisponiveis = async () => {
    try {
      const data = await apiClient
        .from("treinos")
        .select("*")
        .order("created_at", { ascending: false });

      setTreinosDisponiveis(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Erro ao carregar treinos:", error);
    }
  };

  const handleAtribuirTreino = async () => {
    if (!treinoSelecionado) {
      toast({
        title: "Atenção",
        description: "Selecione um treino antes de atribuir",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Calcular data de expiração
      let dataExpiracao = null;
      if (diasValidade && parseInt(diasValidade) > 0) {
        dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + parseInt(diasValidade));
      }

      // Atribuir novo treino com validade
      await apiClient
        .from("alunos_treinos")
        .insert({
          aluno_id: id,
          treino_id: treinoSelecionado,
          ativo: true,
          data_expiracao: dataExpiracao?.toISOString().split('T')[0],
          dias_antecedencia_notificacao: diasAntecedenciaNotif ? parseInt(diasAntecedenciaNotif) : 7,
          notificacao_expiracao_enviada: false,
        });

      toast({
        title: "Sucesso!",
        description: "Treino atribuído com sucesso",
      });

      setIsAtribuirTreinoOpen(false);
      setTreinoSelecionado("");
      setDiasValidade("45");
      setDiasAntecedenciaNotif("7");
      carregarDadosAluno();
    } catch (error: any) {
      toast({
        title: "Erro ao atribuir treino",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverTreino = async (alunoTreinoId: string, treinoNome: string) => {
    if (!confirm(`Tem certeza que deseja remover o treino "${treinoNome}"?`)) {
      return;
    }

    try {
      setSaving(true);

      await apiClient
        .from("alunos_treinos")
        .delete(alunoTreinoId);

      toast({
        title: "Sucesso!",
        description: "Treino removido com sucesso",
      });

      carregarDadosAluno();
    } catch (error: any) {
      toast({
        title: "Erro ao remover treino",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCriarDieta = async () => {
    if (!novaDieta.nome) {
      toast({
        title: "Atenção",
        description: "Digite um nome para a dieta",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const data = await apiClient
        .from("dietas")
        .insert({
          nome: novaDieta.nome,
          objetivo: novaDieta.objetivo || null,
          aluno_id: id,
        });

      const dieta = Array.isArray(data) && data.length > 0 ? data[0] : null;

      toast({
        title: "Sucesso!",
        description: "Dieta criada com sucesso",
      });

      setIsCriarDietaOpen(false);
      setNovaDieta({ nome: "", objetivo: "" });
      carregarDadosAluno();
      
      // Redirecionar para a página de edição da dieta
      if (dieta) {
        navigate(`/dieta/${dieta.id}`);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar dieta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleIniciarConversa = async () => {
    if (!id) return;

    try {
      setSaving(true);

      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar autenticado",
          variant: "destructive",
        });
        return;
      }

      // Verificar se já existe uma conversa
      const conversaExistenteData = await apiClient
        .from("conversas")
        .select("*")
        .eq("coach_id", user.id)
        .eq("aluno_id", id);

      const conversaExistente = Array.isArray(conversaExistenteData) && conversaExistenteData.length > 0 ? conversaExistenteData[0] : null;

      if (!conversaExistente) {
        // Criar nova conversa
        await apiClient
          .from("conversas")
          .insert({
            coach_id: user.id,
            aluno_id: id,
          });
      }

      // Redirecionar para mensagens
      navigate("/?tab=messages");
      
      toast({
        title: "Sucesso!",
        description: "Redirecionando para mensagens...",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar conversa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Aluno não encontrado</h2>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para lista de alunos
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{student.nome}</h1>
            <p className="text-muted-foreground">{student.email}</p>
          </div>
          <Button onClick={handleIniciarConversa} disabled={saving}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Enviar Mensagem
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="training" className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Treinos
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            Nutrição
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Progresso
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
        </TabsList>

        {/* TAB: Visão Geral */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Dados Básicos */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="font-semibold">Data de Nascimento: </span>
                  <span>{student.data_nascimento ? new Date(student.data_nascimento).toLocaleDateString('pt-BR') : "Não informado"}</span>
                </div>
                <div>
                  <span className="font-semibold">Peso: </span>
                  <span>{student.peso ? `${student.peso} kg` : "Não informado"}</span>
                </div>
                <div>
                  <span className="font-semibold">Objetivo: </span>
                  <span>{student.objetivo || "Não informado"}</span>
                </div>
                <div>
                  <span className="font-semibold">Aluno desde: </span>
                  <span>{new Date(student.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Feedback */}
            <Card>
              <CardHeader>
                <CardTitle>Feedback do Professor</CardTitle>
                <CardDescription>Adicione observações e feedbacks personalizados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Digite seu feedback aqui..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <Button onClick={handleSaveFeedback} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Feedback
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Resumo Rápido */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Treinos Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{treinos.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {treinos.length === 1 ? 'treino atribuído' : 'treinos atribuídos'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Plano Nutricional</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dieta ? '1' : '0'}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dieta ? 'dieta ativa' : 'nenhuma dieta'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Fotos de Progresso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fotos.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {fotos.length === 1 ? 'foto enviada' : 'fotos enviadas'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: Treinos */}
        <TabsContent value="training" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Treinos Ativos</CardTitle>
              <Dialog open={isAtribuirTreinoOpen} onOpenChange={setIsAtribuirTreinoOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Treino
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Atribuir Treino</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Selecione um treino</Label>
                      <Select value={treinoSelecionado} onValueChange={setTreinoSelecionado}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um treino..." />
                        </SelectTrigger>
                        <SelectContent>
                          {treinosDisponiveis.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nome} - {t.categoria} ({t.dificuldade})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dias-validade">Validade (dias)</Label>
                      <Input
                        id="dias-validade"
                        type="number"
                        placeholder="Ex: 45"
                        value={diasValidade}
                        onChange={(e) => setDiasValidade(e.target.value)}
                        min="1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para treino sem data de expiração
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dias-antecedencia">Notificar com antecedência (dias)</Label>
                      <Input
                        id="dias-antecedencia"
                        type="number"
                        placeholder="Ex: 7"
                        value={diasAntecedenciaNotif}
                        onChange={(e) => setDiasAntecedenciaNotif(e.target.value)}
                        min="1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Você e o aluno receberão notificação neste prazo antes da expiração
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setIsAtribuirTreinoOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleAtribuirTreino} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Atribuindo...
                          </>
                        ) : (
                          "Atribuir"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {treinos.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {treinos.map((treino) => {
                  const hoje = new Date();
                  const dataExpiracao = treino.dataExpiracao ? new Date(treino.dataExpiracao) : null;
                  const diasRestantes = dataExpiracao 
                    ? Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  
                  return (
                    <div key={treino.id} className="p-4 border border-border rounded-lg space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg">{treino.nome}</h3>
                        <p className="text-sm text-muted-foreground">{treino.descricao}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">{treino.categoria}</Badge>
                        <Badge variant="outline">{treino.dificuldade}</Badge>
                        <Badge variant="outline">{treino.duracao} min</Badge>
                        {diasRestantes !== null && (
                          <Badge 
                            variant={diasRestantes <= 7 ? "destructive" : "secondary"}
                            className={diasRestantes <= 7 ? "bg-destructive/10 text-destructive border-destructive/20" : ""}
                          >
                            {diasRestantes > 0 
                              ? `Expira em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`
                              : 'Expirado'
                            }
                          </Badge>
                        )}
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleRemoverTreino(treino.alunoTreinoId, treino.nome)}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Removendo...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover Treino
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhum treino atribuído</p>
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        {/* TAB: Nutrição */}
        <TabsContent value="nutrition" className="space-y-6 mt-6">
        {/* Dieta Atual */}
        <Card>
          <CardHeader>
            <CardTitle>Dieta Atual</CardTitle>
          </CardHeader>
          <CardContent>
            {dieta ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{dieta.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    Objetivo: {dieta.objetivo || "Não especificado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Criada em: {new Date(dieta.data_criacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" variant="outline" onClick={() => navigate(`/dieta/${dieta.id}`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar Dieta
                  </Button>
                  <Dialog open={isCriarDietaOpen} onOpenChange={setIsCriarDietaOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex-1" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Dieta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Nova Dieta</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Nome da Dieta *</Label>
                          <Input
                            placeholder="Ex: Dieta para Emagrecimento"
                            value={novaDieta.nome}
                            onChange={(e) => setNovaDieta({ ...novaDieta, nome: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Objetivo</Label>
                          <Select
                            value={novaDieta.objetivo}
                            onValueChange={(value) => setNovaDieta({ ...novaDieta, objetivo: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o objetivo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Emagrecimento">Emagrecimento</SelectItem>
                              <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                              <SelectItem value="Manutenção">Manutenção</SelectItem>
                              <SelectItem value="Ganho de massa">Ganho de massa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setIsCriarDietaOpen(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleCriarDieta} disabled={saving}>
                            {saving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Criando...
                              </>
                            ) : (
                              "Criar Dieta"
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Nenhuma dieta atribuída</p>
                <Dialog open={isCriarDietaOpen} onOpenChange={setIsCriarDietaOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Dieta
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Nova Dieta</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Nome da Dieta *</Label>
                        <Input
                          placeholder="Ex: Dieta para Emagrecimento"
                          value={novaDieta.nome}
                          onChange={(e) => setNovaDieta({ ...novaDieta, nome: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Objetivo</Label>
                        <Select
                          value={novaDieta.objetivo}
                          onValueChange={(value) => setNovaDieta({ ...novaDieta, objetivo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o objetivo..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Emagrecimento">Emagrecimento</SelectItem>
                            <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                            <SelectItem value="Manutenção">Manutenção</SelectItem>
                            <SelectItem value="Ganho de massa">Ganho de massa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setIsCriarDietaOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCriarDieta} disabled={saving}>
                          {saving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Criando...
                            </>
                          ) : (
                            "Criar Dieta"
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        {/* TAB: Progresso */}
        <TabsContent value="progress" className="space-y-6 mt-6">
          {/* Fotos do Aluno */}
          <Card>
            <CardHeader>
              <CardTitle>Galeria de Fotos</CardTitle>
              <CardDescription>Progresso visual do aluno</CardDescription>
            </CardHeader>
            <CardContent>
              {fotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {fotos.map((foto) => (
                    <div
                      key={foto.id}
                      className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedFoto(foto.url)}
                    >
                      <img
                        src={foto.url}
                        alt={foto.descricao || "Foto do aluno"}
                        className="w-full h-full object-cover"
                      />
                      {foto.descricao && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                          {foto.descricao}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma foto disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dashboard de Progresso do Aluno */}
          <Card>
            <CardHeader>
              <CardTitle>Dashboard de Progresso</CardTitle>
              <CardDescription>
                Análise detalhada do progresso através dos check-ins semanais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudentProgressDashboard studentId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Financeiro */}
        <TabsContent value="financial" className="mt-6">
          <StudentFinancialManagement 
            studentId={id!} 
            studentName={student?.nome || "Aluno"} 
          />
        </TabsContent>
      </Tabs>

      {/* Dialog para ampliar foto */}
      <Dialog open={!!selectedFoto} onOpenChange={() => setSelectedFoto(null)}>
        <DialogContent className="max-w-4xl">
          {selectedFoto && (
            <img
              src={selectedFoto}
              alt="Foto ampliada"
              className="w-full h-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
