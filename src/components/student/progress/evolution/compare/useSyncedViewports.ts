import { useCallback, useRef, useState } from 'react';
import {
  clampPan,
  clampScale,
  heuristicUsefulCenter,
  SCALE_STEP,
  viewportForRegion,
  type RegionPreset,
  type ViewportState,
} from './viewport-types';

type Side = 'before' | 'after';

function applyZoom(state: ViewportState, nextScale: number): ViewportState {
  const scale = clampScale(nextScale);
  return {
    scale,
    x: clampPan(state.x, scale),
    y: clampPan(state.y, scale),
  };
}

function applyPan(state: ViewportState, dx: number, dy: number): ViewportState {
  return {
    scale: state.scale,
    x: clampPan(state.x + dx, state.scale),
    y: clampPan(state.y + dy, state.scale),
  };
}

/**
 * Controla zoom/pan de Antes/Depois com sincronização opcional.
 * Troca de check-in preserva o viewport (não reinicia alinhamento).
 */
export function useSyncedViewports() {
  const initial = heuristicUsefulCenter();
  const [before, setBefore] = useState<ViewportState>(initial);
  const [after, setAfter] = useState<ViewportState>(initial);
  // Por defeito independente: cada lado alinha-se sozinho (alto impacto visual).
  const [synced, setSynced] = useState(false);
  const beforeRef = useRef(before);
  const afterRef = useRef(after);
  beforeRef.current = before;
  afterRef.current = after;

  const setBoth = useCallback((next: ViewportState) => {
    setBefore(next);
    setAfter(next);
  }, []);

  /** Zoom é sempre por lado — sync só afecta pan. */
  const zoom = useCallback((side: Side, delta: number) => {
    if (side === 'before') {
      setBefore((s) => applyZoom(s, s.scale + delta));
    } else {
      setAfter((s) => applyZoom(s, s.scale + delta));
    }
  }, []);

  const zoomTo = useCallback((side: Side, scale: number) => {
    if (side === 'before') {
      setBefore((s) => applyZoom(s, scale));
    } else {
      setAfter((s) => applyZoom(s, scale));
    }
  }, []);

  const pan = useCallback(
    (side: Side, dxPct: number, dyPct: number) => {
      if (synced) {
        const base = side === 'before' ? beforeRef.current : afterRef.current;
        setBoth(applyPan(base, dxPct, dyPct));
        return;
      }
      if (side === 'before') {
        setBefore((s) => applyPan(s, dxPct, dyPct));
      } else {
        setAfter((s) => applyPan(s, dxPct, dyPct));
      }
    },
    [setBoth, synced],
  );

  const applyRegion = useCallback(
    (region: RegionPreset) => {
      setBoth(viewportForRegion(region));
    },
    [setBoth],
  );

  const reset = useCallback(() => {
    setBoth(heuristicUsefulCenter());
  }, [setBoth]);

  const zoomIn = useCallback((side: Side) => zoom(side, SCALE_STEP), [zoom]);
  const zoomOut = useCallback((side: Side) => zoom(side, -SCALE_STEP), [zoom]);

  return {
    before,
    after,
    synced,
    setSynced,
    zoom,
    zoomTo,
    zoomIn,
    zoomOut,
    pan,
    applyRegion,
    reset,
  };
}
