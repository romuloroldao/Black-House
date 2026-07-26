import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import { useAlunoHoje } from "@/hooks/useAlunoHoje";
import type { AlunoHojeResponse } from "@/types/aluno-hoje";
import {
  mapPendenciasFromApi,
  mapRetornoFromApi,
  type PendingTask,
} from "@/lib/student-portal-utils";
import { apiClient } from "@/lib/api-client";
import { trackAgentEvent } from "@/lib/agent-analytics";
import { cn } from "@/lib/utils";
import ReturnCountdownBanner from "@/components/student/ReturnCountdownBanner";
import ProfileCompletenessBanner from "@/components/student/ProfileCompletenessBanner";
import type { ProfileCompletenessStatus } from "@/types/profile-completeness";
import PendingTasksList from "@/components/student/PendingTasksList";
import TodayHeroCard from "@/components/student/today/TodayHeroCard";
import TodayPlanCards from "@/components/student/today/TodayPlanCards";
import CheckinStreakCard from "@/components/student/today/CheckinStreakCard";
import BehavioralInsightCard from "@/components/student/today/BehavioralInsightCard";
import TodayPhotoCard from "@/components/student/today/TodayPhotoCard";
import StudentCoachCheckinFeedback from "@/components/student/StudentCoachCheckinFeedback";
import AgentComposer from "@/components/student/agent/AgentComposer";
import AgentThread from "@/components/student/agent/AgentThread";
import NextActionHero, { type ProximaAcao } from "@/components/student/agent/NextActionHero";
import TodayContextStrip from "@/components/student/agent/TodayContextStrip";
import WeightLogDialog from "@/components/student/agent/WeightLogDialog";
import { chipsForProximaAcao } from "@/components/student/agent/agent-chips";
import { useStudentAgent, type AgentUiOpenTarget } from "@/hooks/useStudentAgent";

type StudentTodayViewProps = {
  /** Evita segunda chamada quando o portal já carregou /api/alunos/me/hoje */
  hojeState?: {
    data: AlunoHojeResponse | null;
    loading: boolean;
    refetch?: () => void | Promise<void>;
  };
  profileStatus?: ProfileCompletenessStatus | null;
  onOpenProfileWizard?: () => void;
  /** Abre o drawer de navegação (mobile) / destaca explorar */
  onExplorePlatform?: () => void;
};

const StudentTodayView = ({
  hojeState,
  profileStatus,
  onOpenProfileWizard,
  onExplorePlatform,
}: StudentTodayViewProps) => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [, setSearchParams] = useSearchParams();
  const internal = useAlunoHoje(Boolean(isReady && user) && !hojeState);
  const data = hojeState?.data ?? internal.data;
  const loading = hojeState?.loading ?? internal.loading;
  const [proxima, setProxima] = useState<ProximaAcao | null>(null);
  const [proximaLoading, setProximaLoading] = useState(false);

  const refreshHoje = () => {
    void (hojeState?.refetch ?? internal.refetch)?.();
  };

  const navigateToTab = (task: PendingTask) => {
    trackAgentEvent("nav_traditional_open", { tab: task.tab });
    setSearchParams({ tab: task.tab, ...task.searchParams });
  };

  const openTab = (tab: string, extra?: Record<string, string>) => {
    trackAgentEvent("nav_traditional_open", { tab });
    setSearchParams({ tab, ...extra });
  };

  const handleOpenUi = (target: AgentUiOpenTarget) => {
    switch (target) {
      case "dieta":
        openTab("diet");
        break;
      case "treino":
        openTab("workouts");
        break;
      case "treino_sessao":
        openTab("workouts", { session: "1" });
        break;
      case "meal_photo":
        openTab("diet", { meal_photo: "1" });
        break;
      case "checkin":
        openTab("checkin");
        break;
      case "coach_chat":
        openTab("coach", { coachView: "chat" });
        break;
      case "progress":
        openTab("progress");
        break;
      case "progress_photos":
        openTab("progress", { section: "photos" });
        break;
      case "reports":
        openTab("reports");
        break;
      case "videos":
        openTab("videos");
        break;
      case "profile":
        openTab("profile");
        break;
      case "blocked_financial":
        window.location.assign("/portal-aluno/blocked");
        break;
      case "blocked_operational":
        window.location.assign("/portal-aluno/access-blocked");
        break;
      default:
        break;
    }
  };

  const agent = useStudentAgent({
    onOpenUi: handleOpenUi,
    onAfterMutation: () => {
      refreshHoje();
      void loadProxima();
    },
    autoHydrate: true,
  });

  const loadProxima = async () => {
    if (!agent.enabled) return;
    setProximaLoading(true);
    const res = await apiClient.getProximaAcaoSafe();
    if (res.success && res.data) {
      setProxima(res.data as ProximaAcao);
    }
    setProximaLoading(false);
  };

  useEffect(() => {
    if (!isReady || !agent.enabled) return;
    void loadProxima();
    void agent.resumeIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/resume once per ready
  }, [isReady, agent.enabled]);

  const chips = useMemo(() => chipsForProximaAcao(proxima), [proxima]);

  const handleNextPrimary = () => {
    const type = proxima?.type;
    if (type === "next_meal" || type === "open_diet") {
      openTab("diet");
      return;
    }
    if (type === "today_workout") {
      openTab("workouts", { session: "1" });
      return;
    }
    if (type === "checkin") {
      openTab("checkin");
      return;
    }
    void agent.send("O que faço agora?");
  };

  if (!isReady) {
    return (
      <div className="min-w-0 space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const pendingTasks = mapPendenciasFromApi(data?.pendencias);
  const returnCountdown = mapRetornoFromApi(data?.retorno);
  const proximos = data?.proximos_eventos?.slice(0, 2) ?? [];

  // Fallback clássico se flag desligada
  if (!agent.enabled) {
    return (
      <div className="min-w-0 space-y-5 pb-2">
        <TodayHeroCard
          loading={loading}
          aluno={data?.aluno as { nome?: string; email?: string; objetivo?: string }}
          pendenciasCount={data?.contadores?.pendencias_total ?? pendingTasks.length}
        />
        <BehavioralInsightCard loading={loading} insight={data?.behavioral_insight} />
        {profileStatus && !profileStatus.is_complete && onOpenProfileWizard && (
          <ProfileCompletenessBanner status={profileStatus} onComplete={onOpenProfileWizard} />
        )}
        <ReturnCountdownBanner loading={loading} countdown={returnCountdown} />
        <CheckinStreakCard
          loading={loading}
          streak={data?.checkin_streak ?? null}
          checkinDue={data?.contadores?.checkin_due}
          onOpenCheckin={() => openTab("checkin")}
        />
        <StudentCoachCheckinFeedback compact limit={1} showHistoryAction className="shadow-sm" />
        <TodayPhotoCard
          loading={loading}
          fotos={data?.fotos_evolucao}
          onTirarFoto={() => openTab("checkin")}
          onVerGaleria={() => openTab("progress", { section: "photos" })}
        />
        <PendingTasksList loading={loading} tasks={pendingTasks} onNavigate={navigateToTab} />
        <TodayPlanCards
          loading={loading}
          treino={data?.treino ?? null}
          dieta={
            data?.dieta as {
              nome?: string | null;
              objetivo?: string | null;
              data_retorno?: string | null;
            } | null
          }
          dietaRotacao={data?.dieta_rotacao ?? null}
          onOpenTreino={() => openTab("workouts", { session: "1" })}
          onOpenDieta={() => openTab("diet")}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 pb-4">
      {/* —— TOPO: cards visíveis (navegação tradicional permanece descoberta) —— */}
      <TodayHeroCard
        loading={loading}
        aluno={data?.aluno as { nome?: string; email?: string; objetivo?: string }}
        pendenciasCount={data?.contadores?.pendencias_total ?? pendingTasks.length}
      />

      {profileStatus && !profileStatus.is_complete && onOpenProfileWizard && (
        <ProfileCompletenessBanner status={profileStatus} onComplete={onOpenProfileWizard} />
      )}

      <ReturnCountdownBanner loading={loading} countdown={returnCountdown} />

      <TodayPlanCards
        loading={loading}
        treino={data?.treino ?? null}
        dieta={
          data?.dieta as {
            nome?: string | null;
            objetivo?: string | null;
            data_retorno?: string | null;
          } | null
        }
        dietaRotacao={data?.dieta_rotacao ?? null}
        onOpenTreino={() => openTab("workouts", { session: "1" })}
        onOpenDieta={() => openTab("diet")}
      />

      <TodayContextStrip
        loading={loading}
        data={data}
        onOpenDiet={() => openTab("diet")}
        onOpenWorkout={() => openTab("workouts", { session: "1" })}
        onOpenPending={() => openTab("checkin")}
      />

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <CheckinStreakCard
          loading={loading}
          streak={data?.checkin_streak ?? null}
          checkinDue={data?.contadores?.checkin_due}
          onOpenCheckin={() => openTab("checkin")}
        />
        <TodayPhotoCard
          loading={loading}
          fotos={data?.fotos_evolucao}
          onTirarFoto={() => openTab("checkin")}
          onVerGaleria={() => openTab("progress", { section: "photos" })}
        />
      </div>

      <NextActionHero
        loading={loading || proximaLoading}
        acao={proxima}
        onPrimary={handleNextPrimary}
        onAskAgent={() => void agent.send("O que faço agora?")}
      />

      {/* —— CHAT: maior parte da interface —— */}
      <section
        className={cn(
          "flex min-h-[min(62dvh,42rem)] flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 sm:p-4",
        )}
        aria-label="Conversa com o agente"
      >
        <div className="shrink-0">
          <p className="text-sm font-semibold text-foreground">O teu agente</p>
          <p className="text-xs text-muted-foreground">Contexto do plano ligado em tempo real</p>
        </div>

        <div className="min-h-0 flex-1">
          <AgentThread
            thread={agent.thread}
            status={agent.status}
            error={agent.error}
            chips={chips}
            onSend={(t) => void agent.send(t)}
            onCardAction={(a) => void agent.runCardAction(a)}
          />
        </div>

        <div
          className={cn(
            "sticky bottom-0 z-10 -mx-1 shrink-0 px-1 pt-2",
            "bg-gradient-to-t from-background via-background/95 to-transparent pb-1",
          )}
        >
          <AgentComposer
            status={agent.status}
            onSend={(t) => void agent.send(t)}
            autoFocus={false}
            placeholder="Digite ou pergunta o que fazer agora…"
          />
        </div>
      </section>

      <BehavioralInsightCard loading={loading} insight={data?.behavioral_insight} />
      <StudentCoachCheckinFeedback compact limit={1} showHistoryAction className="shadow-sm" />
      <PendingTasksList loading={loading} tasks={pendingTasks} onNavigate={navigateToTab} />

      {!loading && proximos.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-primary" />
            Próximo na agenda
          </p>
          <ul className="space-y-2">
            {proximos.map((ev) => (
              <li key={ev.id} className="text-sm">
                <span className="font-medium text-foreground">{ev.titulo || "Evento"}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {new Date(ev.data_evento).toLocaleDateString("pt-BR")}
                  {ev.hora_evento ? ` às ${ev.hora_evento}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-2"
          onClick={() => {
            trackAgentEvent("nav_traditional_open", { via: "explore" });
            onExplorePlatform?.();
          }}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden />
          Explorar plataforma
        </Button>
      </div>

      <WeightLogDialog
        open={agent.weightDialogOpen}
        onOpenChange={agent.setWeightDialogOpen}
        onSubmit={(kg) => void agent.submitWeight(kg)}
        busy={agent.status === "sending"}
      />
    </div>
  );
};

export default StudentTodayView;
