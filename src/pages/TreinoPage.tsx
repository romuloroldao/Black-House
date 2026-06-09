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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const result = await apiClient.requestSafe<any>(`/api/treinos/${id}`);
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
  }, [id]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab !== "treinos") navigate("/");
  };

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
            studentCopy={Boolean(workout?.alunoId)}
            onBack={() => navigate(backTo)}
            onSave={() => navigate(backTo)}
          />
        )}
      </main>
    </div>
  );
}
