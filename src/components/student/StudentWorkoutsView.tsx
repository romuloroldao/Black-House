import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Clock, Target, ChevronDown, Play, Weight, FileDown } from "lucide-react";
import { exportWorkoutToPdf } from "@/utils/workoutPdfExport";
import StudentWorkoutSessionView from "@/components/student/StudentWorkoutSessionView";
import PremiumEmptyState from "@/components/student/PremiumEmptyState";
import { readSessionProgress } from "@/lib/workout-session-utils";

const StudentWorkoutsView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [treinos, setTreinos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTreino, setSessionTreino] = useState<any | null>(null);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const [studentName, setStudentName] = useState<string>("");

  const treinoPrincipal = treinos[0] ?? null;
  const sessionProgress = treinoPrincipal ? readSessionProgress(treinoPrincipal.id) : null;

  const handleExportPdf = async (treino: any) => {
    try {
      await exportWorkoutToPdf(
        {
          id: treino.id,
          nome: treino.nome,
          descricao: treino.descricao,
          categoria: treino.categoria,
          dificuldade: treino.dificuldade,
          duracao: treino.duracao,
          exercicios: treino.exercicios,
          tags: treino.tags,
          dataExpiracao: treino.dataExpiracao,
        },
        studentName,
      );
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
      void loadWorkoutData();
    }
  }, [user]);

  const loadWorkoutData = async () => {
    setLoading(true);
    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (aluno) {
      setStudentName(aluno.nome || user?.email || "");

      const alunosTreinosResult = await apiClient.requestSafe<any[]>("/api/alunos-treinos");
      const alunosTreinos =
        alunosTreinosResult.success && Array.isArray(alunosTreinosResult.data)
          ? alunosTreinosResult.data
          : [];

      const alunosTreinosFiltrados = alunosTreinos
        .filter((at: any) => at.aluno_id === aluno.id && at.ativo === true)
        .sort(
          (a: any, b: any) =>
            new Date(b.data_inicio || 0).getTime() - new Date(a.data_inicio || 0).getTime(),
        );

      if (alunosTreinosFiltrados.length > 0) {
        const treinosComExpiracao = await Promise.all(
          alunosTreinosFiltrados.map(async (at: any) => {
            const treinoResult = await apiClient.requestSafe<any>(`/api/treinos/${at.treino_id}`);
            const treino = treinoResult.success ? treinoResult.data : null;
            return {
              ...treino,
              dataExpiracao: at.data_expiracao,
              data_retorno: at.data_retorno,
              diasAntecedenciaNotificacao: at.dias_antecedencia_notificacao,
            };
          }),
        );
        setTreinos(treinosComExpiracao.filter((t) => t?.id));
      } else {
        setTreinos([]);
      }
    } else {
      setTreinos([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (loading || searchParams.get("session") !== "1") return;
    const principal = treinos[0];
    if (principal?.exercicios?.length) {
      setSessionTreino(principal);
      const next = new URLSearchParams(searchParams);
      next.delete("session");
      setSearchParams(next, { replace: true });
    }
  }, [loading, treinos, searchParams, setSearchParams]);

  const exercicioCount = useMemo(() => {
    const ex = treinoPrincipal?.exercicios;
    return Array.isArray(ex) ? ex.length : 0;
  }, [treinoPrincipal]);

  if (sessionTreino) {
    return (
      <StudentWorkoutSessionView
        treino={sessionTreino}
        onExit={() => {
          setSessionTreino(null);
          void loadWorkoutData();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-w-0 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!treinos || treinos.length === 0) {
    return (
      <PremiumEmptyState
        icon={Dumbbell}
        title="Nenhum treino atribuído"
        description="O seu coach pode ativar um plano aqui. Depois use Iniciar sessão para treinar com timer e progresso."
      />
    );
  }

  const toggleWorkout = (treinoId: string) => {
    setExpandedWorkouts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(treinoId)) newSet.delete(treinoId);
      else newSet.add(treinoId);
      return newSet;
    });
  };

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Meus treinos</h1>
        <p className="text-muted-foreground">
          {treinos.length === 1
            ? "Seu plano de treino personalizado"
            : `${treinos.length} treinos ativos`}
        </p>
      </div>

      {treinoPrincipal && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-card">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">
                  Treino de hoje
                </p>
                <CardTitle className="text-xl">{treinoPrincipal.nome}</CardTitle>
              </div>
              <Badge variant="premium">Ativo</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {treinoPrincipal.descricao || "Pronto para treinar?"}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {exercicioCount > 0 && (
                <span>{exercicioCount} exercício{exercicioCount !== 1 ? "s" : ""}</span>
              )}
              {treinoPrincipal.duracao != null && (
                <span>· ~{treinoPrincipal.duracao} min</span>
              )}
              {sessionProgress && sessionProgress.completedIndexes.length > 0 && (
                <span className="text-primary">
                  · {sessionProgress.completedIndexes.length} feitos hoje
                </span>
              )}
            </div>
            <Button
              type="button"
              className="h-12 w-full text-base font-semibold"
              disabled={exercicioCount === 0}
              onClick={() => setSessionTreino(treinoPrincipal)}
            >
              <Play className="mr-2 h-5 w-5 fill-current" />
              Iniciar sessão
            </Button>
            {exercicioCount === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Aguarde o coach cadastrar os exercícios deste treino.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {treinos.map((treino, idx) => {
          const isExpanded = expandedWorkouts.has(treino.id);
          const exercicios = treino.exercicios || [];
          const hoje = new Date();
          const dataExpiracao = treino.dataExpiracao ? new Date(treino.dataExpiracao) : null;
          const diasRestantes = dataExpiracao
            ? Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <Card key={idx} className="shadow-card border-primary/20">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-xl">{treino.nome}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{treino.descricao}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {idx === 0 && <Badge variant="outline">Principal</Badge>}
                    {diasRestantes !== null && (
                      <Badge
                        variant={diasRestantes <= 7 ? "destructive" : "secondary"}
                      >
                        {diasRestantes > 0
                          ? `${diasRestantes}d restantes`
                          : "Expirado"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={!exercicios.length}
                    onClick={() => setSessionTreino(treino)}
                  >
                    <Play className="mr-1 h-4 w-4" />
                    Iniciar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportPdf(treino)}
                  >
                    <FileDown className="mr-1 h-4 w-4" />
                    PDF
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                    <Target className="h-5 w-5 text-primary shrink-0" />
                    <span>{treino.categoria || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                    <Dumbbell className="h-5 w-5 text-primary shrink-0" />
                    <span>{treino.dificuldade || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                    <Clock className="h-5 w-5 text-primary shrink-0" />
                    <span>{treino.duracao != null ? `${treino.duracao} min` : "—"}</span>
                  </div>
                </div>

                <Separator />

                <Collapsible open={isExpanded} onOpenChange={() => toggleWorkout(treino.id)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>
                        Ver exercícios {exercicios.length > 0 && `(${exercicios.length})`}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-3">
                    {exercicios.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum exercício cadastrado
                      </p>
                    ) : (
                      exercicios.map((exercicio: any, exIdx: number) => (
                        <div
                          key={exIdx}
                          className="rounded-lg border border-border/60 p-3"
                        >
                          <p className="font-medium">
                            #{exIdx + 1} {exercicio.nome}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {exercicio.series}×{exercicio.repeticoes}
                            {exercicio.peso ? ` · ${exercicio.peso}` : ""}
                          </p>
                        </div>
                      ))
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StudentWorkoutsView;
