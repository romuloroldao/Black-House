/** Estado de viewport baseado em transform (scale + translate). */
export type ViewportState = {
  scale: number;
  x: number;
  y: number;
};

export type CompareMode = 'sideBySide' | 'split' | 'flash';

export type RegionPreset = 'fullBody' | 'torso' | 'abdomen' | 'back' | 'legs';

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const SCALE_STEP = 0.15;

/** Heurística de enquadramento útil (corpo tipicamente no terço superior-central). */
export function heuristicUsefulCenter(): ViewportState {
  return { scale: 1.08, x: 0, y: -4 };
}

/**
 * Presets regionais — offsets percentuais do contentor.
 * Arquitectura preparada para substituir por keypoints MediaPipe/MoveNet.
 */
export function viewportForRegion(region: RegionPreset): ViewportState {
  switch (region) {
    case 'torso':
      return { scale: 1.7, x: 0, y: -12 };
    case 'abdomen':
      return { scale: 2.2, x: 0, y: 6 };
    case 'back':
      return { scale: 1.65, x: 0, y: -8 };
    case 'legs':
      return { scale: 1.9, x: 0, y: 28 };
    case 'fullBody':
    default:
      return heuristicUsefulCenter();
  }
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function clampPan(value: number, scale: number): number {
  const limit = 40 + (scale - 1) * 55;
  return Math.min(limit, Math.max(-limit, value));
}
