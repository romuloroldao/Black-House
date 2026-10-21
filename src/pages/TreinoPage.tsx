import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import WorkoutForm from "@/components/WorkoutForm";
import { apiClient } from "@/lib/api-client";
import { mapTreinoApiToWorkoutForm } from "@/lib/treino-form-mapper";
import { Skeleton } from "@/components/ui/skeleton";

export default function TreinoPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("treinos");
  const [workout, setWorkout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backTo = searchParams.get("from") || "/";
  const atribuicaoId = searchParams.get("atribuicao") || null;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const endpoint = atribuicaoId
        ? `/api/alunos-treinos/${atribuicaoId}/treino-resolvido`
        : `/api/treinos/${id}${atribuicaoId ? `?atribuicao_id=${atribuicaoId}` : ""}`;

      const result = await apiClient.requestSafe<any>(endpoint);
      if (cancelled) return;
      if (!result.success || !result.data) {
        setError(result.error || "Treino não encontrado");
        setWorkout(null);
      } else {
        setWorkout(mapTreinoApiToWorkoutForm(result.data));
        setError(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, atribuicaoId]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab !== "treinos") navigate("/");
  };

  const isStudentAssignment = Boolean(atribuicaoId || workout?.atribuicaoId);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 text-destructive">{error}</div>
        ) : (
          <WorkoutForm
            workout={workout}
            studentCopy={isStudentAssignment}
            atribuicaoId={atribuicaoId || workout?.atribuicaoId || undefined}
            onBack={() => navigate(backTo)}
            onSave={() => navigate(backTo)}
          />
        )}
      </main>
    </div>
  );
}
