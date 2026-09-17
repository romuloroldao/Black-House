import {
  ArrowLeftRight,
  FlipHorizontal2,
  Link2,
  Link2Off,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { tEvolution } from '@/i18n/evolution-photos';
import { formatDateShort, type EvolutionTimelineItem } from '@/lib/evolution-timeline';
import type { CompareMode, RegionPreset } from './viewport-types';

const REGIONS: RegionPreset[] = ['fullBody', 'torso', 'abdomen', 'back', 'legs'];

function regionLabel(r: RegionPreset) {
  if (r === 'fullBody') return tEvolution('regionFullBody');
  if (r === 'torso') return tEvolution('regionTorso');
  if (r === 'abdomen') return tEvolution('regionAbdomen');
  if (r === 'back') return tEvolution('regionBack');
  return tEvolution('regionLegs');
}

export type AdvancedCompareControlsProps = {
  items: EvolutionTimelineItem[];
  baselineId: string;
  currentId: string;
  onBaselineId: (id: string) => void;
  onCurrentId: (id: string) => void;
  onSwapSides: () => void;
  showPeriodSelectors?: boolean;
  showGuides: boolean;
  onToggleGuides: () => void;
  synced: boolean;
  onToggleSynced: () => void;
  onReset: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  region: RegionPreset;
  onApplyRegion: (r: RegionPreset) => void;
  alignView: CompareMode;
  onAlignView: (m: CompareMode) => void;
  showAlignViewToggle?: boolean;
  disabled?: boolean;
};

export function AdvancedCompareControls({
  items,
  baselineId,
  currentId,
  onBaselineId,
  onCurrentId,
  onSwapSides,
  showPeriodSelectors = true,
  showGuides,
  onToggleGuides,
  synced,
  onToggleSynced,
  onReset,
  expanded,
  onToggleExpanded,
  region,
  onApplyRegion,
  alignView,
  onAlignView,
  showAlignViewToggle = false,
  disabled,
}: AdvancedCompareControlsProps) {
  return (
    <div className="space-y-4">
      {showPeriodSelectors ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{tEvolution('chooseWeeks')}</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="adv-before" className="text-xs font-semibold">
                {tEvolution('before')}
              </Label>
              <Select value={baselineId} onValueChange={onBaselineId}>
                <SelectTrigger id="adv-before" className="h-11">
                  <SelectValue placeholder={tEvolution('before')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
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
              className="h-11 gap-1.5"
              onClick={onSwapSides}
              disabled={disabled || !baselineId || !currentId || baselineId === currentId}
              aria-label={tEvolution('swapSides')}
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span className="text-xs">{tEvolution('swapSides')}</span>
            </Button>
            <div className="space-y-1">
              <Label htmlFor="adv-after" className="text-xs font-semibold">
                {tEvolution('after')}
              </Label>
              <Select value={currentId} onValueChange={onCurrentId}>
                <SelectTrigger id="adv-after" className="h-11">
                  <SelectValue placeholder={tEvolution('after')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={`a-${item.id}`} value={item.id}>
                      {item.isCurrent ? tEvolution('currentWeek') : item.label} ·{' '}
                      {formatDateShort(item.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      {showAlignViewToggle ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{tEvolution('compareModes')}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'split' as const, label: tEvolution('modeCompare') },
                { id: 'sideBySide' as const, label: tEvolution('modeSideBySide') },
                { id: 'flash' as const, label: tEvolution('modeFlash'), icon: true },
              ] as const
            ).map(({ id, label, icon }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={alignView === id ? 'secondary' : 'outline'}
                className="h-11 gap-1 text-xs"
                disabled={disabled}
                aria-pressed={alignView === id}
                onClick={() => onAlignView(id)}
              >
                {icon ? <FlipHorizontal2 className="h-3.5 w-3.5" /> : null}
                {label}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{tEvolution('spaceHint')}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={synced ? 'secondary' : 'outline'}
          className="h-11 gap-1.5 px-3"
          onClick={onToggleSynced}
          aria-pressed={synced}
          disabled={disabled}
        >
          {synced ? <Link2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
          <span className="text-xs">{tEvolution('syncImages')}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showGuides ? 'secondary' : 'outline'}
          className="h-11 px-3 text-xs"
          onClick={onToggleGuides}
          aria-pressed={showGuides}
          disabled={disabled}
        >
          {showGuides ? tEvolution('hideGuides') : tEvolution('showGuides')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 gap-1.5 px-3"
          onClick={onReset}
          disabled={disabled}
        >
          <RotateCcw className="h-4 w-4" />
          <span className="text-xs">{tEvolution('resetView')}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 gap-1.5 px-3"
          onClick={onToggleExpanded}
          aria-pressed={expanded}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span className="text-xs">
            {expanded ? tEvolution('exitFullscreen') : tEvolution('fullscreen')}
          </span>
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{tEvolution('regionPresets')}</p>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={tEvolution('regionPresets')}
        >
          {REGIONS.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={region === r ? 'secondary' : 'outline'}
              className="h-10 px-3 text-xs"
              onClick={() => onApplyRegion(r)}
              aria-pressed={region === r}
              disabled={disabled}
            >
              {regionLabel(r)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

type SheetProps = AdvancedCompareControlsProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
};

export function AdvancedCompareSheet({
  open,
  onOpenChange,
  title,
  description,
  ...controls
}: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-safe-bottom">
        <SheetHeader className="text-left">
          <SheetTitle>{title || tEvolution('adjustCompare')}</SheetTitle>
          <SheetDescription>{description || tEvolution('chooseWeeksHint')}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <AdvancedCompareControls {...controls} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
