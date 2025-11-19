import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Loader2, Save, Plus, Dumbbell, MessageSquare, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StudentProgressDashboard from "./student/StudentProgressDashboard";

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
      const { data: alunoData, error: alunoError } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", id)
        .single();

      if (alunoError) throw alunoError;
      setStudent(alunoData);

      // Carregar feedback
      const { data: feedbackData } = await supabase
        .from("feedbacks_alunos")
        .select("*")
        .eq("aluno_id", id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (feedbackData) {
        setFeedback(feedbackData.feedback);
        setFeedbackId(feedbackData.id);
      }

      // Carregar todos os treinos ativos
      const { data: treinosData } = await supabase
        .from("alunos_treinos")
        .select(`
          id,
          treino_id,
          data_expiracao,
          dias_antecedencia_notificacao,
          treinos (
            id,
            nome,
            descricao,
            categoria,
            dificuldade,
            duracao
          )
        `)
        .eq("aluno_id", id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (treinosData) {
        const treinosFormatados = treinosData
          .filter((item: any) => item.treinos)
          .map((item: any) => ({
            ...item.treinos,
            alunoTreinoId: item.id,
            dataExpiracao: item.data_expiracao,
            diasAntecedenciaNotificacao: item.dias_antecedencia_notificacao
          }));
        setTreinos(treinosFormatados);
      }

      // Carregar dieta atual
      const { data: dietaData } = await supabase
        .from("dietas")
        .select("*")
        .eq("aluno_id", id)
        .order("data_criacao", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dietaData) {
        setDieta(dietaData);
      }

      // Carregar fotos
      const { data: fotosData } = await supabase
        .from("fotos_alunos")
        .select("*")
        .eq("aluno_id", id)
        .order("created_at", { ascending: false });

      if (fotosData) {
        setFotos(fotosData);
      }
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
        const { error } = await supabase
          .from("feedbacks_alunos")
          .update({ feedback })
          .eq("id", feedbackId);

        if (error) throw error;
      } else {
        // Criar novo feedback
        const { data, error } = await supabase
          .from("feedbacks_alunos")
          .insert({
            aluno_id: id,
            coach_id: coachId,
            feedback,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setFeedbackId(data.id);
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
      const { data, error } = await supabase
        .from("treinos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setTreinosDisponiveis(data);
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
      const { error } = await supabase
        .from("alunos_treinos")
        .insert({
          aluno_id: id,
          treino_id: treinoSelecionado,
          ativo: true,
          data_expiracao: dataExpiracao?.toISOString().split('T')[0],
          dias_antecedencia_notificacao: diasAntecedenciaNotif ? parseInt(diasAntecedenciaNotif) : 7,
          notificacao_expiracao_enviada: false,
        });

      if (error) throw error;

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

      const { error } = await supabase
        .from("alunos_treinos")
        .delete()
        .eq("id", alunoTreinoId);

      if (error) throw error;

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

      const { data, error } = await supabase
        .from("dietas")
        .insert({
          nome: novaDieta.nome,
          objetivo: novaDieta.objetivo || null,
          aluno_id: id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Dieta criada com sucesso",
      });

      setIsCriarDietaOpen(false);
      setNovaDieta({ nome: "", objetivo: "" });
      carregarDadosAluno();
      
      // Redirecionar para a página de edição da dieta
      if (data) {
        navigate(`/dieta/${data.id}`);
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

      // Obter o ID do usuário autenticado (coach)
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar autenticado",
          variant: "destructive",
        });
        return;
      }

      // Verificar se já existe uma conversa
      const { data: conversaExistente } = await supabase
        .from("conversas")
        .select("id")
        .eq("coach_id", user.id)
        .eq("aluno_id", id)
        .single();

      if (!conversaExistente) {
        // Criar nova conversa
        const { error } = await supabase
          .from("conversas")
          .insert({
            coach_id: user.id,
            aluno_id: id,
          });

        if (error) throw error;
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

        {/* Treinos */}
        <Card className="md:col-span-2">
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
      </div>

      {/* Fotos do Aluno */}
      <Card className="mt-6">
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
      <Card className="mt-6">
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
