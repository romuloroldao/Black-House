import { useCallback, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tEvolution } from '@/i18n/evolution-photos';
import type { ViewportState } from './viewport-types';

type Props = {
  src: string;
  alt: string;
  label: string;
  viewport: ViewportState;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPan: (dxPct: number, dyPct: number) => void;
  onWheelZoom: (delta: number) => void;
  showGuides?: boolean;
  guides?: React.ReactNode;
  className?: string;
};

/**
 * Viewport mobile-first: área de imagem alta, botões de zoom ≥44px, pinch + pan.
 */
export function ImageViewport({
  src,
  alt,
  label,
  viewport,
  onZoomIn,
  onZoomOut,
  onPan,
  onWheelZoom,
  showGuides,
  guides,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const pinchRef = useRef<{ distance: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (pinchRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pinchRef.current) return;
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dxPct = ((e.clientX - drag.lastX) / Math.max(rect.width, 1)) * 100;
      const dyPct = ((e.clientY - drag.lastY) / Math.max(rect.height, 1)) * 100;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      onPan(dxPct, dyPct);
    },
    [onPan],
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      onWheelZoom(delta);
    },
    [onWheelZoom],
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      dragRef.current = null;
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchRef.current = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      };
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = distance / Math.max(pinchRef.current.distance, 1);
        pinchRef.current.distance = distance;
        if (ratio > 1.015) onWheelZoom(0.1);
        else if (ratio < 0.985) onWheelZoom(-0.1);
      }
    },
    [onWheelZoom],
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  }, []);

  const pct = Math.round(viewport.scale * 100);

  return (
    <div className={cn('flex min-h-0 flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1" role="group" aria-label={tEvolution('zoomControls')}>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-11 w-11 touch-manipulation"
            onClick={onZoomOut}
            aria-label={tEvolution('zoomOut')}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums" aria-live="polite">
            {pct}%
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-11 w-11 touch-manipulation"
            onClick={onZoomIn}
            aria-label={tEvolution('zoomIn')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[42dvh] flex-1 cursor-grab touch-none overflow-hidden rounded-xl border bg-muted active:cursor-grabbing md:min-h-[280px]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        role="img"
        aria-label={`${label}: ${alt}. ${tEvolution('panHint')}`}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full max-w-none select-none object-contain"
          style={{
            transform: `translate(calc(-50% + ${viewport.x}%), calc(-50% + ${viewport.y}%)) scale(${viewport.scale})`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        />
        {showGuides ? guides : null}
      </div>
    </div>
  );
}
