import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Camera,
  Activity,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDelete, useConfirm } from "@/contexts/ConfirmContext";
import StudentProgressDashboard from "./StudentProgressDashboard";
import WeightTimelineChart from "@/components/coach/WeightTimelineChart";
import type { BodyMetricsResponse } from "@/types/profile-completeness";
import CheckinStreakCard from "@/components/student/today/CheckinStreakCard";
import { useAlunoHoje } from "@/hooks/useAlunoHoje";
import { useSearchParams } from "react-router-dom";
import EvolutionTimelineExperience from "@/components/student/progress/evolution/EvolutionTimelineExperience";
import type { EvolutionPhoto } from "@/lib/evolution-timeline";

type FotoAluno = EvolutionPhoto;

const StudentProgressView = () => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: hoje, loading: hojeLoading } = useAlunoHoje(Boolean(user));
  const [fotos, setFotos] = useState<FotoAluno[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricsResponse | null>(null);
  const [bodyMetricsLoading, setBodyMetricsLoading] = useState(false);

  const sectionParam = searchParams.get("section");
  const focusFotos = searchParams.get("focus") === "fotos";
  const legacyUploadParam = searchParams.get("upload") === "1";

  const defaultTab = useMemo(() => {
    if (sectionParam === "metrics") return "metrics";
    if (sectionParam === "photos" || focusFotos) return "photos";
    if (!dataLoaded) return "photos";
    return fotos.length === 0 ? "photos" : "metrics";
  }, [sectionParam, focusFotos, dataLoaded, fotos.length]);

  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (user) loadProgressData();
  }, [user]);

  useEffect(() => {
    if (!legacyUploadParam) return;
    setSearchParams({ tab: "checkin" }, { replace: true });
  }, [legacyUploadParam, setSearchParams]);

  const loadProgressData = async () => {
    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (aluno) {
      const fotosResult = await apiClient.requestSafe<FotoAluno[]>(
        `/api/fotos-alunos?aluno_id=${aluno.id}`,
      );
      const fotosData =
        fotosResult.success && Array.isArray(fotosResult.data) ? fotosResult.data : [];
      const ordenadas = fotosData.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
      setFotos(ordenadas);

      setBodyMetricsLoading(true);
      const metricsResult = await apiClient.requestSafe<BodyMetricsResponse>(
        `/api/alunos/${aluno.id}/body-metrics`,
      );
      setBodyMetrics(metricsResult.success ? metricsResult.data ?? null : null);
      setBodyMetricsLoading(false);
    } else {
      setBodyMetrics(null);
      setBodyMetricsLoading(false);
    }
    setDataLoaded(true);
  };

  const handleDeletePhoto = async (foto: FotoAluno) => {
    if (
      !(await confirmDelete(confirm, "Esta foto de evolução será removida permanentemente."))
    ) {
      return;
    }

    const deleteResult = await apiClient.requestSafe(`/api/fotos-alunos/${foto.id}`, {
      method: "DELETE",
    });
    if (!deleteResult.success) {
      toast.error(deleteResult.error || "Erro ao excluir foto");
      return;
    }

    toast.success("Foto excluída");
    loadProgressData();
  };

  const openCheckin = () => setSearchParams({ tab: "checkin" });
  const openMetrics = () => {
    setActiveTab("metrics");
    const next = new URLSearchParams(searchParams);
    next.set("tab", "progress");
    next.set("section", "metrics");
    setSearchParams(next);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-3xl">Fotos e evolução</h1>
        <p className="mt-1 text-muted-foreground">
          Acompanhe o histórico enviado no check-in semanal e as métricas
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 w-full">
        <TabsList className="grid h-auto w-full min-w-0 max-w-full grid-cols-2 gap-1 sm:max-w-md">
          <TabsTrigger value="photos" className="flex items-center gap-2 min-h-11">
            <Camera className="h-4 w-4" />
            Fotos
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2 min-h-11">
            <Activity className="h-4 w-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-6 space-y-6">
          <EvolutionTimelineExperience
            photos={fotos}
            onDeletePhoto={handleDeletePhoto}
            onOpenCheckin={openCheckin}
          />

          <button
            type="button"
            onClick={openMetrics}
            className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40"
          >
            <span className="flex items-center gap-2 font-medium">
              <BarChart3 className="h-4 w-4 text-primary" />
              Ver métricas semanais
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6 space-y-6">
          <CheckinStreakCard
            loading={hojeLoading}
            streak={hoje?.checkin_streak ?? null}
            checkinDue={hoje?.contadores?.checkin_due}
            onOpenCheckin={openCheckin}
          />
          <WeightTimelineChart
            historico={bodyMetrics?.peso_historico}
            pesoAtual={bodyMetrics?.peso_kg}
            loading={bodyMetricsLoading}
            compact
          />
          <StudentProgressDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentProgressView;
