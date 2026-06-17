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
import { ArrowLeft, Edit, Loader2, Save, Plus, Dumbbell, MessageSquare, Trash2, User, Utensils, TrendingUp, Activity, Wallet, Upload } from "lucide-react";
import StudentImporter, { type ImportCompleteResult } from "./StudentImporter";
import ImportHistoryPanel from "@/components/import/ImportHistoryPanel";
import StudentPortalStatusCard from "@/components/student/StudentPortalStatusCard";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StudentProgressCoachTabs from "./coach/StudentProgressCoachTabs";
import StudentFinancialManagement from "./student/StudentFinancialManagement";
import { DietReturnDateFields } from "@/components/DietReturnDateFields";
import {
  DietRotationFields,
  dietRotationFromRow,
  dietRotationToPayload,
  type DietRotationFormState,
} from "@/components/DietRotationFields";
import { DietRotationBadge } from "@/components/DietRotationBadge";
import { getAlunoDisplayName } from "@/lib/aluno-display";
import { formatDateBR } from "@/lib/date-format";
import { confirmDelete, useConfirm } from "@/contexts/ConfirmContext";

interface Student {
  id: string;
  nome: string;
  email: string;
  data_nascimento: string | null;
  peso: number | null;
  objetivo: string | null;
  created_at: string;
  ultimo_contato_em?: string | null;
  ultimo_contato_resumo?: string | null;
  ultimo_contato_tipo?: string | null;
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
  data_retorno?: string | null;
  rotacao_ativa?: boolean | null;
  rotacao_dias_plano_a?: number | null;
  rotacao_dias_plano_b?: number | null;
  rotacao_plano_inicial?: string | null;
  rotacao_data_inicio?: string | null;
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
  const { confirm } = useConfirm();

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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importHistoryRefresh, setImportHistoryRefresh] = useState(0);
  const [portalStatusRefresh, setPortalStatusRefresh] = useState(0);
  const [novaDieta, setNovaDieta] = useState({
    nome: "",
    objetivo: "",
    data_retorno: "",
    dias_validade: "",
  });
  const [rotacaoDieta, setRotacaoDieta] = useState<DietRotationFormState>({
    rotacao_ativa: false,
    blocos: [
      { plano: "A", dias: "3" },
      { plano: "B", dias: "1" },
    ],
    rotacao_data_inicio: "",
  });

  const resetNovaDieta = () => {
    setNovaDieta({ nome: "", objetivo: "", data_retorno: "", dias_validade: "" });
    setRotacaoDieta({
      rotacao_ativa: false,
      blocos: [
        { plano: "A", dias: "3" },
        { plano: "B", dias: "1" },
      ],
      rotacao_data_inicio: "",
    });
  };

  useEffect(() => {
    if (id) {
      carregarDadosAluno();
      carregarTreinosDisponiveis();
    }
  }, [id]);

  const carregarDadosAluno = async () => {
    try {
      setLoading(true);
      // Evita mostrar dados do aluno anterior enquanto carrega o novo ID da rota.
      setStudent(null);
      setFeedback("");
      setFeedbackId(null);
      setTreinos([]);
      setDieta(null);
      setFotos([]);
      setSelectedFoto(null);

      // Carregar dados do aluno
      const alunoResult = await apiClient.requestSafe<any>(`/api/alunos/${id}`);
      const aluno = alunoResult.success ? alunoResult.data : null;
      if (!aluno) {
        toast({
          title: "Aluno não encontrado",
          description: "Não foi possível carregar os dados deste aluno.",
          variant: "destructive",
        });
        return;
      }
      setStudent(aluno);

      // Carregar feedback
      const feedbackResult = await apiClient.listFeedbacksAlunosSafe(id);
      const feedbackData = feedbackResult.success && Array.isArray(feedbackResult.data) ? feedbackResult.data : [];
      const feedback = feedbackData.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0] || null;
      if (feedback) {
        setFeedback(feedback.feedback);
        setFeedbackId(feedback.id);
      }

      // Carregar todos os treinos ativos - buscar alunos_treinos e depois treinos
      const alunosTreinosResult = await apiClient.requestSafe<any[]>(`/api/alunos-treinos?aluno_id=${id}&ativo=true`);
      const alunosTreinos = alunosTreinosResult.success && Array.isArray(alunosTreinosResult.data) ? alunosTreinosResult.data : [];
      
      // Buscar dados dos treinos para cada aluno_treino
      const treinosFormatados = await Promise.all(
        alunosTreinos.map(async (item: any) => {
          const treinoResult = await apiClient.requestSafe<any>(
            `/api/alunos-treinos/${item.id}/treino-resolvido`,
          );
          const treino = treinoResult.success ? treinoResult.data : null;
          if (treino) {
            return {
              ...treino,
              alunoTreinoId: item.id,
              dataExpiracao: item.data_expiracao,
              diasAntecedenciaNotificacao: item.dias_antecedencia_notificacao,
              personalizacoes: treino.personalizacoes ?? 0,
            };
          }
          return null;
        })
      );

      setTreinos(treinosFormatados.filter((t): t is Treino & { alunoTreinoId: string } => t !== null));

      // Carregar dieta atual
      const dietasResult = await apiClient.requestSafe<any[]>(`/api/dietas?aluno_id=${id}`);
      const dietas = dietasResult.success && Array.isArray(dietasResult.data) ? dietasResult.data : [];
      const dieta = dietas.sort((a, b) => new Date(b.data_criacao || 0).getTime() - new Date(a.data_criacao || 0).getTime())[0] || null;
      if (dieta) {
        setDieta(dieta);
        setRotacaoDieta(dietRotationFromRow(dieta));
      }

      // Carregar fotos
      const fotosResult = await apiClient.requestSafe<any[]>(`/api/fotos-alunos?aluno_id=${id}`);
      const fotosData = fotosResult.success && Array.isArray(fotosResult.data) ? fotosResult.data : [];
      const fotos = fotosData.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
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
        const updateResult = await apiClient.updateFeedbackAlunoSafe(feedbackId, { feedback });
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Erro ao atualizar feedback');
        }
      } else {
        // Criar novo feedback
        const createResult = await apiClient.createFeedbackAlunoSafe({
          aluno_id: id,
          coach_id: coachId,
          feedback,
        });
        const feedbackRecord = createResult.success ? createResult.data : null;
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
      const result = await apiClient.requestSafe<any[]>('/api/treinos');
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      const ordenados = data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setTreinosDisponiveis(ordenados);
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

      // Atribuir: copia o treino/template e vincula cópia exclusiva ao aluno
      const createResult = await apiClient.requestSafe('/api/alunos-treinos/assign', {
        method: 'POST',
        body: JSON.stringify({
          aluno_id: id,
          treino_id: treinoSelecionado,
          data_expiracao: dataExpiracao?.toISOString().split('T')[0] ?? null,
          data_retorno: dataExpiracao?.toISOString().split('T')[0] ?? null,
          dias_antecedencia_notificacao: diasAntecedenciaNotif ? parseInt(diasAntecedenciaNotif) : 7,
        }),
      });
      if (!createResult.success) {
        throw new Error(createResult.error || 'Erro ao atribuir treino');
      }

      toast({
        title: "Sucesso!",
        description: "Treino atribuído — pode personalizar no perfil do aluno.",
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
    if (
      !(await confirmDelete(
        confirm,
        `O treino "${treinoNome}" será desvinculado deste aluno.`,
        "Confirmar remoção",
      ))
    ) {
      return;
    }

    try {
      setSaving(true);

      const deleteResult = await apiClient.requestSafe(`/api/alunos-treinos/${alunoTreinoId}`, { method: 'DELETE' });
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Erro ao remover treino');
      }

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

      const createResult = await apiClient.requestSafe<any>('/api/dietas', {
        method: 'POST',
        body: JSON.stringify({
          nome: novaDieta.nome,
          objetivo: novaDieta.objetivo || null,
          aluno_id: id,
          data_retorno: novaDieta.data_retorno || null,
          ...dietRotationToPayload(rotacaoDieta),
        }),
      });
      const dieta = createResult.success ? createResult.data : null;

      toast({
        title: "Sucesso!",
        description: "Dieta criada com sucesso",
      });

      setIsCriarDietaOpen(false);
      resetNovaDieta();
      carregarDadosAluno();

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

  const handleImportComplete = (result?: ImportCompleteResult) => {
    setIsImportDialogOpen(false);
    setImportHistoryRefresh((k) => k + 1);
    setPortalStatusRefresh((k) => k + 1);
    carregarDadosAluno();
    if (result?.dietaId) {
      navigate(`/dieta/${result.dietaId}`);
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
      const conversaResult = await apiClient.requestSafe<any[]>('/api/conversas');
      const conversaData = conversaResult.success && Array.isArray(conversaResult.data) ? conversaResult.data : [];
      const conversaExistente = conversaData.find(c => c.coach_id === user.id && c.aluno_id === id) || null;

      if (!conversaExistente) {
        // Criar nova conversa
        await apiClient.requestSafe('/api/conversas', {
          method: 'POST',
          body: JSON.stringify({
            coach_id: user.id,
            aluno_id: id,
          }),
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
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-primary" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Aluno não encontrado</h2>
          <Button onClick={() => navigate("/?tab=students")}>
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
        <Button variant="ghost" onClick={() => navigate("/?tab=students")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para lista de alunos
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{getAlunoDisplayName(student)}</h1>
            {student.ultimo_contato_resumo && (
              <p className="text-sm text-muted-foreground mt-1">
                Último contacto: {student.ultimo_contato_resumo}
                {student.ultimo_contato_em
                  ? ` — ${new Date(student.ultimo_contato_em).toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
            )}
            <p className="text-muted-foreground">{student.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar ficha
            </Button>
            <Button onClick={handleIniciarConversa} disabled={saving}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Enviar Mensagem
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="!flex max-h-[min(92vh,880px)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden border p-0 shadow-xl sm:rounded-xl">
          <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 text-left sm:px-6 sm:py-4">
            <DialogTitle className="text-base sm:text-lg">Importar ficha</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              A dieta e o protocolo serão vinculados a {getAlunoDisplayName(student)}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
            <StudentImporter
              mode="enrich"
              targetAluno={{
                id: student.id,
                nome: getAlunoDisplayName(student),
                email: student.email,
              }}
              showDestinationPicker={false}
              onClose={() => setIsImportDialogOpen(false)}
              onImportComplete={handleImportComplete}
            />
          </div>
        </DialogContent>
      </Dialog>

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
          {id ? (
            <StudentPortalStatusCard
              alunoId={id}
              refreshKey={portalStatusRefresh}
              onLinked={() => {
                setPortalStatusRefresh((k) => k + 1);
                carregarDadosAluno();
              }}
            />
          ) : null}

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
                      <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
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

          {id ? (
            <ImportHistoryPanel alunoId={id} refreshKey={importHistoryRefresh} />
          ) : null}
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
                    <DialogDescription>
                      Escolha um template ou treino da biblioteca. Será vinculado ao aluno
                      sem duplicar na biblioteca — personalizações ficam só neste aluno.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Selecione um treino</Label>
                      {treinosDisponiveis.length === 0 ? (
                        <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">Nenhum treino cadastrado</p>
                          <p className="mt-1">
                            Crie treinos no menu lateral em <strong>Treinos</strong> antes de atribuir a um aluno.
                          </p>
                        </div>
                      ) : (
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
                      )}
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
                      <Button
                        onClick={handleAtribuirTreino}
                        disabled={saving || treinosDisponiveis.length === 0}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
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
                        {(treino.personalizacoes ?? 0) > 0 && (
                          <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                            {treino.personalizacoes} personalizações
                          </Badge>
                        )}
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
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="flex-1"
                          variant="outline"
                          onClick={() => navigate(`/treino/${treino.id}?atribuicao=${treino.alunoTreinoId}&from=/alunos/${id}`)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar treino
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleRemoverTreino(treino.alunoTreinoId, treino.nome)}
                          disabled={saving}
                        >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-lg">{dieta.nome}</h3>
                    <DietRotationBadge config={dieta} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Objetivo: {dieta.objetivo || "Não especificado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Criada em: {new Date(dieta.data_criacao).toLocaleDateString('pt-BR')}
                  </p>
                  {dieta.data_retorno && (
                    <p className="text-xs text-muted-foreground">
                      Retorno / vencimento: {formatDateBR(dieta.data_retorno)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" variant="outline" onClick={() => navigate(`/dieta/${dieta.id}`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar Dieta
                  </Button>
                  <Button className="flex-1" variant="secondary" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Reimportar ficha
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
                        <DialogDescription>
                          Defina nome, objetivo e opcionalmente a data de retorno da dieta.
                        </DialogDescription>
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
                        <DietReturnDateFields
                          dataRetorno={novaDieta.data_retorno}
                          diasValidade={novaDieta.dias_validade}
                          onDataRetornoChange={(iso) =>
                            setNovaDieta({ ...novaDieta, data_retorno: iso })
                          }
                          onDiasValidadeChange={(dias) =>
                            setNovaDieta({ ...novaDieta, dias_validade: dias })
                          }
                        />
                        <DietRotationFields value={rotacaoDieta} onChange={setRotacaoDieta} />
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setIsCriarDietaOpen(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleCriarDieta} disabled={saving}>
                            {saving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
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
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="default" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar ficha PDF
                  </Button>
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
                      <DialogDescription>
                        Defina nome, objetivo e opcionalmente a data de retorno da dieta.
                      </DialogDescription>
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
                      <DietReturnDateFields
                        dataRetorno={novaDieta.data_retorno}
                        diasValidade={novaDieta.dias_validade}
                        onDataRetornoChange={(iso) =>
                          setNovaDieta({ ...novaDieta, data_retorno: iso })
                        }
                        onDiasValidadeChange={(dias) =>
                          setNovaDieta({ ...novaDieta, dias_validade: dias })
                        }
                      />
                      <DietRotationFields value={rotacaoDieta} onChange={setRotacaoDieta} />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setIsCriarDietaOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCriarDieta} disabled={saving}>
                          {saving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
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
              <StudentProgressCoachTabs studentId={id} studentName={getAlunoDisplayName(student)} />
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
          <DialogHeader className="sr-only">
            <DialogTitle>Foto ampliada</DialogTitle>
            <DialogDescription>Visualização em tamanho maior da foto do aluno.</DialogDescription>
          </DialogHeader>
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
