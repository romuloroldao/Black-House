import { useCallback, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tEvolution } from '@/i18n/evolution-photos';
import { AlignmentGuides } from './AlignmentGuides';
import type { ViewportState } from './viewport-types';

type Side = 'before' | 'after';

type Props = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  beforeViewport: ViewportState;
  afterViewport: ViewportState;
  showGuides: boolean;
  synced: boolean;
  onPan: (side: Side, dxPct: number, dyPct: number) => void;
  onZoom: (side: Side, delta: number) => void;
  onZoomIn: (side: Side) => void;
  onZoomOut: (side: Side) => void;
};

/**
 * Modo Deslizante:
 * - Área da imagem → pan/zoom (alinhar fotos)
 * - Máscara só se move pelo slider em baixo OU ao arrastar exactamente a linha divisória
 */
export function ComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  beforeViewport,
  afterViewport,
  showGuides,
  synced,
  onPan,
  onZoom,
  onZoomIn,
  onZoomOut,
}: Props) {
  const [value, setValue] = useState(50);
  const trackRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    side: Side;
  } | null>(null);
  const maskRef = useRef<{ pointerId: number } | null>(null);
  const pinchRef = useRef<{ distance: number; side: Side } | null>(null);

  const setMaskFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    setValue(Math.min(100, Math.max(0, pct)));
  }, []);

  const sideAtClientX = useCallback(
    (clientX: number): Side => {
      const el = trackRef.current;
      if (!el) return 'before';
      const rect = el.getBoundingClientRect();
      const pct = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
      return pct <= value ? 'before' : 'after';
    },
    [value],
  );

  const imgStyle = (vp: ViewportState): React.CSSProperties => ({
    transform: `translate(calc(-50% + ${vp.x}%), calc(-50% + ${vp.y}%)) scale(${vp.scale})`,
    transformOrigin: 'center center',
    willChange: 'transform',
  });

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || pinchRef.current || maskRef.current) return;
      const el = trackRef.current;
      if (!el) return;
      el.setPointerCapture?.(e.pointerId);
      panRef.current = {
        pointerId: e.pointerId,
        lastX: e.clientX,
        lastY: e.clientY,
        side: sideAtClientX(e.clientX),
      };
    },
    [sideAtClientX],
  );

  const onPanPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pinchRef.current || maskRef.current) return;
      const drag = panRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dxPct = ((e.clientX - drag.lastX) / Math.max(rect.width, 1)) * 100;
      const dyPct = ((e.clientY - drag.lastY) / Math.max(rect.height, 1)) * 100;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      onPan(synced ? 'before' : drag.side, dxPct, dyPct);
    },
    [onPan, synced],
  );

  const endPan = useCallback((e: React.PointerEvent) => {
    if (panRef.current?.pointerId === e.pointerId) panRef.current = null;
  }, []);

  const onMaskPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      panRef.current = null;
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture?.(e.pointerId);
      maskRef.current = { pointerId: e.pointerId };
      setMaskFromClientX(e.clientX);
    },
    [setMaskFromClientX],
  );

  const onMaskPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!maskRef.current || maskRef.current.pointerId !== e.pointerId) return;
      e.stopPropagation();
      setMaskFromClientX(e.clientX);
    },
    [setMaskFromClientX],
  );

  const endMask = useCallback((e: React.PointerEvent) => {
    if (maskRef.current?.pointerId === e.pointerId) maskRef.current = null;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      onZoom(sideAtClientX(e.clientX), e.deltaY > 0 ? -0.12 : 0.12);
    },
    [onZoom, sideAtClientX],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        panRef.current = null;
        maskRef.current = null;
        const [a, b] = [e.touches[0], e.touches[1]];
        const midX = (a.clientX + b.clientX) / 2;
        pinchRef.current = {
          distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          side: sideAtClientX(midX),
        };
      }
    },
    [sideAtClientX],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = distance / Math.max(pinchRef.current.distance, 1);
        pinchRef.current.distance = distance;
        const side = pinchRef.current.side;
        if (ratio > 1.015) onZoom(side, 0.1);
        else if (ratio < 0.985) onZoom(side, -0.1);
      }
    },
    [onZoom],
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  }, []);

  const beforePct = Math.round(beforeViewport.scale * 100);
  const afterPct = Math.round(afterViewport.scale * 100);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-xs text-muted-foreground">{tEvolution('panHint')}</p>
      <div className="grid grid-cols-2 gap-2" aria-label={tEvolution('zoomControls')}>
        <div className="flex items-center justify-between gap-1 rounded-lg border bg-background/80 px-2 py-1">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tEvolution('before')}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-10 w-10 touch-manipulation"
              onClick={() => onZoomOut('before')}
              aria-label={`${tEvolution('before')}: ${tEvolution('zoomOut')}`}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[2.75rem] text-center text-xs tabular-nums" aria-live="polite">
              {beforePct}%
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-10 w-10 touch-manipulation"
              onClick={() => onZoomIn('before')}
              aria-label={`${tEvolution('before')}: ${tEvolution('zoomIn')}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 rounded-lg border bg-background/80 px-2 py-1">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tEvolution('after')}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-10 w-10 touch-manipulation"
              onClick={() => onZoomOut('after')}
              aria-label={`${tEvolution('after')}: ${tEvolution('zoomOut')}`}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[2.75rem] text-center text-xs tabular-nums" aria-live="polite">
              {afterPct}%
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-10 w-10 touch-manipulation"
              onClick={() => onZoomIn('after')}
              aria-label={`${tEvolution('after')}: ${tEvolution('zoomIn')}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative min-h-[58dvh] flex-1 cursor-grab touch-none overflow-hidden rounded-xl border bg-muted active:cursor-grabbing md:min-h-[320px]"
        onPointerDown={onPanPointerDown}
        onPointerMove={onPanPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        role="img"
        aria-label={`${beforeAlt} / ${afterAlt}. ${tEvolution('panHint')}`}
      >
        <img
          src={afterSrc}
          alt={afterAlt}
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full max-w-none select-none object-contain"
          style={imgStyle(afterViewport)}
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: `${value}%` }}>
          <div className="relative h-full" style={{ width: `${10000 / Math.max(value, 0.01)}%` }}>
            <img
              src={beforeSrc}
              alt={beforeAlt}
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full max-w-none select-none object-contain"
              style={imgStyle(beforeViewport)}
            />
          </div>
        </div>

        {/* Hit area da linha (~44px) — única zona da imagem que move a máscara */}
        <div
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value)}
          aria-label={tEvolution('splitSlider')}
          className="absolute inset-y-0 z-20 flex w-11 -translate-x-1/2 cursor-ew-resize touch-none items-stretch justify-center"
          style={{ left: `${value}%` }}
          onPointerDown={onMaskPointerDown}
          onPointerMove={onMaskPointerMove}
          onPointerUp={endMask}
          onPointerCancel={endMask}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setValue((v) => Math.max(0, v - 2));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setValue((v) => Math.min(100, v + 2));
            }
          }}
        >
          <span className="pointer-events-none w-0.5 self-stretch bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
          <span className="pointer-events-none absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background/90 shadow-sm" />
        </div>

        <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-background/85 px-2 py-1 text-xs font-medium">
          {tEvolution('before')}
        </span>
        <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-background/85 px-2 py-1 text-xs font-medium">
          {tEvolution('after')}
        </span>
        <AlignmentGuides visible={showGuides} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="h-11 w-full accent-primary touch-manipulation"
        aria-label={tEvolution('splitSlider')}
      />
    </div>
  );
}
