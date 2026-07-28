import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Clock, Target, ChevronDown, Play, Weight, FileDown } from "lucide-react";
import { exportWorkoutToPdf } from "@/utils/workoutPdfExport";
import StudentWorkoutSessionView from "@/components/student/StudentWorkoutSessionView";
import PremiumEmptyState from "@/components/student/PremiumEmptyState";
import { readSessionProgress } from "@/lib/workout-session-utils";
import {
  DIAS_SEMANA_LABELS,
  DIAS_SEMANA_ORDEM,
  type DiaSemanaIso,
  type TreinoAgendaSession,
} from "@/lib/treino-agenda-types";

function isoDayToday(): DiaSemanaIso {
  const d = new Date().getDay();
  return (d === 0 ? 7 : d) as DiaSemanaIso;
}

const StudentWorkoutsView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [treinos, setTreinos] = useState<any[]>([]);
  const [agendaSessions, setAgendaSessions] = useState<TreinoAgendaSession[]>([]);
  const [hasAgenda, setHasAgenda] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionTreino, setSessionTreino] = useState<any | null>(null);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const [studentName, setStudentName] = useState<string>("");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const diaHoje = isoDayToday();

  const treinoPrincipal = useMemo(() => {
    if (!treinos.length) return null;
    const slotHoje = agendaSessions.find((s) => Number(s.dia_semana) === diaHoje);
    if (slotHoje) {
      return (
        treinos.find((t) => t.alunoTreinoId === slotHoje.aluno_treino_id) ||
        treinos.find((t) => t.id === slotHoje.treino_id) ||
        null
      );
    }
    if (hasAgenda) return null; // descanso programado
    return treinos[0] ?? null;
  }, [treinos, agendaSessions, diaHoje, hasAgenda]);

  const descansoHoje = hasAgenda && !treinoPrincipal;
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

      const [alunosTreinosResult, agendaResult] = await Promise.all([
        apiClient.requestSafe<any[]>("/api/alunos-treinos"),
        apiClient.getTreinoAgendaSafe(),
      ]);

      const alunosTreinos =
        alunosTreinosResult.success && Array.isArray(alunosTreinosResult.data)
          ? alunosTreinosResult.data
          : [];

      const sessions =
        agendaResult.success && agendaResult.data?.sessions
          ? agendaResult.data.sessions
          : [];
      setAgendaSessions(sessions);
      setHasAgenda(sessions.length > 0);

      const alunosTreinosFiltrados = alunosTreinos
        .filter((at: any) => at.aluno_id === aluno.id && at.ativo === true)
        .sort(
          (a: any, b: any) =>
            new Date(b.data_inicio || 0).getTime() - new Date(a.data_inicio || 0).getTime(),
        );

      if (alunosTreinosFiltrados.length > 0) {
        const treinosComExpiracao = await Promise.all(
          alunosTreinosFiltrados.map(async (at: any) => {
            const treinoResult = await apiClient.requestSafe<any>(
              `/api/alunos-treinos/${at.id}/treino-resolvido`,
            );
            const treino = treinoResult.success ? treinoResult.data : null;
            return {
              ...treino,
              alunoTreinoId: at.id,
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
      setAgendaSessions([]);
      setHasAgenda(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (loading || searchParams.get("session") !== "1") return;
    if (treinoPrincipal?.exercicios?.length) {
      setSessionTreino(treinoPrincipal);
      const next = new URLSearchParams(searchParams);
      next.delete("session");
      setSearchParams(next, { replace: true });
    }
  }, [loading, treinoPrincipal, searchParams, setSearchParams]);

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

  const toggleWorkout = (treinoId: string, cardEl?: HTMLElement | null) => {
    setExpandedWorkouts((prev) => {
      const newSet = new Set(prev);
      const willOpen = !newSet.has(treinoId);
      if (willOpen) newSet.add(treinoId);
      else newSet.delete(treinoId);
      if (willOpen && cardEl) {
        requestAnimationFrame(() => {
          cardEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
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

      {hasAgenda ? (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Esta semana</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sessões programadas pelo seu coach
            </p>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {DIAS_SEMANA_ORDEM.map((dia) => {
                const slot = agendaSessions.find((s) => Number(s.dia_semana) === dia);
                const nome =
                  slot?.treino_nome ||
                  treinos.find((t) => t.alunoTreinoId === slot?.aluno_treino_id)?.nome;
                const isToday = dia === diaHoje;
                return (
                  <li
                    key={dia}
                    className={
                      isToday
                        ? "rounded-lg border border-primary/40 bg-primary/10 p-2"
                        : "rounded-lg border border-border/60 bg-muted/20 p-2"
                    }
                  >
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {DIAS_SEMANA_LABELS[dia]}
                      {isToday ? " · hoje" : ""}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-snug">
                      {slot ? nome || "Treino" : "Descanso"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {descansoHoje ? (
        <Card className="border-border/60 shadow-card">
          <CardContent className="py-5 text-center">
            <p className="font-medium">Descanso hoje</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Não há sessão programada para este dia na sua agenda semanal.
            </p>
          </CardContent>
        </Card>
      ) : null}

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
              <Badge variant="premium">{hasAgenda ? "Na agenda" : "Ativo"}</Badge>
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
          const isHoje =
            treinoPrincipal &&
            (treino.alunoTreinoId === treinoPrincipal.alunoTreinoId ||
              treino.id === treinoPrincipal.id);

          return (
            <Card
              key={idx}
              ref={(el) => {
                cardRefs.current[treino.id] = el;
              }}
              className="shadow-card border-primary/20"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-xl">{treino.nome}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{treino.descricao}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {isHoje && <Badge variant="outline">Hoje</Badge>}
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

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      toggleWorkout(treino.id, cardRefs.current[treino.id])
                    }
                  >
                    <span>
                      Ver exercícios {exercicios.length > 0 && `(${exercicios.length})`}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </Button>
                  {isExpanded ? (
                    <div className="mt-4 space-y-3">
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
                              {[
                                exercicio.series != null && exercicio.series !== ""
                                  ? `Série ${exercicio.series}`
                                  : null,
                                exercicio.repeticoes != null && exercicio.repeticoes !== ""
                                  ? `Reps ${exercicio.repeticoes}`
                                  : null,
                                exercicio.peso != null && exercicio.peso !== ""
                                  ? `TEP ${exercicio.peso}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" / ")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
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
