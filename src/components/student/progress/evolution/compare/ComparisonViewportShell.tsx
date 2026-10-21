import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tEvolution } from '@/i18n/evolution-photos';
import { formatDateShort } from '@/lib/evolution-timeline';

type Props = {
  classifying?: boolean;
  missingBoth?: boolean;
  missingAngle?: boolean;
  missingAngleLabel?: string | null;
  partial?: boolean;
  beforeDate?: string | null;
  afterDate?: string | null;
  className?: string;
  children?: React.ReactNode;
};

export function ComparisonViewportShell({
  classifying,
  missingBoth,
  missingAngle,
  missingAngleLabel,
  partial,
  beforeDate,
  afterDate,
  className,
  children,
}: Props) {
  if (classifying) {
    return (
      <div
        className={cn(
          'flex min-h-[48dvh] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 text-center',
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">{tEvolution('classifyingPose')}</p>
      </div>
    );
  }

  if (missingBoth || missingAngle || partial) {
    const title = partial
      ? tEvolution('partialSlot')
      : missingAngle && missingAngleLabel
        ? tEvolution('missingAngleFor', { angle: missingAngleLabel })
        : tEvolution('emptySlot');
    const hint = partial ? tEvolution('partialSlotHint') : tEvolution('missingAngleHint');

    return (
      <div
        className={cn(
          'flex min-h-[48dvh] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center',
          className,
        )}
        role="status"
      >
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>
      </div>
    );
  }

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      {children}
      {(beforeDate || afterDate) && (
        <div className="mt-2 flex justify-between gap-2 px-0.5 text-[11px] tabular-nums text-muted-foreground">
          <span>{formatDateShort(beforeDate) || '—'}</span>
          <span>{formatDateShort(afterDate) || '—'}</span>
        </div>
      )}
    </div>
  );
}
