import { useEffect, useMemo } from 'react';
import type { EvolutionPhoto } from '@/lib/evolution-timeline';

const POLL_MS = 15_000;

/**
 * Substitui usePhotoPoseBackfill: o job em background classifica fotos.
 * Mostra estado pendente e faz polling leve para refrescar a lista.
 */
export function usePhotoPosePendingStatus(
  photos: EvolutionPhoto[],
  onRefresh?: () => void,
  enabled = true,
) {
  const pendingCount = useMemo(
    () =>
      photos.filter(
        (p) => p.pose_analysis_status === 'pending' || p.pose_analysis_status === 'processing',
      ).length,
    [photos],
  );

  useEffect(() => {
    if (!enabled || pendingCount === 0 || !onRefresh) return;
    const timer = setInterval(() => onRefresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, pendingCount, onRefresh]);

  return {
    isAnalyzing: pendingCount > 0,
    pendingCount,
    total: photos.length,
  };
}

/** @deprecated Usar usePhotoPosePendingStatus — classificação é feita no servidor. */
export function usePhotoPoseBackfill(
  photos: EvolutionPhoto[],
  onRefresh?: () => void,
  enabled = true,
) {
  const { isAnalyzing, pendingCount } = usePhotoPosePendingStatus(photos, onRefresh, enabled);
  return {
    backfilling: isAnalyzing,
    progress: { done: 0, total: pendingCount },
  };
}
