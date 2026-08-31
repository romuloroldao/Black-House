import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Columns2,
  FlipHorizontal2,
  Link2,
  Link2Off,
  Loader2,
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
import { apiClient } from '@/lib/api-client';
import {
  formatDateShort,
  formatWeight,
  formatWeightDelta,
  normalizePhotoPose,
  poseLabel,
  type EvolutionPhoto,
  type EvolutionPhotoPose,
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
  /** Callback quando a visão grava pose em fotos legadas. */
  onPhotoPoseUpdated?: (photoId: string, descricao: string) => void;
};

type PoseOption = {
  /** Valor estável no Select */
  value: string;
  label: string;
  pose?: EvolutionPhotoPose;
  index?: number;
};

const POSE_ORDER: EvolutionPhotoPose[] = ['front', 'back', 'leftSide', 'rightSide', 'extra'];

const API_POSE_BY_NORM: Record<Exclude<EvolutionPhotoPose, 'extra'>, string> = {
  front: 'frente',
  back: 'costas',
  leftSide: 'lado_esquerdo',
  rightSide: 'lado_direito',
};

function pickPhoto(item: EvolutionTimelineItem | null, poseKey: string | null): EvolutionPhoto | null {
  if (!item?.photos.length) return null;
  if (!poseKey) return null;

  if (poseKey.startsWith('pose:')) {
    const pose = poseKey.slice(5) as EvolutionPhotoPose;
    const match = item.photos.find((p) => normalizePhotoPose(p.descricao) === pose);
    // Sem esse ângulo neste check-in → null (nunca substitui por outra pose / índice)
    return match ?? null;
  }

  // Compat: valor legado = descrição raw
  const exact = item.photos.find((p) => (p.descricao || '') === poseKey);
  if (exact) return exact;
  const byNorm = item.photos.find(
    (p) => normalizePhotoPose(p.descricao) === normalizePhotoPose(poseKey),
  );
  return byNorm ?? null;
}

function buildPoseOptions(
  current: EvolutionTimelineItem | null,
  baseline: EvolutionTimelineItem | null,
): PoseOption[] {
  const poseSeen = new Set<EvolutionPhotoPose>();
  const options: PoseOption[] = [];

  for (const item of [current, baseline]) {
    item?.photos.forEach((p, idx) => {
      const pose = normalizePhotoPose(p.descricao);
      if (pose === 'extra') return; // sem emparelhamento por índice
      if (poseSeen.has(pose)) return;
      poseSeen.add(pose);
      options.push({
        value: `pose:${pose}`,
        label: poseLabel(p.descricao, idx),
        pose,
      });
    });
  }

  options.sort((a, b) => {
    const ai = a.pose ? POSE_ORDER.indexOf(a.pose) : 100;
    const bi = b.pose ? POSE_ORDER.indexOf(b.pose) : 100;
    return ai - bi;
  });

  return options;
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
 * Ordem: escolher semanas/ângulo → ver imagens (controlos sempre no topo).
 */
export function CompareEvolutionWorkspace({
  items,
  initialCurrent,
  initialBaseline,
  onPhotoPoseUpdated,
}: Props) {
  // Estado inicial só na montagem (dialog usa key ao abrir — não resetar em refetch).
  // Antes = mais antiga (esquerda); Depois = mais recente (direita).
  const [currentId, setCurrentId] = useState(
    initialCurrent?.id || items[0]?.id || '',
  );
  const [baselineId, setBaselineId] = useState(
    initialBaseline?.id || items[items.length - 1]?.id || '',
  );
  const [mode, setMode] = useState<CompareMode>('split');
  const [showGuides, setShowGuides] = useState(true);
  const [region, setRegion] = useState<RegionPreset>('fullBody');
  const [flashAfter, setFlashAfter] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [poseKey, setPoseKey] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const viewports = useSyncedViewports();

  const current = localItems.find((i) => i.id === currentId) || null;
  const baseline = localItems.find((i) => i.id === baselineId) || null;

  /** Classifica fotos sem ângulo nas semanas seleccionadas (visão) e persiste. */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const weekA = localItems.find((i) => i.id === currentId) || null;
      const weekB = localItems.find((i) => i.id === baselineId) || null;
      const targets = [weekA, weekB].filter(Boolean) as EvolutionTimelineItem[];
      const untagged = targets.flatMap((item) =>
        item.photos.filter((p) => normalizePhotoPose(p.descricao) === 'extra'),
      );
      if (!untagged.length) return;
      setClassifying(true);
      try {
        for (const photo of untagged.slice(0, 8)) {
          if (cancelled) return;
          const result = await apiClient.classifyProgressPhotoPoseSafe({
            foto_id: photo.id,
            url: photo.url,
            persist: true,
          });
          if (!result.success) continue;
          const pose = result.data?.pose;
          if (!pose || pose === 'incerto') continue;
          if (cancelled) return;
          setLocalItems((prev) =>
            prev.map((item) => ({
              ...item,
              photos: item.photos.map((p) =>
                p.id === photo.id ? { ...p, descricao: pose } : p,
              ),
            })),
          );
          onPhotoPoseUpdated?.(photo.id, pose);
        }
      } finally {
        if (!cancelled) setClassifying(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // Só quando mudam as semanas — não reentrar a cada update de pose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, baselineId]);

  const poseOptions = useMemo(() => buildPoseOptions(current, baseline), [current, baseline]);

  useEffect(() => {
    if (!poseOptions.length) {
      setPoseKey(null);
      return;
    }
    if (!poseKey || !poseOptions.some((o) => o.value === poseKey)) {
      const firstPose = poseOptions.find((o) => o.value.startsWith('pose:'));
      setPoseKey(firstPose?.value || null);
    }
  }, [poseOptions, poseKey]);

  const beforePhoto = pickPhoto(baseline, poseKey);
  const afterPhoto = pickPhoto(current, poseKey);
  const missingPhoto = Boolean(poseKey) && (!beforePhoto || !afterPhoto);
  const missingPoseLabel = poseKey?.startsWith('pose:')
    ? poseLabel(API_POSE_BY_NORM[poseKey.slice(5) as Exclude<EvolutionPhotoPose, 'extra'>] || null, 0)
    : tEvolution('pose');

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

  const swapSides = () => {
    setCurrentId(baselineId);
    setBaselineId(currentId);
  };

  const deltaTone =
    current?.deltaFirstKg == null || Math.abs(current.deltaFirstKg) < 0.05
      ? undefined
      : current.deltaFirstKg < 0
        ? 'pos'
        : 'neg';

  const weekSelectors = (
    <div className="sticky top-0 z-20 space-y-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur-sm">
      <p className="text-xs text-muted-foreground">{tEvolution('chooseWeeksHint')}</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_1fr] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="cmp-before" className="text-xs font-semibold">
            {tEvolution('before')}
            {baseline ? (
              <span className="ml-1 font-normal text-muted-foreground">
                · {formatDateShort(baseline.date)}
              </span>
            ) : null}
          </Label>
          <Select value={baselineId} onValueChange={setBaselineId}>
            <SelectTrigger id="cmp-before" className="h-11">
              <SelectValue placeholder={tEvolution('before')} />
            </SelectTrigger>
            <SelectContent>
              {localItems.map((item) => (
                <SelectItem key={`b-${item.id}`} value={item.id}>
                  {item.label} · {formatDateShort(item.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 w-full gap-1.5 sm:w-auto"
          onClick={swapSides}
          disabled={!baselineId || !currentId || baselineId === currentId}
          aria-label={tEvolution('swapSides')}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span className="text-xs sm:sr-only lg:not-sr-only">{tEvolution('swapSides')}</span>
        </Button>

        <div className="space-y-1">
          <Label htmlFor="cmp-after" className="text-xs font-semibold">
            {tEvolution('after')}
            {current ? (
              <span className="ml-1 font-normal text-muted-foreground">
                · {formatDateShort(current.date)}
              </span>
            ) : null}
          </Label>
          <Select value={currentId} onValueChange={setCurrentId}>
            <SelectTrigger id="cmp-after" className="h-11">
              <SelectValue placeholder={tEvolution('after')} />
            </SelectTrigger>
            <SelectContent>
              {localItems.map((item) => (
                <SelectItem key={`a-${item.id}`} value={item.id}>
                  {item.isCurrent ? tEvolution('currentWeek') : item.label} ·{' '}
                  {formatDateShort(item.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cmp-pose" className="text-xs font-semibold">
            {tEvolution('pose')}
          </Label>
          <Select
            value={poseKey || poseOptions[0]?.value || 'none'}
            onValueChange={(v) => setPoseKey(v === 'none' ? null : v)}
            disabled={poseOptions.length === 0}
          >
            <SelectTrigger id="cmp-pose" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {poseOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn('flex min-h-0 flex-col gap-2.5', expanded && 'min-h-[min(85dvh,900px)]')}>
      {weekSelectors}

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
            disabled={missingPhoto}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Button
          type="button"
          size="sm"
          variant={viewports.synced ? 'secondary' : 'outline'}
          className="h-11 shrink-0 gap-1.5 px-3"
          onClick={() => viewports.setSynced(!viewports.synced)}
          aria-pressed={viewports.synced}
          disabled={missingPhoto}
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
          disabled={missingPhoto}
        >
          {showGuides ? tEvolution('hideGuides') : tEvolution('showGuides')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 shrink-0 gap-1.5 px-3"
          onClick={() => viewports.reset()}
          disabled={missingPhoto}
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

      {classifying ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
          A identificar ângulos das fotos pela imagem…
        </div>
      ) : null}

      {missingPhoto ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center">
          <p className="text-sm font-medium text-foreground">
            Sem foto de {missingPoseLabel} numa das semanas
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {tEvolution('emptySlotHint')} Não misturamos frente com costas — escolha outro ângulo ou
            outra semana.
          </p>
        </div>
      ) : beforePhoto && afterPhoto ? (
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col',
            expanded ? 'min-h-[58dvh]' : 'min-h-[48dvh]',
          )}
        >
          {mode === 'split' ? (
            <ComparisonSlider
              beforeSrc={beforePhoto!.url}
              afterSrc={afterPhoto!.url}
              beforeAlt={tEvolution('before')}
              afterAlt={tEvolution('after')}
              beforeViewport={viewports.before}
              afterViewport={viewports.after}
              showGuides={showGuides}
              synced={viewports.synced}
              onPan={viewports.pan}
              onZoom={viewports.zoom}
              onZoomIn={viewports.zoomIn}
              onZoomOut={viewports.zoomOut}
            />
          ) : null}

          {mode === 'sideBySide' ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
              <ImageViewport
                src={beforePhoto!.url}
                alt={tEvolution('before')}
                label={`${tEvolution('before')} · ${formatDateShort(baseline?.date)}`}
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
                src={afterPhoto!.url}
                alt={tEvolution('after')}
                label={`${tEvolution('after')} · ${formatDateShort(current?.date)}`}
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
                src={flashAfter ? afterPhoto!.url : beforePhoto!.url}
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
      ) : (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center">
          <p className="text-sm font-medium text-foreground">Sem ângulos identificados</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Estas semanas ainda não têm Frente/Costas etiquetados. Aguarde a identificação automática
            ou peça ao aluno para reenviar o check-in com os ângulos correctos.
          </p>
        </div>
      )}

      {!missingPhoto && beforePhoto && afterPhoto ? (
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
      ) : null}
    </div>
  );
}
