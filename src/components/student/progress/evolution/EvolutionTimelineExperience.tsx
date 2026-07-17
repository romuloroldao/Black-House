import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Camera,
  ChevronDown,
  Clock3,
  Eye,
  Scale,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  formatAgeLabel,
  formatDateShort,
  formatWeight,
  formatWeightDelta,
  getWeeksTracked,
  groupPhotosIntoCheckins,
  poseLabel,
  type EvolutionPhoto,
  type EvolutionTimelineItem,
} from '@/lib/evolution-timeline';
import { tEvolution } from '@/i18n/evolution-photos';
import { CompareEvolutionWorkspace } from './compare/CompareEvolutionWorkspace';

type Props = {
  photos: EvolutionPhoto[];
  readonly?: boolean;
  onDeletePhoto?: (photo: EvolutionPhoto) => void;
  onOpenCheckin?: () => void;
  className?: string;
};

type PhotoSelection = {
  item: EvolutionTimelineItem;
  photo: EvolutionPhoto;
  index: number;
} | null;

function MetricPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-background/70 px-3 py-2',
        tone === 'positive' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        tone === 'negative' && 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function deltaTone(delta: number | null): 'default' | 'positive' | 'negative' {
  if (delta == null || Math.abs(delta) < 0.05) return 'default';
  return delta < 0 ? 'positive' : 'negative';
}

function EvolutionSummaryBar({ items }: { items: EvolutionTimelineItem[] }) {
  const latest = items[0] ?? null;
  const weeksTracked = getWeeksTracked(items);

  return (
    <Card aria-label={tEvolution('progressSummary')} className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
        <MetricPill
          label={tEvolution('checkinsCompleted')}
          value={String(items.length)}
        />
        <MetricPill
          label={tEvolution('weeksTracked')}
          value={String(weeksTracked)}
        />
        <MetricPill
          label={tEvolution('lastCheckin')}
          value={latest ? formatAgeLabel(latest.date) : '-'}
        />
      </CardContent>
    </Card>
  );
}

function PhotoThumb({
  photo,
  index,
  featured = false,
  onOpen,
  onDelete,
  readonly,
}: {
  photo: EvolutionPhoto;
  index: number;
  featured?: boolean;
  readonly?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const label = poseLabel(photo.descricao, index);

  return (
    <div className={cn('group relative overflow-hidden rounded-xl border bg-muted', featured ? 'aspect-[3/4]' : 'aspect-square')}>
      <button
        type="button"
        className="h-full w-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onClick={onOpen}
        aria-label={`${tEvolution('viewPhoto')}: ${label}`}
      >
        <img
          src={photo.url}
          alt={label}
          loading={featured ? 'eager' : 'lazy'}
          className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-2 left-2 rounded-md bg-background/85 px-2 py-1 text-xs font-medium shadow-sm">
          {label}
        </span>
      </button>
      {!readonly && onDelete ? (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="absolute right-2 top-2 h-8 w-8 opacity-95"
          onClick={onDelete}
          aria-label={`Excluir ${label}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function CurrentCheckinHero({
  item,
  firstItem,
  onCompare,
  onOpenPhoto,
  onDeletePhoto,
  readonly,
}: {
  item: EvolutionTimelineItem;
  firstItem: EvolutionTimelineItem | null;
  readonly?: boolean;
  onCompare: (base: EvolutionTimelineItem, target?: EvolutionTimelineItem) => void;
  onOpenPhoto: (selection: PhotoSelection) => void;
  onDeletePhoto?: (photo: EvolutionPhoto) => void;
}) {
  const previousDelta = formatWeightDelta(item.deltaPreviousKg);
  const firstDelta = formatWeightDelta(item.deltaFirstKg);

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge className="mb-2">{tEvolution('currentState')}</Badge>
            <CardTitle className="text-2xl">{tEvolution('currentWeek')}</CardTitle>
            <CardDescription>
              {item.label} · {formatDateShort(item.date)}
            </CardDescription>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:min-w-52">
            <MetricPill label={tEvolution('weight')} value={formatWeight(item.pesoKg)} />
            {previousDelta ? (
              <MetricPill label={tEvolution('vsPrevious')} value={previousDelta} tone={deltaTone(item.deltaPreviousKg)} />
            ) : null}
            {firstDelta ? (
              <MetricPill label={tEvolution('vsFirst')} value={firstDelta} tone={deltaTone(item.deltaFirstKg)} />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {item.photos.slice(0, 4).map((photo, index) => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              index={index}
              featured
              readonly={readonly}
              onOpen={() => onOpenPhoto({ item, photo, index })}
              onDelete={onDeletePhoto ? () => onDeletePhoto(photo) : undefined}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="gap-2"
            onClick={() => onCompare(item, firstItem ?? undefined)}
            disabled={!firstItem || firstItem.id === item.id}
          >
            <ArrowLeftRight className="h-4 w-4" />
            {tEvolution('compareFromStart')}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => onOpenPhoto({ item, photo: item.photos[0], index: 0 })}>
            <Eye className="h-4 w-4" />
            {tEvolution('openPhotos')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckinEvolutionCard({
  item,
  isLast,
  onCompare,
  onOpenPhoto,
  onDeletePhoto,
  readonly,
}: {
  item: EvolutionTimelineItem;
  isLast: boolean;
  readonly?: boolean;
  onCompare: (item: EvolutionTimelineItem) => void;
  onOpenPhoto: (selection: PhotoSelection) => void;
  onDeletePhoto?: (photo: EvolutionPhoto) => void;
}) {
  const previousDelta = formatWeightDelta(item.deltaPreviousKg);

  return (
    <div className="relative grid gap-3 pl-8">
      <div className="absolute left-1.5 top-2 flex h-full flex-col items-center" aria-hidden>
        <span className={cn('h-4 w-4 rounded-full border-2 bg-background', item.isCurrent ? 'border-primary' : 'border-muted-foreground/40')} />
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
      </div>
      <Card className={cn('transition-all duration-200 motion-safe:hover:-translate-y-0.5', item.isCurrent && 'border-primary/25')}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {item.isCurrent ? tEvolution('currentWeek') : item.label}
              </CardTitle>
              <CardDescription>{formatDateShort(item.date)}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <Camera className="h-3.5 w-3.5" />
                {item.photos.length} {item.photos.length === 1 ? tEvolution('photo') : tEvolution('photos')}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Scale className="h-3.5 w-3.5" />
                {formatWeight(item.pesoKg)}
              </Badge>
              {previousDelta ? (
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {previousDelta}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {item.photos.slice(0, 4).map((photo, index) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                index={index}
                readonly={readonly}
                onOpen={() => onOpenPhoto({ item, photo, index })}
                onDelete={onDeletePhoto ? () => onDeletePhoto(photo) : undefined}
              />
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onCompare(item)}>
            <ArrowLeftRight className="h-4 w-4" />
            {tEvolution('compareWith')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CompareWeeksDialog({
  open,
  onOpenChange,
  items,
  initialCurrent,
  initialBaseline,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: EvolutionTimelineItem[];
  initialCurrent: EvolutionTimelineItem | null;
  initialBaseline: EvolutionTimelineItem | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-2 overflow-hidden rounded-none border-0 p-3 sm:h-auto sm:max-h-[96vh] sm:w-[min(96vw,1200px)] sm:max-w-[1200px] sm:rounded-lg sm:border sm:p-5">
        <DialogHeader className="shrink-0 space-y-0.5 pr-8 text-left">
          <DialogTitle className="text-lg sm:text-xl">{tEvolution('compareTitle')}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">{tEvolution('compareDescription')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <CompareEvolutionWorkspace
            items={items}
            initialCurrent={initialCurrent}
            initialBaseline={initialBaseline}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EvolutionPhotoLightbox({
  selection,
  onOpenChange,
}: {
  selection: PhotoSelection;
  onOpenChange: (open: boolean) => void;
}) {
  const open = Boolean(selection);
  const item = selection?.item ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? `${item.label} · ${formatDateShort(item.date)}` : tEvolution('viewPhoto')}</DialogTitle>
          <DialogDescription>{tEvolution('timelineDescription')}</DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {item.photos.map((photo, index) => (
              <figure key={photo.id} className="space-y-2">
                <div className="aspect-[3/4] overflow-hidden rounded-xl border bg-muted">
                  <img src={photo.url} alt={poseLabel(photo.descricao, index)} className="h-full w-full object-cover" />
                </div>
                <figcaption className="text-sm font-medium">{poseLabel(photo.descricao, index)}</figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CheckinTimeline({
  items,
  onCompare,
  onOpenPhoto,
  onDeletePhoto,
  readonly,
}: {
  items: EvolutionTimelineItem[];
  readonly?: boolean;
  onCompare: (item: EvolutionTimelineItem) => void;
  onOpenPhoto: (selection: PhotoSelection) => void;
  onDeletePhoto?: (photo: EvolutionPhoto) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="h-5 w-5" />
          {tEvolution('timelineTitle')}
        </CardTitle>
        <CardDescription>{tEvolution('timelineDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <CheckinEvolutionCard
            key={item.id}
            item={item}
            isLast={index === items.length - 1}
            readonly={readonly}
            onCompare={onCompare}
            onOpenPhoto={onOpenPhoto}
            onDeletePhoto={onDeletePhoto}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default function EvolutionTimelineExperience({
  photos,
  readonly = false,
  onDeletePhoto,
  onOpenCheckin,
  className,
}: Props) {
  const items = useMemo(() => groupPhotosIntoCheckins(photos), [photos]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareCurrent, setCompareCurrent] = useState<EvolutionTimelineItem | null>(null);
  const [compareBaseline, setCompareBaseline] = useState<EvolutionTimelineItem | null>(null);
  const [photoSelection, setPhotoSelection] = useState<PhotoSelection>(null);

  const current = items[0] ?? null;
  const first = items[items.length - 1] ?? null;

  const openCompare = (item: EvolutionTimelineItem, baseline = first) => {
    setCompareCurrent(item);
    setCompareBaseline(baseline);
    setCompareOpen(true);
  };

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <Camera className="h-14 w-14 text-muted-foreground/80" aria-hidden />
          <div>
            <p className="font-medium">{tEvolution('noPhotosTitle')}</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{tEvolution('noPhotosDescription')}</p>
          </div>
          {onOpenCheckin ? (
            <Button className="min-h-11" onClick={onOpenCheckin}>
              {tEvolution('currentWeek')}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <EvolutionSummaryBar items={items} />
      {current ? (
        <CurrentCheckinHero
          item={current}
          firstItem={first}
          readonly={readonly}
          onCompare={openCompare}
          onOpenPhoto={setPhotoSelection}
          onDeletePhoto={onDeletePhoto}
        />
      ) : null}
      <CheckinTimeline
        items={items}
        readonly={readonly}
        onCompare={(item) => openCompare(item)}
        onOpenPhoto={setPhotoSelection}
        onDeletePhoto={onDeletePhoto}
      />
      <CompareWeeksDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        items={items}
        initialCurrent={compareCurrent}
        initialBaseline={compareBaseline}
      />
      <EvolutionPhotoLightbox selection={photoSelection} onOpenChange={(open) => !open && setPhotoSelection(null)} />
    </div>
  );
}
