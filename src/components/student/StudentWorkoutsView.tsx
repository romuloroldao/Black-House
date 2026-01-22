import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Clock, Target, ChevronDown, Play, Weight, FileDown } from "lucide-react";
import { exportWorkoutToPdf } from "@/utils/workoutPdfExport";

const StudentWorkoutsView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [treinos, setTreinos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const [studentName, setStudentName] = useState<string>("");

  const handleExportPdf = (treino: any) => {
    try {
      exportWorkoutToPdf({
        id: treino.id,
        nome: treino.nome,
        descricao: treino.descricao,
        categoria: treino.categoria,
        dificuldade: treino.dificuldade,
        duracao: treino.duracao,
        exercicios: treino.exercicios,
        tags: treino.tags,
        dataExpiracao: treino.dataExpiracao,
      }, studentName);
      toast({
        title: "PDF exportado!",
        description: "Seu treino foi exportado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar o treino.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      loadWorkoutData();
    }
  }, [user]);

  const loadWorkoutData = async () => {
    try {
      setLoading(true);
      // DESIGN-ALUNO-CANONICO-MIGRATION-006: Usar rota canônica GET /api/alunos/me
      const aluno = await apiClient.getMe();

      if (aluno) {
        setStudentName(aluno.nome || user?.email || "");
        
        const alunosTreinos = await apiClient
          .from("alunos_treinos")
          .select("*")
          .eq("aluno_id", aluno.id)
          .eq("ativo", true)
          .order("data_inicio", { ascending: false });

        if (Array.isArray(alunosTreinos) && alunosTreinos.length > 0) {
          // Buscar treinos separadamente
          const treinosComExpiracao = await Promise.all(
            alunosTreinos.map(async (at: any) => {
              const treinos = await apiClient
                .from("treinos")
                .select("*")
                .eq("id", at.treino_id);
              const treino = Array.isArray(treinos) && treinos.length > 0 ? treinos[0] : null;
              return {
                ...treino,
                dataExpiracao: at.data_expiracao,
                diasAntecedenciaNotificacao: at.dias_antecedencia_notificacao
              };
            })
          );
          setTreinos(treinosComExpiracao.filter(t => t.id)); // Filtrar treinos válidos
        }
      }
    } catch (error) {
      console.error("Erro ao carregar treinos:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando treinos...</p>
        </div>
      </div>
    );
  }

  if (!treinos || treinos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum treino atribuído</h3>
          <p className="text-muted-foreground">
            Entre em contato com seu coach para receber seu treino personalizado
          </p>
        </div>
      </div>
    );
  }

  const toggleWorkout = (treinoId: string) => {
    setExpandedWorkouts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(treinoId)) {
        newSet.delete(treinoId);
      } else {
        newSet.add(treinoId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Meus Treinos</h1>
        <p className="text-muted-foreground">
          {treinos.length === 1 ? "Seu plano de treino personalizado" : `Você tem ${treinos.length} treinos ativos`}
        </p>
      </div>

      <div className="grid gap-6">
        {treinos.map((treino, idx) => {
          const isExpanded = expandedWorkouts.has(treino.id);
          const exercicios = treino.exercicios || [];
          
          // Calcular dias restantes até expiração
          const hoje = new Date();
          const dataExpiracao = treino.dataExpiracao ? new Date(treino.dataExpiracao) : null;
          const diasRestantes = dataExpiracao 
            ? Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          
          return (
            <Card key={idx} className="shadow-card border-primary/20">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-2xl">{treino.nome}</CardTitle>
                    <p className="text-muted-foreground mt-2">{treino.descricao}</p>
                  </div>
                  <div className="flex gap-2 ml-4 items-start">
                    <Badge variant="premium">Ativo</Badge>
                    {diasRestantes !== null && (
                      <Badge 
                        variant={diasRestantes <= 7 ? "destructive" : "secondary"}
                        className={diasRestantes <= 7 ? "bg-destructive/10 text-destructive border-destructive/20" : ""}
                      >
                        {diasRestantes > 0 
                          ? `${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'} restante${diasRestantes === 1 ? '' : 's'}`
                          : 'Expirado'
                        }
                      </Badge>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleExportPdf(treino)}
                      className="shrink-0"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <Target className="h-8 w-8 text-primary" />
                    <div>
                      <div className="text-sm text-muted-foreground">Categoria</div>
                      <div className="font-semibold">{treino.categoria}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <Dumbbell className="h-8 w-8 text-primary" />
                    <div>
                      <div className="text-sm text-muted-foreground">Dificuldade</div>
                      <div className="font-semibold">{treino.dificuldade}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <Clock className="h-8 w-8 text-primary" />
                    <div>
                      <div className="text-sm text-muted-foreground">Duração</div>
                      <div className="font-semibold">{treino.duracao} min</div>
                    </div>
                  </div>
                </div>

                {treino.tags && treino.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {treino.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Exercícios */}
                <div>
                  <Collapsible open={isExpanded} onOpenChange={() => toggleWorkout(treino.id)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <div className="flex items-center gap-2">
                          <Dumbbell className="h-4 w-4" />
                          <span>
                            Ver Exercícios {exercicios.length > 0 && `(${exercicios.length})`}
                          </span>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      {exercicios.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum exercício cadastrado neste treino
                        </p>
                      ) : (
                        exercicios.map((exercicio: any, exIdx: number) => (
                          <Card key={exIdx} className="border-primary/10">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="text-primary">#{exIdx + 1}</span>
                                    {exercicio.nome}
                                  </h4>
                                  {exercicio.observacoes && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {exercicio.observacoes}
                                    </p>
                                  )}
                                </div>
                                {exercicio.video_url && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => window.open(exercicio.video_url, '_blank')}
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                                  <Target className="h-4 w-4 text-primary" />
                                  <div>
                                    <div className="text-xs text-muted-foreground">Séries</div>
                                    <div className="font-semibold">{exercicio.series}</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                                  <Dumbbell className="h-4 w-4 text-primary" />
                                  <div>
                                    <div className="text-xs text-muted-foreground">Repetições</div>
                                    <div className="font-semibold">{exercicio.repeticoes}</div>
                                  </div>
                                </div>
                                
                                {exercicio.peso && (
                                  <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                                    <Weight className="h-4 w-4 text-primary" />
                                    <div>
                                      <div className="text-xs text-muted-foreground">T.E.P</div>
                                      <div className="font-semibold">{exercicio.peso}</div>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                                  <Clock className="h-4 w-4 text-primary" />
                                  <div>
                                    <div className="text-xs text-muted-foreground">Descanso</div>
                                    <div className="font-semibold">{exercicio.descanso}</div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                <div className="p-4 rounded-lg bg-gradient-premium border border-primary/30">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Instruções
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Siga este treino conforme orientado pelo seu coach. Mantenha a consistência e foco nos exercícios.
                    Em caso de dúvidas, entre em contato através do chat.
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StudentWorkoutsView;
