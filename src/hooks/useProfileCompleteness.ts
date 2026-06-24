import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import type { ProfileCompletenessStatus } from "@/types/profile-completeness";

export function useProfileCompleteness(options?: { incrementLogin?: boolean }) {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [status, setStatus] = useState<ProfileCompletenessStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user || user.role !== "aluno") {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await apiClient.requestSafe<ProfileCompletenessStatus>(
      "/api/alunos/me/profile-status",
    );
    if (result.success && result.data) {
      setStatus(result.data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isReady || !user || user.role !== "aluno") {
      setLoading(false);
      return;
    }
    void refetch();
  }, [isReady, user?.id, user?.role, refetch]);

  const blocksActions =
    Boolean(status?.hard_gate_active) && !status?.is_complete;

  return {
    status,
    loading,
    refetch,
    blocksActions,
    incrementLogin: options?.incrementLogin,
  };
}
