import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { AlunoHojeResponse } from "@/types/aluno-hoje";

export function useAlunoHoje(enabled: boolean) {
  const [data, setData] = useState<AlunoHojeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await apiClient.getHojeSafe();
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setData(null);
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const coachUnreadTotal =
    (data?.contadores?.unread_chat ?? 0) + (data?.contadores?.unread_avisos ?? 0);

  return { data, loading, refetch, coachUnreadTotal };
}
