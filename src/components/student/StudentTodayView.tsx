import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, ChevronDown, LayoutGrid, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";
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
import TodayContextStrip from "@/components/student/agent/TodayContextStrip";
import { askPromptForAcao, type ProximaAcao } from "@/components/student/agent/NextActionHero";
import WeightLogDialog from "@/components/student/agent/WeightLogDialog";
import { chipsForProximaAcao } from "@/components/student/agent/agent-chips";
import { useStudentAgent, type AgentUiOpenTarget } from "@/hooks/useStudentAgent";

const MAIS_DO_DIA_OPEN_KEY = "bh-student-mais-do-dia-open";

function readMaisDoDiaOpen(): boolean {
  const raw = safeGetItem(MAIS_DO_DIA_OPEN_KEY);
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return true; // padrão: aberto (cards no topo)
}

type StudentTodayViewProps = {
  hojeState?: {
    data: AlunoHojeResponse | null;
    loading: boolean;
    refetch?: () => void | Promise<void>;
  };
  profileStatus?: ProfileCompletenessStatus | null;
  onOpenProfileWizard?: () => void;
  onExplorePlatform?: () => void;
};

function nextActionLabel(acao: ProximaAcao | null): string | null {
  if (!acao?.type || acao.type === "idle") return null;
  const title = acao.title?.trim();
  const desc = acao.description?.trim();
  if (title && desc) return `${title}: ${desc}`;
  return title || desc || null;
}

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
  const [maisDoDiaOpen, setMaisDoDiaOpen] = useState(() =>
    typeof window !== "undefined" ? readMaisDoDiaOpen() : true,
  );

  const setMaisDoDiaOpenPersist = (open: boolean) => {
    setMaisDoDiaOpen(open);
    safeSetItem(MAIS_DO_DIA_OPEN_KEY, open ? "1" : "0");
    trackAgentEvent("mais_do_dia_toggle", { open });
  };

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
  const nextLabel = nextActionLabel(proxima);

  if (!isReady) {
    return (
      <div className="min-w-0 space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[min(52dvh,28rem)] w-full rounded-2xl" />
      </div>
    );
  }

  const pendingTasks = mapPendenciasFromApi(data?.pendencias);
  const returnCountdown = mapRetornoFromApi(data?.retorno);
  const proximos = data?.proximos_eventos?.slice(0, 2) ?? [];

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
      <TodayHeroCard
        compact
        loading={loading}
        aluno={data?.aluno as { nome?: string; email?: string; objetivo?: string }}
        pendenciasCount={data?.contadores?.pendencias_total ?? pendingTasks.length}
      />

      {profileStatus && !profileStatus.is_complete && onOpenProfileWizard && (
        <ProfileCompletenessBanner
          compact
          status={profileStatus}
          onComplete={onOpenProfileWizard}
        />
      )}

      {!loading && returnCountdown && (
        <ReturnCountdownBanner loading={false} countdown={returnCountdown} />
      )}

      {/* —— TOPO: cards do dia (acordeão — pode esconder para dar espaço ao agente) —— */}
      <Collapsible
        open={maisDoDiaOpen}
        onOpenChange={setMaisDoDiaOpenPersist}
        className="rounded-xl border border-border/60 bg-card/40"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="flex h-auto min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/40"
            aria-expanded={maisDoDiaOpen}
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Mais do dia</span>
              <span className="block truncate text-xs text-muted-foreground">
                {maisDoDiaOpen
                  ? "Toque para esconder e ganhar espaço no assistente"
                  : pendingTasks.length > 0
                    ? `${pendingTasks.length} pendência${pendingTasks.length !== 1 ? "s" : ""} · toque para ver os cards`
                    : "Dieta, treino, streak e fotos · toque para expandir"}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                maisDoDiaOpen && "rotate-180",
              )}
              aria-hidden
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            "space-y-3 overflow-hidden border-t border-border/40 px-3 pb-3 pt-3",
            "data-[state=closed]:hidden",
          )}
        >
          <TodayContextStrip
            loading={loading}
            data={data}
            onOpenDiet={() => {
              trackAgentEvent("agent_first_touch", { via: "strip_diet" });
              openTab("diet");
            }}
            onOpenWorkout={() => {
              trackAgentEvent("agent_first_touch", { via: "strip_workout" });
              openTab("workouts", { session: "1" });
            }}
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

          <BehavioralInsightCard loading={loading} insight={data?.behavioral_insight} />
          <StudentCoachCheckinFeedback compact limit={1} showHistoryAction className="shadow-sm" />

          {pendingTasks.length > 0 && (
            <PendingTasksList loading={loading} tasks={pendingTasks} onNavigate={navigateToTab} />
          )}

          {!loading && proximos.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-primary" aria-hidden />
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
        </CollapsibleContent>
      </Collapsible>

      {/* —— ABAIXO: assistente (cresce quando Mais do dia está fechado) —— */}
      <section
        className={cn(
          "flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card",
          "transition-[max-height] duration-200 ease-out motion-reduce:transition-none",
          maisDoDiaOpen
            ? "max-h-[min(48dvh,26rem)]"
            : "max-h-[min(72dvh,38rem)]",
        )}
        aria-label="Conversa com o agente"
      >
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5 sm:px-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              Assistente
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {proximaLoading ? (
                <Skeleton className="mt-1 inline-block h-3 w-36" />
              ) : nextLabel ? (
                <>Agora: {nextLabel}</>
              ) : (
                "Pergunte quando precisar de ajuda"
              )}
            </p>
          </div>
          {!proximaLoading && nextLabel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2 text-xs"
              onClick={() => {
                trackAgentEvent("agent_first_touch", { via: "next_inline" });
                void agent.send(askPromptForAcao(proxima?.type));
              }}
            >
              Perguntar
            </Button>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
          <AgentThread
            thread={agent.thread}
            status={agent.status}
            error={agent.error}
            chips={chips}
            onSend={(t) => {
              trackAgentEvent("agent_first_touch", { via: "chip_or_thread" });
              void agent.send(t);
            }}
            onCardAction={(a) => void agent.runCardAction(a)}
            emptyHint={
              maisDoDiaOpen
                ? "Expanda ou feche «Mais do dia» acima · ou pergunte aqui"
                : "Mais espaço para conversar — digite ou use um atalho"
            }
          />
        </div>

        <div className="shrink-0 border-t border-border/60 bg-card px-3 py-2.5 sm:px-4">
          <AgentComposer
            status={agent.status}
            onSend={(t) => {
              trackAgentEvent("agent_first_touch", { via: "composer" });
              void agent.send(t);
            }}
            autoFocus={false}
            placeholder="O que você precisa agora?"
          />
        </div>
      </section>

      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full gap-2 text-sm text-muted-foreground"
        onClick={() => {
          trackAgentEvent("nav_traditional_open", { via: "explore" });
          onExplorePlatform?.();
        }}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
        Navegar pela plataforma
      </Button>

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
