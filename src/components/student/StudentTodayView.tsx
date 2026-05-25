import { useSearchParams } from "react-router-dom";
import { Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import { useAlunoHoje } from "@/hooks/useAlunoHoje";
import type { AlunoHojeResponse } from "@/types/aluno-hoje";
import {
  mapPendenciasFromApi,
  mapRetornoFromApi,
  type PendingTask,
} from "@/lib/student-portal-utils";
import ReturnCountdownBanner from "@/components/student/ReturnCountdownBanner";
import PendingTasksList from "@/components/student/PendingTasksList";
import TodayHeroCard from "@/components/student/today/TodayHeroCard";
import TodayPlanCards from "@/components/student/today/TodayPlanCards";
import CheckinStreakCard from "@/components/student/today/CheckinStreakCard";

type StudentTodayViewProps = {
  /** Evita segunda chamada quando o portal já carregou /api/alunos/me/hoje */
  hojeState?: {
    data: AlunoHojeResponse | null;
    loading: boolean;
  };
};

const StudentTodayView = ({ hojeState }: StudentTodayViewProps) => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [, setSearchParams] = useSearchParams();
  const internal = useAlunoHoje(Boolean(isReady && user) && !hojeState);
  const data = hojeState?.data ?? internal.data;
  const loading = hojeState?.loading ?? internal.loading;

  const navigateToTab = (task: PendingTask) => {
    setSearchParams({ tab: task.tab, ...task.searchParams });
  };

  const openTab = (tab: string, extra?: Record<string, string>) =>
    setSearchParams({ tab, ...extra });

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

  return (
    <div className="min-w-0 space-y-5 pb-2">
      <TodayHeroCard
        loading={loading}
        aluno={data?.aluno as { nome?: string; email?: string; objetivo?: string }}
        pendenciasCount={data?.contadores?.pendencias_total ?? pendingTasks.length}
      />

      <ReturnCountdownBanner loading={loading} countdown={returnCountdown} />

      <CheckinStreakCard
        loading={loading}
        streak={data?.checkin_streak ?? null}
        checkinDue={data?.contadores?.checkin_due}
        onOpenCheckin={() => openTab("checkin")}
      />

      <PendingTasksList
        loading={loading}
        tasks={pendingTasks}
        onNavigate={navigateToTab}
      />

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
    </div>
  );
};

export default StudentTodayView;
