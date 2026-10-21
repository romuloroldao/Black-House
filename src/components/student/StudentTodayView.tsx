import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Calendar,
  Camera,
  ChevronDown,
  Dumbbell,
  LayoutGrid,
  Replace,
  Scale,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";
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
import ColemanHeader from "@/components/student/agent/ColemanHeader";
import TodayContextStrip from "@/components/student/agent/TodayContextStrip";
import {
  composeHomeOpening,
  markColemanMet,
  openingStorageKey,
} from "@/components/student/agent/compose-home-opening";
import type { ProximaAcao } from "@/components/student/agent/NextActionHero";
import WeightLogDialog from "@/components/student/agent/WeightLogDialog";
import { chipsForHojeContext } from "@/components/student/agent/agent-chips";
import { useStudentAgent, type AgentUiOpenTarget } from "@/hooks/useStudentAgent";

const CHIP_ICONS: Record<string, LucideIcon> = {
  "Minha dieta": Utensils,
  "Meu treino": Dumbbell,
  "Próxima refeição": Utensils,
  "Trocar alimento": Replace,
  "Enviar foto": Camera,
  "Registrar peso": Scale,
  "Iniciar treino": Dumbbell,
  "Analisar refeição": Utensils,
  Recuperação: Sparkles,
  "Próximo treino": Dumbbell,
  "Falar com coach": Sparkles,
  "O que faço agora?": Sparkles,
  Evolução: Camera,
  Concluí: Sparkles,
  Restaurante: Utensils,
  "Como estou?": Sparkles,
};

const MAIS_DO_DIA_OPEN_KEY = "bh-student-mais-do-dia-open";

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function readMaisDoDiaOpen(): boolean {
  const raw = safeGetItem(MAIS_DO_DIA_OPEN_KEY);
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  // Mobile: fechado por defeito para o chat ganhar altura; desktop: aberto
  return !isMobileViewport();
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

function maisDoDiaTriggerLabel(data: AlunoHojeResponse | null, pendenciasCount: number): string {
  const dieta =
    data?.dieta_rotacao?.today_label ||
    (data?.dieta as { nome?: string } | null)?.nome ||
    "dieta";
  const treino = data?.treino?.descanso_hoje
    ? "descanso"
    : data?.treino?.detalhe?.nome || "treino";
  const pend =
    pendenciasCount > 0
      ? `${pendenciasCount} pendência${pendenciasCount !== 1 ? "s" : ""}`
      : "em dia";
  return `Hoje · ${dieta} · ${treino} · ${pend}`;
}

const StudentTodayView = ({
  hojeState,
  profileStatus,
  onOpenProfileWizard,
  onExplorePlatform,
}: StudentTodayViewProps) => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const internal = useAlunoHoje(Boolean(isReady && user) && !hojeState);
  const data = hojeState?.data ?? internal.data;
  const loading = hojeState?.loading ?? internal.loading;
  const [proxima, setProxima] = useState<ProximaAcao | null>(null);
  const [proximaReady, setProximaReady] = useState(false);
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
      case "education":
        openTab("education");
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
    const res = await apiClient.getProximaAcaoSafe();
    if (res.success && res.data) {
      setProxima(res.data as ProximaAcao);
    }
    setProximaReady(true);
  };

  useEffect(() => {
    if (!isReady || !agent.enabled) return;
    void loadProxima();
    void agent.resumeIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/resume once per ready
  }, [isReady, agent.enabled]);

  useEffect(() => {
    if (!agent.enabled || !agent.hydrated || loading || !proximaReady) return;
    if (agent.thread.length > 0) return;
    const text = composeHomeOpening(data, proxima);
    agent.injectLocalOpening(text, openingStorageKey());
    markColemanMet();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inject once when context ready
  }, [
    agent.enabled,
    agent.hydrated,
    agent.thread.length,
    loading,
    proximaReady,
    data,
    proxima,
  ]);

  const chips = useMemo(
    () => chipsForHojeContext({ proxima, hoje: data }),
    [proxima, data],
  );

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
              refeicao_livre_ativa?: boolean | null;
              refeicao_livre_content_id?: string | null;
            } | null
          }
          dietaRotacao={data?.dieta_rotacao ?? null}
          onOpenTreino={() => openTab("workouts", { session: "1" })}
          onOpenDieta={() => openTab("diet")}
          onOpenGuiaEducativo={(contentId) => navigate(`/portal-aluno/guia/${contentId}`)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-1.5 pb-1">
      <div className="shrink-0 space-y-1.5">
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

        {/* Painel opcional — fechado por defeito; chat maximizado */}
        <Collapsible
          open={maisDoDiaOpen}
          onOpenChange={setMaisDoDiaOpenPersist}
          className="rounded-lg border border-border/40 bg-card/20"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="flex h-8 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left hover:bg-muted/40"
              aria-expanded={maisDoDiaOpen}
              aria-label="Mais do dia"
            >
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Mais do dia</span>
                <span aria-hidden> · </span>
                {maisDoDiaTriggerLabel(
                  data,
                  data?.contadores?.pendencias_total ?? pendingTasks.length,
                )}
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  maisDoDiaOpen && "rotate-180",
                )}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent
            className={cn(
              "max-h-[min(36dvh,18rem)] space-y-3 overflow-y-auto overscroll-contain border-t border-border/40 px-3 pb-3 pt-3",
              "data-[state=closed]:hidden",
              "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:duration-200",
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
      </div>

      {/* —— Coleman: conversa como centro —— */}
      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
          "max-md:rounded-none max-md:border-0",
          "md:rounded-2xl md:border md:border-border/50",
        )}
        aria-label="Conversa com o Coleman"
      >
        <ColemanHeader />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
          <AgentThread
            thread={agent.thread}
            status={agent.status}
            error={agent.error}
            showChips={false}
            onCardAction={(a) => void agent.runCardAction(a)}
            emptyHint="O Coleman está preparando o contexto do dia…"
          />
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-border/50 bg-card px-3 py-2 sm:px-4">
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Sugestões do Coleman"
          >
            {chips.map((chip) => {
              const Icon = CHIP_ICONS[chip.label] || Sparkles;
              return (
                <Button
                  key={chip.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 shrink-0 gap-1.5 rounded-full border border-border/50 px-3 text-xs font-normal text-muted-foreground",
                    "hover:border-primary/30 hover:text-foreground",
                    "motion-safe:active:scale-[0.98] motion-safe:transition-transform motion-safe:duration-100",
                  )}
                  disabled={agent.status === "sending"}
                  onClick={() => {
                    trackAgentEvent("agent_first_touch", { via: "chip" });
                    void agent.send(chip.text);
                  }}
                >
                  <Icon className="h-3.5 w-3.5 text-primary/80" aria-hidden />
                  <span className="whitespace-nowrap">{chip.label}</span>
                </Button>
              );
            })}
          </div>
          <AgentComposer
            status={agent.status}
            onSend={(t) => {
              trackAgentEvent("agent_first_touch", { via: "composer" });
              void agent.send(t);
            }}
            autoFocus={false}
            placeholder="Fale com o Coleman..."
          />
        </div>
      </section>

      {/* Desktop: atalho de navegação (mobile usa Menu + bottom nav) */}
      <div className="hidden shrink-0 md:block">
        <Button
          type="button"
          variant="ghost"
          className="h-9 w-full gap-2 text-sm text-muted-foreground"
          onClick={() => {
            onExplorePlatform?.();
          }}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden />
          Navegar pela plataforma
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
