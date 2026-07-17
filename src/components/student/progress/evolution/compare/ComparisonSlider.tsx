import { useCallback, useRef, useState } from 'react';
import { tEvolution } from '@/i18n/evolution-photos';
import { AlignmentGuides } from './AlignmentGuides';
import type { ViewportState } from './viewport-types';

type Props = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  beforeViewport: ViewportState;
  afterViewport: ViewportState;
  showGuides: boolean;
};

/**
 * Modo Split: uma barra central revela Antes/Depois.
 * Cada camada usa o respectivo viewport (transform).
 */
export function ComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  beforeViewport,
  afterViewport,
  showGuides,
}: Props) {
  const [value, setValue] = useState(50);
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setValue(Math.min(100, Math.max(0, pct)));
  }, []);

  const imgStyle = (vp: ViewportState): React.CSSProperties => ({
    transform: `translate(calc(-50% + ${vp.x}%), calc(-50% + ${vp.y}%)) scale(${vp.scale})`,
    transformOrigin: 'center center',
    willChange: 'transform',
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        ref={trackRef}
        className="relative min-h-[58dvh] flex-1 touch-none overflow-hidden rounded-xl border bg-muted md:min-h-[320px]"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          setFromClientX(e.clientX);
        }}
      >
        <img
          src={afterSrc}
          alt={afterAlt}
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full max-w-none select-none object-contain"
          style={imgStyle(afterViewport)}
        />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${value}%` }}>
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
        <div
          className="absolute inset-y-0 z-10 w-0.5 bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
          style={{ left: `${value}%` }}
          aria-hidden
        />
        <span className="absolute left-2 top-2 z-10 rounded-md bg-background/85 px-2 py-1 text-xs font-medium">
          {tEvolution('before')}
        </span>
        <span className="absolute right-2 top-2 z-10 rounded-md bg-background/85 px-2 py-1 text-xs font-medium">
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
