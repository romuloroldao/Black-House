import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tEvolution } from '@/i18n/evolution-photos';
import { formatDateShort, formatWeight, formatWeightDelta } from '@/lib/evolution-timeline';

type Props = {
  beforeDate?: string | null;
  afterDate?: string | null;
  afterWeightKg?: number | null;
  pairDeltaKg?: number | null;
  onOpenPeriod: () => void;
  className?: string;
};

export function ComparisonPeriodHeader({
  beforeDate,
  afterDate,
  afterWeightKg,
  pairDeltaKg,
  onOpenPeriod,
  className,
}: Props) {
  const beforeLabel = formatDateShort(beforeDate);
  const afterLabel = formatDateShort(afterDate);
  const deltaLabel = formatWeightDelta(pairDeltaKg ?? null);
  const deltaTone =
    pairDeltaKg == null || Math.abs(pairDeltaKg) < 0.05
      ? undefined
      : pairDeltaKg < 0
        ? 'pos'
        : 'neg';

  return (
    <header className={cn('shrink-0 space-y-2 text-center', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {tEvolution('compareTitle')}
      </p>
      <button
        type="button"
        onClick={onOpenPeriod}
        className={cn(
          'mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/70',
          'bg-background/90 px-4 text-sm font-semibold tabular-nums',
          'motion-safe:active:scale-[0.98] motion-safe:transition-transform',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label={tEvolution('changePeriod')}
      >
        <span>
          {beforeLabel || '—'}
          <span className="mx-1.5 text-muted-foreground">→</span>
          {afterLabel || '—'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
      </button>

      {(afterWeightKg != null || deltaLabel) && (
        <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-0.5" aria-label={tEvolution('metricsPanel')}>
          {afterWeightKg != null ? (
            <p className="text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
              {formatWeight(afterWeightKg)}
            </p>
          ) : null}
          {deltaLabel ? (
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                deltaTone === 'pos' && 'text-emerald-600 dark:text-emerald-400',
                deltaTone === 'neg' && 'text-amber-600 dark:text-amber-400',
              )}
            >
              {deltaLabel}
              <span className="ml-1 font-normal text-muted-foreground">
                {tEvolution('vsPair')}
              </span>
            </p>
          ) : null}
        </div>
      )}
    </header>
  );
}
