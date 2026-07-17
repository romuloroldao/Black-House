import { useEffect, useMemo, useState } from 'react';
import {
  Columns2,
  FlipHorizontal2,
  Link2,
  Link2Off,
  Maximize2,
  Minimize2,
  RotateCcw,
  SplitSquareHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { tEvolution } from '@/i18n/evolution-photos';
import {
  formatDateShort,
  formatWeight,
  formatWeightDelta,
  poseLabel,
  type EvolutionPhoto,
  type EvolutionTimelineItem,
} from '@/lib/evolution-timeline';
import { AlignmentGuides } from './AlignmentGuides';
import { ComparisonSlider } from './ComparisonSlider';
import { ImageViewport } from './ImageViewport';
import { useSyncedViewports } from './useSyncedViewports';
import type { CompareMode, RegionPreset } from './viewport-types';

type Props = {
  items: EvolutionTimelineItem[];
  initialCurrent: EvolutionTimelineItem | null;
  initialBaseline: EvolutionTimelineItem | null;
};

function pickPhoto(item: EvolutionTimelineItem | null, poseKey: string | null): EvolutionPhoto | null {
  if (!item?.photos.length) return null;
  if (poseKey) {
    const match = item.photos.find((p) => (p.descricao || '') === poseKey);
    if (match) return match;
  }
  return item.photos[0] ?? null;
}

function MetricChip({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="min-w-0 shrink-0 rounded-lg border bg-background/80 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-sm font-semibold tabular-nums',
          tone === 'pos' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'neg' && 'text-amber-600 dark:text-amber-400',
        )}
      >
        {value}
      </p>
    </div>
  );
}

const REGIONS: RegionPreset[] = ['fullBody', 'torso', 'abdomen', 'back', 'legs'];

function regionLabel(r: RegionPreset) {
  if (r === 'fullBody') return tEvolution('regionFullBody');
  if (r === 'torso') return tEvolution('regionTorso');
  if (r === 'abdomen') return tEvolution('regionAbdomen');
  if (r === 'back') return tEvolution('regionBack');
  return tEvolution('regionLegs');
}

/**
 * Workspace de comparação — mobile-first.
 * Prioridade: imagens grandes, controlos touch, stack vertical no telemóvel.
 */
export function CompareEvolutionWorkspace({ items, initialCurrent, initialBaseline }: Props) {
  const [currentId, setCurrentId] = useState(initialCurrent?.id || items[0]?.id || '');
  const [baselineId, setBaselineId] = useState(
    initialBaseline?.id || items[items.length - 1]?.id || '',
  );
  /** Split é o melhor modo default em ecrãs estreitos. */
  const [mode, setMode] = useState<CompareMode>('split');
  const [showGuides, setShowGuides] = useState(true);
  const [region, setRegion] = useState<RegionPreset>('fullBody');
  const [flashAfter, setFlashAfter] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [poseKey, setPoseKey] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const viewports = useSyncedViewports();

  useEffect(() => {
    setCurrentId(initialCurrent?.id || items[0]?.id || '');
    setBaselineId(initialBaseline?.id || items[items.length - 1]?.id || '');
  }, [initialCurrent, initialBaseline, items]);

  const current = items.find((i) => i.id === currentId) || null;
  const baseline = items.find((i) => i.id === baselineId) || null;

  const poseOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const item of [current, baseline]) {
      item?.photos.forEach((p, idx) => {
        keys.add(p.descricao || `__idx_${idx}`);
      });
    }
    return Array.from(keys);
  }, [current, baseline]);

  useEffect(() => {
    if (!poseKey && poseOptions[0]) {
      const firstReal = poseOptions.find((k) => !k.startsWith('__idx_'));
      setPoseKey(firstReal || null);
    }
  }, [poseOptions, poseKey]);

  const beforePhoto = pickPhoto(baseline, poseKey);
  const afterPhoto = pickPhoto(current, poseKey);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        setFlashAfter(true);
        setMode('flash');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setFlashAfter(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const applyRegion = (r: RegionPreset) => {
    setRegion(r);
    viewports.applyRegion(r);
  };

  const deltaTone =
    current?.deltaFirstKg == null || Math.abs(current.deltaFirstKg) < 0.05
      ? undefined
      : current.deltaFirstKg < 0
        ? 'pos'
        : 'neg';

  if (!beforePhoto || !afterPhoto) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm text-muted-foreground">
        {tEvolution('emptySlot')}
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-2.5', expanded && 'min-h-[min(85dvh,900px)]')}>
      {/* Métricas — faixa horizontal compacta (mobile-first) */}
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={tEvolution('metricsPanel')}
      >
        <MetricChip label={tEvolution('before')} value={formatWeight(baseline?.pesoKg ?? null)} />
        <MetricChip label={tEvolution('after')} value={formatWeight(current?.pesoKg ?? null)} />
        {current?.deltaPreviousKg != null ? (
          <MetricChip
            label={tEvolution('vsPrevious')}
            value={formatWeightDelta(current.deltaPreviousKg) || '0 kg'}
          />
        ) : null}
        {current?.deltaFirstKg != null ? (
          <MetricChip
            label={tEvolution('vsFirst')}
            value={formatWeightDelta(current.deltaFirstKg) || '0 kg'}
            tone={deltaTone}
          />
        ) : null}
      </div>

      {/* Modos — barra touch full-width */}
      <div
        className="grid grid-cols-3 gap-1 rounded-xl border bg-muted/30 p-1"
        role="radiogroup"
        aria-label={tEvolution('compareModes')}
      >
        {(
          [
            { id: 'split' as const, icon: SplitSquareHorizontal, label: tEvolution('modeSplit') },
            { id: 'sideBySide' as const, icon: Columns2, label: tEvolution('modeSideBySide') },
            { id: 'flash' as const, icon: FlipHorizontal2, label: tEvolution('modeFlash') },
          ] as const
        ).map(({ id, icon: Icon, label }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={mode === id ? 'secondary' : 'ghost'}
            className="h-11 min-h-11 flex-col gap-0.5 px-1 text-[10px] leading-tight sm:h-10 sm:flex-row sm:gap-1.5 sm:text-xs"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </div>

      {/* Acções rápidas — alvos ≥44px */}
      <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Button
          type="button"
          size="sm"
          variant={viewports.synced ? 'secondary' : 'outline'}
          className="h-11 shrink-0 gap-1.5 px-3"
          onClick={() => viewports.setSynced(!viewports.synced)}
          aria-pressed={viewports.synced}
        >
          {viewports.synced ? <Link2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
          <span className="text-xs">{tEvolution('syncImages')}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showGuides ? 'secondary' : 'outline'}
          className="h-11 shrink-0 px-3 text-xs"
          onClick={() => setShowGuides((v) => !v)}
          aria-pressed={showGuides}
        >
          {showGuides ? tEvolution('hideGuides') : tEvolution('showGuides')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 shrink-0 gap-1.5 px-3"
          onClick={() => viewports.reset()}
        >
          <RotateCcw className="h-4 w-4" />
          <span className="text-xs">{tEvolution('resetView')}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 shrink-0 gap-1.5 px-3"
          onClick={() => setExpanded((v) => !v)}
          aria-pressed={expanded}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span className="sr-only sm:not-sr-only sm:text-xs">
            {expanded ? tEvolution('exitFullscreen') : tEvolution('fullscreen')}
          </span>
        </Button>
      </div>

      {/* Stage principal — ocupa a maior parte do ecrã */}
      <div className={cn('relative flex min-h-0 flex-1 flex-col', expanded ? 'min-h-[58dvh]' : 'min-h-[48dvh]')}>
        {mode === 'split' ? (
          <ComparisonSlider
            beforeSrc={beforePhoto.url}
            afterSrc={afterPhoto.url}
            beforeAlt={tEvolution('before')}
            afterAlt={tEvolution('after')}
            beforeViewport={viewports.before}
            afterViewport={viewports.after}
            showGuides={showGuides}
          />
        ) : null}

        {mode === 'sideBySide' ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
            <ImageViewport
              src={beforePhoto.url}
              alt={tEvolution('before')}
              label={tEvolution('before')}
              viewport={viewports.before}
              onZoomIn={() => viewports.zoomIn('before')}
              onZoomOut={() => viewports.zoomOut('before')}
              onPan={(dx, dy) => viewports.pan('before', dx, dy)}
              onWheelZoom={(d) => viewports.zoom('before', d)}
              showGuides={showGuides}
              guides={<AlignmentGuides visible={showGuides} />}
              className="min-h-[42dvh] md:min-h-0"
            />
            <ImageViewport
              src={afterPhoto.url}
              alt={tEvolution('after')}
              label={tEvolution('after')}
              viewport={viewports.after}
              onZoomIn={() => viewports.zoomIn('after')}
              onZoomOut={() => viewports.zoomOut('after')}
              onPan={(dx, dy) => viewports.pan('after', dx, dy)}
              onWheelZoom={(d) => viewports.zoom('after', d)}
              showGuides={showGuides}
              guides={<AlignmentGuides visible={showGuides} />}
              className="min-h-[42dvh] md:min-h-0"
            />
          </div>
        ) : null}

        {mode === 'flash' ? (
          <div className="relative flex min-h-[58dvh] flex-1 flex-col overflow-hidden rounded-xl border bg-muted">
            <img
              src={flashAfter ? afterPhoto.url : beforePhoto.url}
              alt={flashAfter ? tEvolution('after') : tEvolution('before')}
              className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full max-w-none select-none object-contain"
              style={{
                transform: `translate(calc(-50% + ${(flashAfter ? viewports.after : viewports.before).x}%), calc(-50% + ${(flashAfter ? viewports.after : viewports.before).y}%)) scale(${(flashAfter ? viewports.after : viewports.before).scale})`,
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
            />
            <Badge className="absolute left-2 top-2 z-10">
              {flashAfter ? tEvolution('after') : tEvolution('before')}
            </Badge>
            <AlignmentGuides visible={showGuides} />
            {/* Hold-to-swap — gesto principal no mobile */}
            <button
              type="button"
              className="absolute inset-x-4 bottom-4 z-10 flex h-14 items-center justify-center rounded-full border bg-background/90 text-sm font-semibold shadow-lg backdrop-blur-sm active:scale-[0.98] sm:inset-x-auto sm:left-1/2 sm:w-56 sm:-translate-x-1/2"
              onPointerDown={(e) => {
                e.preventDefault();
                setFlashAfter(true);
              }}
              onPointerUp={() => setFlashAfter(false)}
              onPointerLeave={() => setFlashAfter(false)}
              onPointerCancel={() => setFlashAfter(false)}
              aria-label={tEvolution('holdToSwap')}
            >
              {tEvolution('holdToSwap')}
            </button>
          </div>
        ) : null}
      </div>

      {/* Regiões — scroll horizontal touch */}
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={tEvolution('regionPresets')}
      >
        {REGIONS.map((r) => (
          <Button
            key={r}
            type="button"
            size="sm"
            variant={region === r ? 'secondary' : 'outline'}
            className="h-10 shrink-0 px-3 text-xs"
            onClick={() => applyRegion(r)}
            aria-pressed={region === r}
          >
            {regionLabel(r)}
          </Button>
        ))}
      </div>

      {/* Selectors colapsáveis no mobile */}
      <div className="rounded-xl border bg-muted/20">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-between px-3 text-left text-sm font-medium md:hidden"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {tEvolution('chooseWeeks')}
          <span className="text-xs text-muted-foreground">{showAdvanced ? '−' : '+'}</span>
        </button>
        <div className={cn('grid gap-2 p-3 pt-0 md:grid md:grid-cols-3 md:pt-3', showAdvanced ? 'grid' : 'hidden md:grid')}>
          <div className="space-y-1">
            <Label htmlFor="cmp-before" className="text-xs">
              {tEvolution('before')}
            </Label>
            <Select value={baselineId} onValueChange={setBaselineId}>
              <SelectTrigger id="cmp-before" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label} · {formatDateShort(item.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cmp-after" className="text-xs">
              {tEvolution('after')}
            </Label>
            <Select value={currentId} onValueChange={setCurrentId}>
              <SelectTrigger id="cmp-after" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.isCurrent ? tEvolution('currentWeek') : item.label} · {formatDateShort(item.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cmp-pose" className="text-xs">
              {tEvolution('pose')}
            </Label>
            <Select
              value={poseKey || poseOptions[0] || 'none'}
              onValueChange={(v) => setPoseKey(v.startsWith('__idx_') ? null : v === 'none' ? null : v)}
            >
              <SelectTrigger id="cmp-pose" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {poseOptions.map((key, idx) => (
                  <SelectItem key={key} value={key}>
                    {key.startsWith('__idx_')
                      ? `${tEvolution('photoNumber')} ${idx + 1}`
                      : poseLabel(key, idx)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
