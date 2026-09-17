import { useCallback, useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tEvolution } from '@/i18n/evolution-photos';
import { usePhotoPosePendingStatus } from '@/hooks/usePhotoPoseBackfill';
import { isPoseAnalysisPending } from '@/lib/evolution-timeline-pose';
import {
  formatDateShort,
  findPhotoByPose,
  getAvailablePosesForPhotos,
  getCommonPosesForPhotos,
  normalizePhotoPose,
  poseLabel,
  weightDeltaBetween,
  type EvolutionPhoto,
  type EvolutionPhotoPose,
  type EvolutionTimelineItem,
} from '@/lib/evolution-timeline';
import { AdvancedCompareControls, AdvancedCompareSheet } from './AdvancedCompareSheet';
import { AlignmentGuides } from './AlignmentGuides';
import { AnglePoseSelector, type PoseOption } from './AnglePoseSelector';
import { ComparisonModeTabs } from './ComparisonModeTabs';
import { ComparisonPeriodHeader } from './ComparisonPeriodHeader';
import { ComparisonSlider } from './ComparisonSlider';
import { ComparisonViewportShell } from './ComparisonViewportShell';
import { ImageViewport } from './ImageViewport';
import { useSyncedViewports } from './useSyncedViewports';
import type { CompareMode, CompareUiMode, RegionPreset } from './viewport-types';

type Props = {
  items: EvolutionTimelineItem[];
  initialCurrent: EvolutionTimelineItem | null;
  initialBaseline: EvolutionTimelineItem | null;
};

const POSE_ORDER: EvolutionPhotoPose[] = ['front', 'back', 'leftSide', 'rightSide', 'extra'];
const POSE_CANONICAL_DESC: Record<Exclude<EvolutionPhotoPose, 'extra'>, string> = {
  front: 'frente',
  back: 'costas',
  leftSide: 'lado_esquerdo',
  rightSide: 'lado_direito',
};
const SLIDER_HINT_KEY = 'bh-compare-slider-hint-dismissed';

function pickPhoto(item: EvolutionTimelineItem | null, poseKey: string | null): EvolutionPhoto | null {
  if (!item?.photos.length) return null;
  if (!poseKey) return item.photos[0] ?? null;

  if (poseKey.startsWith('idx:')) {
    const idx = Number(poseKey.slice(4));
    if (Number.isInteger(idx) && idx >= 0 && idx < item.photos.length) {
      return item.photos[idx];
    }
    return item.photos[0] ?? null;
  }

  if (poseKey.startsWith('pose:')) {
    const pose = poseKey.slice(5) as EvolutionPhotoPose;
    return findPhotoByPose(item.photos, pose);
  }

  const exact = item.photos.find((p) => (p.descricao || '') === poseKey);
  if (exact) return exact;
  const byNorm = item.photos.find(
    (p) => normalizePhotoPose(p.descricao, p) === normalizePhotoPose(poseKey),
  );
  return byNorm ?? null;
}

function buildPoseOptions(
  current: EvolutionTimelineItem | null,
  baseline: EvolutionTimelineItem | null,
): PoseOption[] {
  const poseSeen = new Set<EvolutionPhotoPose>();
  const options: PoseOption[] = [];

  const baselinePoses = baseline ? getAvailablePosesForPhotos(baseline.photos) : [];
  const currentPoses = current ? getAvailablePosesForPhotos(current.photos) : [];
  const commonPoses =
    baseline && current
      ? getCommonPosesForPhotos(baseline.photos, current.photos)
      : [...new Set([...baselinePoses, ...currentPoses])];

  for (const pose of commonPoses) {
    if (poseSeen.has(pose)) continue;
    poseSeen.add(pose);
    const sample =
      findPhotoByPose(baseline?.photos ?? [], pose) ||
      findPhotoByPose(current?.photos ?? [], pose);
    const desc =
      sample?.descricao ||
      (pose !== 'extra' ? POSE_CANONICAL_DESC[pose as keyof typeof POSE_CANONICAL_DESC] : undefined);
    options.push({
      value: `pose:${pose}`,
      label: poseLabel(desc, poseIndexLabel(pose), sample ?? undefined),
      pose,
    });
  }

  options.sort((a, b) => {
    const ai = a.pose ? POSE_ORDER.indexOf(a.pose) : 100 + (a.index ?? 0);
    const bi = b.pose ? POSE_ORDER.indexOf(b.pose) : 100 + (b.index ?? 0);
    return ai - bi;
  });

  return options;
}

function poseIndexLabel(pose: EvolutionPhotoPose): number {
  const idx = POSE_ORDER.indexOf(pose);
  return idx >= 0 ? idx : 0;
}

function readHintDismissed(): boolean {
  try {
    return localStorage.getItem(SLIDER_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Workspace de comparação — hierarquia: evolução → foto → modos → ângulo → avançado.
 */
export function CompareEvolutionWorkspace({ items, initialCurrent, initialBaseline }: Props) {
  const [currentId, setCurrentId] = useState(initialCurrent?.id || items[0]?.id || '');
  const [baselineId, setBaselineId] = useState(
    initialBaseline?.id || items[items.length - 1]?.id || '',
  );
  const [uiMode, setUiMode] = useState<CompareUiMode>('compare');
  const [alignView, setAlignView] = useState<CompareMode>('split');
  const [showGuides, setShowGuides] = useState(false);
  const [region, setRegion] = useState<RegionPreset>('fullBody');
  const [flashAfter, setFlashAfter] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [poseKey, setPoseKey] = useState<string | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(readHintDismissed);

  const viewports = useSyncedViewports();

  const current = items.find((i) => i.id === currentId) || null;
  const baseline = items.find((i) => i.id === baselineId) || null;

  const poseOptions = useMemo(() => buildPoseOptions(current, baseline), [current, baseline]);

  useEffect(() => {
    if (!poseOptions.length) {
      setPoseKey(null);
      return;
    }
    if (!poseKey || !poseOptions.some((o) => o.value === poseKey)) {
      const firstPose = poseOptions.find((o) => o.value.startsWith('pose:'));
      setPoseKey(firstPose?.value || poseOptions[0].value);
    }
  }, [poseOptions, poseKey]);

  const beforePhoto = pickPhoto(baseline, poseKey);
  const afterPhoto = pickPhoto(current, poseKey);

  const comparePhotos = useMemo(
    () => [...(baseline?.photos ?? []), ...(current?.photos ?? [])],
    [baseline?.photos, current?.photos],
  );
  const { isAnalyzing: isClassifyingPoses } = usePhotoPosePendingStatus(comparePhotos);

  const selectedPhotosPending =
    Boolean(beforePhoto && isPoseAnalysisPending(beforePhoto)) ||
    Boolean(afterPhoto && isPoseAnalysisPending(afterPhoto));

  const hasAnyPhoto = Boolean(beforePhoto || afterPhoto);
  const missingBoth = !beforePhoto && !afterPhoto;
  const partial = hasAnyPhoto && (!beforePhoto || !afterPhoto);
  const ready = Boolean(beforePhoto && afterPhoto);
  const classifying = isClassifyingPoses || selectedPhotosPending;

  const selectedAngleLabel = useMemo(() => {
    if (!poseKey?.startsWith('pose:')) return null;
    const pose = poseKey.slice(5) as EvolutionPhotoPose;
    if (pose === 'extra') return null;
    const desc = POSE_CANONICAL_DESC[pose as keyof typeof POSE_CANONICAL_DESC];
    return desc ? poseLabel(desc, 0) : null;
  }, [poseKey]);

  const pairDelta = weightDeltaBetween(current?.pesoKg, baseline?.pesoKg);

  useEffect(() => {
    if (!poseKey) return;
    viewports.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset zoom ao mudar pose/período
  }, [poseKey, baselineId, currentId]);

  const renderMode: CompareMode =
    uiMode === 'compare' ? 'split' : uiMode === 'sideBySide' ? 'sideBySide' : alignView;

  const isAlign = uiMode === 'align';
  const showZoom = isAlign;
  const guidesVisible = isAlign && showGuides;

  const dismissHint = useCallback(() => {
    if (hintDismissed) return;
    setHintDismissed(true);
    try {
      localStorage.setItem(SLIDER_HINT_KEY, '1');
    } catch {
      /* ignore */
    }
  }, [hintDismissed]);

  const handleUiMode = (mode: CompareUiMode) => {
    setUiMode(mode);
    if (mode === 'align') {
      setShowGuides(true);
      const isMobile =
        typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
      if (isMobile) setAdjustOpen(true);
    } else {
      setShowGuides(false);
      setFlashAfter(false);
      if (mode === 'compare') setAlignView('split');
      if (mode === 'sideBySide') setAlignView('sideBySide');
    }
  };

  useEffect(() => {
    if (!isAlign) return;
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
        setAlignView('flash');
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
  }, [isAlign]);

  const applyRegion = (r: RegionPreset) => {
    setRegion(r);
    viewports.applyRegion(r);
  };

  const swapSides = () => {
    setCurrentId(baselineId);
    setBaselineId(currentId);
  };

  const advancedProps = {
    items,
    baselineId,
    currentId,
    onBaselineId: setBaselineId,
    onCurrentId: setCurrentId,
    onSwapSides: swapSides,
    showGuides,
    onToggleGuides: () => setShowGuides((v) => !v),
    synced: viewports.synced,
    onToggleSynced: () => viewports.setSynced(!viewports.synced),
    onReset: () => viewports.reset(),
    expanded,
    onToggleExpanded: () => setExpanded((v) => !v),
    region,
    onApplyRegion: applyRegion,
    alignView,
    onAlignView: setAlignView,
    showAlignViewToggle: isAlign,
    disabled: !ready,
  };

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-3 overflow-x-hidden',
        expanded && 'min-h-[min(88dvh,920px)]',
      )}
    >
      <ComparisonPeriodHeader
        beforeDate={baseline?.date}
        afterDate={current?.date}
        afterWeightKg={current?.pesoKg ?? null}
        pairDeltaKg={pairDelta}
        onOpenPeriod={() => setPeriodOpen(true)}
        className="pr-8"
      />

      <ComparisonViewportShell
        missingBoth={missingBoth && !hasAnyPhoto && !classifying}
        missingAngle={missingBoth && Boolean(poseKey) && Boolean(selectedAngleLabel) && !classifying}
        missingAngleLabel={selectedAngleLabel}
        partial={partial && !classifying}
        classifying={classifying}
        beforeDate={baseline?.date}
        afterDate={current?.date}
        className={cn(expanded ? 'min-h-[58dvh]' : 'min-h-[48dvh]')}
      >
        {ready ? (
          <div
            key={`${renderMode}-${poseKey}`}
            className="flex min-h-0 flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {renderMode === 'split' ? (
              <ComparisonSlider
                beforeSrc={beforePhoto!.url}
                afterSrc={afterPhoto!.url}
                beforeAlt={tEvolution('before')}
                afterAlt={tEvolution('after')}
                beforeViewport={viewports.before}
                afterViewport={viewports.after}
                showGuides={guidesVisible}
                synced={viewports.synced}
                onPan={viewports.pan}
                onZoom={viewports.zoom}
                onZoomIn={viewports.zoomIn}
                onZoomOut={viewports.zoomOut}
                showZoomControls={showZoom}
                showDragHint={uiMode === 'compare' && !hintDismissed}
                onDragHintDismiss={dismissHint}
              />
            ) : null}

            {renderMode === 'sideBySide' ? (
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
                  showGuides={guidesVisible}
                  guides={<AlignmentGuides visible={guidesVisible} />}
                  showZoomControls={showZoom}
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
                  showGuides={guidesVisible}
                  guides={<AlignmentGuides visible={guidesVisible} />}
                  showZoomControls={showZoom}
                  className="min-h-[42dvh] md:min-h-0"
                />
              </div>
            ) : null}

            {renderMode === 'flash' ? (
              <div className="relative flex min-h-[min(62dvh,520px)] flex-1 flex-col overflow-hidden rounded-xl bg-muted">
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
                <AlignmentGuides visible={guidesVisible} />
                <button
                  type="button"
                  className="absolute inset-x-4 bottom-4 z-10 flex h-14 items-center justify-center rounded-full border bg-background/90 text-sm font-semibold shadow-lg backdrop-blur-sm motion-safe:active:scale-[0.98] sm:inset-x-auto sm:left-1/2 sm:w-56 sm:-translate-x-1/2"
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
        ) : null}
      </ComparisonViewportShell>

      <div className="shrink-0 space-y-2.5">
        <ComparisonModeTabs value={uiMode} onChange={handleUiMode} disabled={!ready} />

        <AnglePoseSelector
          options={poseOptions}
          value={poseKey}
          onChange={setPoseKey}
          disabled={poseOptions.length === 0}
        />

        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 gap-1.5 text-xs text-muted-foreground"
            onClick={() => {
              if (uiMode !== 'align') setUiMode('align');
              setShowGuides(true);
              setAdjustOpen(true);
            }}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {tEvolution('adjustCompare')}
          </Button>
        </div>

        {/* Desktop: painel avançado inline quando modo Alinhar */}
        {isAlign ? (
          <div className="hidden rounded-xl border border-border/60 bg-card/50 p-3 md:block">
            <AdvancedCompareControls {...advancedProps} showPeriodSelectors={false} />
          </div>
        ) : null}
      </div>

      <AdvancedCompareSheet
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        title={tEvolution('changePeriod')}
        description={tEvolution('chooseWeeksHint')}
        {...advancedProps}
        showPeriodSelectors
        showAlignViewToggle={false}
      />

      <AdvancedCompareSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title={tEvolution('adjustCompare')}
        description={isAlign ? tEvolution('spaceHint') : tEvolution('chooseWeeksHint')}
        {...advancedProps}
        showPeriodSelectors
        showAlignViewToggle
      />
    </div>
  );
}
