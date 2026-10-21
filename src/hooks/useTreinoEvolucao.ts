import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { WorkoutEvolutionResponse } from "@/types/treino-evolucao";

type UseTreinoEvolucaoOpts = {
  alunoId?: string | null;
  asOf?: string;
  enabled?: boolean;
};

export function useTreinoEvolucao({
  alunoId,
  asOf,
  enabled = true,
}: UseTreinoEvolucaoOpts = {}) {
  const [data, setData] = useState<WorkoutEvolutionResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    const result = await apiClient.getTreinoEvolucaoSafe({
      alunoId: alunoId || undefined,
      as_of: asOf,
    });
    if (!result.success) {
      setData(null);
      setError(result.error || "Não foi possível carregar a evolução do treino.");
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  }, [alunoId, asOf, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
