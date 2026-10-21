import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dumbbell,
  Play,
  FileDown,
  MoreHorizontal,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { exportWorkoutToPdf } from "@/utils/workoutPdfExport";
import { trackStudentEvent } from "@/lib/studentAnalytics";

type Exercicio = {
  nome: string;
  series?: string | number;
  repeticoes?: string | number;
  peso?: string | number;
  descanso?: string;
  observacoes?: string;
  video_url?: string;
};

function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/
  );
  if (yt) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
        <iframe
          title="Vídeo do exercício"
          src={`https://www.youtube.com/embed/${yt[1]}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
    return (
      <video
        controls
        className="w-full rounded-lg bg-muted max-h-64"
        src={url}
      />
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full min-h-[44px]"
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
    >
      <Play className="h-4 w-4 mr-2" />
      Abrir vídeo
    </Button>
  );
}

const StudentWorkoutsView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [treinos, setTreinos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [sessionTreinoId, setSessionTreinoId] = useState<string | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (user) {
      trackStudentEvent("workout_opened");
      loadWorkoutData();
    }
  }, [user]);

  const loadWorkoutData = async () => {
    try {
      setLoading(true);
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id, nome")
        .eq("email", user?.email)
        .maybeSingle();

      if (aluno) {
        setStudentName(aluno.nome || user?.email || "");

        const { data: alunosTreinos } = await supabase
          .from("alunos_treinos")
          .select(`*, treinos(*)`)
          .eq("aluno_id", aluno.id)
          .eq("ativo", true)
          .order("data_inicio", { ascending: false });

        if (alunosTreinos) {
          setTreinos(
            alunosTreinos.map((at: any) => ({
              ...at.treinos,
              dataExpiracao: at.data_expiracao,
              diasAntecedenciaNotificacao: at.dias_antecedencia_notificacao,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Erro ao carregar treinos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = (treino: any) => {
    try {
      exportWorkoutToPdf(
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
        studentName
      );
      trackStudentEvent("workout_pdf_exported", { workout_id: treino.id });
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

  const startSession = (treino: any) => {
    const exercicios: Exercicio[] = treino.exercicios || [];
    if (exercicios.length === 0) {
      toast({
        title: "Sem exercícios",
        description: "Este treino ainda não tem exercícios cadastrados.",
        variant: "destructive",
      });
      return;
    }
    setSessionTreinoId(treino.id);
    setSessionIndex(0);
    setCompleted(new Set());
    trackStudentEvent("hoje_cta_clicked", {
      cta: "workout_session_start",
      tab: "workouts",
      workout_id: treino.id,
    });
  };

  const endSession = () => {
    setSessionTreinoId(null);
    setSessionIndex(0);
    setCompleted(new Set());
  };

  const sessionTreino = useMemo(
    () => treinos.find((t) => t.id === sessionTreinoId) || null,
    [treinos, sessionTreinoId]
  );

  const sessionExercicios: Exercicio[] = sessionTreino?.exercicios || [];
  const currentExercise = sessionExercicios[sessionIndex];
  const sessionProgress =
    sessionExercicios.length > 0
      ? (completed.size / sessionExercicios.length) * 100
      : 0;

  const markDoneAndNext = () => {
    setCompleted((prev) => new Set(prev).add(sessionIndex));
    if (sessionIndex < sessionExercicios.length - 1) {
      setSessionIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toast({
        title: "Treino concluído!",
        description: "Você finalizou todos os exercícios desta sessão.",
      });
      endSession();
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

  // —— Modo sessão (1 exercício por tela) ——
  if (sessionTreino && currentExercise) {
    const isDone = completed.has(sessionIndex);
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px]"
            onClick={endSession}
          >
            <X className="h-4 w-4 mr-1" />
            Sair
          </Button>
          <p className="text-sm text-muted-foreground truncate">
            {sessionTreino.nome}
          </p>
          <span className="text-sm font-medium tabular-nums">
            {sessionIndex + 1}/{sessionExercicios.length}
          </span>
        </div>

        <Progress value={sessionProgress} className="h-2" />

        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <p className="text-xs uppercase tracking-wide text-primary font-medium">
              Exercício {sessionIndex + 1}
            </p>
            <CardTitle className="text-2xl leading-tight">
              {currentExercise.nome}
            </CardTitle>
            {currentExercise.observacoes && (
              <p className="text-sm text-muted-foreground">
                {currentExercise.observacoes}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Séries</div>
                <div className="text-xl font-semibold">
                  {currentExercise.series ?? "—"}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Repetições</div>
                <div className="text-xl font-semibold">
                  {currentExercise.repeticoes ?? "—"}
                </div>
              </div>
              {currentExercise.peso != null && currentExercise.peso !== "" && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">
                    T.E.P. (carga / esforço)
                  </div>
                  <div className="text-xl font-semibold">
                    {currentExercise.peso}
                  </div>
                </div>
              )}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Descanso</div>
                <div className="text-xl font-semibold">
                  {currentExercise.descanso ?? "—"}
                </div>
              </div>
            </div>

            {currentExercise.video_url && (
              <VideoEmbed url={currentExercise.video_url} />
            )}

            {isDone && (
              <Badge variant="secondary" className="w-fit">
                <Check className="h-3 w-3 mr-1" />
                Feito
              </Badge>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2 sticky bottom-20 md:bottom-4 bg-background/95 py-3 border-t -mx-1 px-1">
          <Button
            variant="outline"
            className="min-h-[44px] flex-1"
            disabled={sessionIndex === 0}
            onClick={() => setSessionIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <Button
            className="min-h-[44px] flex-[1.4]"
            onClick={markDoneAndNext}
          >
            {sessionIndex >= sessionExercicios.length - 1 ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Concluir
              </>
            ) : (
              <>
                Feito · próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // —— Lista de treinos ——
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Meus Treinos</h1>
        <p className="text-muted-foreground">
          {treinos.length === 1
            ? "Seu plano de treino — toque em Começar para treinar"
            : `${treinos.length} treinos ativos`}
        </p>
      </div>

      <div className="grid gap-4">
        {treinos.map((treino, idx) => {
          const exercicios: Exercicio[] = treino.exercicios || [];
          const hoje = new Date();
          const dataExpiracao = treino.dataExpiracao
            ? new Date(treino.dataExpiracao)
            : null;
          const diasRestantes = dataExpiracao
            ? Math.ceil(
                (dataExpiracao.getTime() - hoje.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null;
          const isPrimary = idx === 0;

          return (
            <Card
              key={treino.id || idx}
              className={
                isPrimary
                  ? "border-primary/40 bg-primary/5"
                  : "border-border"
              }
            >
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isPrimary && (
                      <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">
                        Treino de hoje
                      </p>
                    )}
                    <CardTitle className="text-xl sm:text-2xl leading-tight">
                      {treino.nome}
                    </CardTitle>
                    {treino.descricao && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {treino.descricao}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 min-h-[44px] min-w-[44px]"
                        aria-label="Mais opções"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportPdf(treino)}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Exportar PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="premium">Ativo</Badge>
                  {treino.categoria && (
                    <Badge variant="outline">{treino.categoria}</Badge>
                  )}
                  {treino.dificuldade && (
                    <Badge variant="outline">{treino.dificuldade}</Badge>
                  )}
                  {treino.duracao && (
                    <Badge variant="secondary">{treino.duracao} min</Badge>
                  )}
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
              </CardHeader>

              <CardContent className="space-y-4">
                <Button
                  size="lg"
                  className="w-full min-h-[48px]"
                  onClick={() => startSession(treino)}
                  disabled={exercicios.length === 0}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Começar
                  {exercicios.length > 0 && (
                    <span className="ml-1 opacity-80">
                      ({exercicios.length} exercícios)
                    </span>
                  )}
                </Button>

                {exercicios.length > 0 && (
                  <ol className="space-y-2">
                    {exercicios.map((ex, exIdx) => (
                      <li
                        key={`${ex.nome}-${exIdx}`}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        <span className="text-primary font-semibold text-sm tabular-nums pt-0.5">
                          {exIdx + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">{ex.nome}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ex.series != null && `${ex.series} séries`}
                            {ex.repeticoes != null &&
                              ` · ${ex.repeticoes} reps`}
                            {ex.peso != null &&
                              ex.peso !== "" &&
                              ` · T.E.P. ${ex.peso}`}
                            {ex.descanso && ` · descanso ${ex.descanso}`}
                          </p>
                        </div>
                        {ex.video_url && (
                          <Play className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {exercicios.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum exercício cadastrado neste treino
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StudentWorkoutsView;
