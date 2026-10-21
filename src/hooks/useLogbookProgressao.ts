import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  LoadProgressionPeriodKey,
  LoadProgressionResponse,
} from "@/types/logbook-progressao";

type UseLogbookProgressaoOpts = {
  alunoId?: string | null;
  period?: LoadProgressionPeriodKey;
  enabled?: boolean;
};

export function useLogbookProgressao({
  alunoId,
  period = "30",
  enabled = true,
}: UseLogbookProgressaoOpts = {}) {
  const [data, setData] = useState<LoadProgressionResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled && alunoId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !alunoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await apiClient.getLogbookProgressaoSafe({
      alunoId,
      period,
    });
    if (!result.success) {
      setData(null);
      setError(result.error || "Não foi possível carregar a progressão de cargas.");
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  }, [alunoId, period, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
