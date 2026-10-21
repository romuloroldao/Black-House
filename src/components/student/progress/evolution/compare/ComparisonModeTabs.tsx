import { cn } from '@/lib/utils';
import { tEvolution } from '@/i18n/evolution-photos';
import type { CompareUiMode } from './viewport-types';

const MODES: { id: CompareUiMode; labelKey: 'modeCompare' | 'modeSideBySide' | 'modeAlign' }[] = [
  { id: 'compare', labelKey: 'modeCompare' },
  { id: 'sideBySide', labelKey: 'modeSideBySide' },
  { id: 'align', labelKey: 'modeAlign' },
];

type Props = {
  value: CompareUiMode;
  onChange: (mode: CompareUiMode) => void;
  disabled?: boolean;
  className?: string;
};

export function ComparisonModeTabs({ value, onChange, disabled, className }: Props) {
  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1',
        className,
      )}
      role="tablist"
      aria-label={tEvolution('compareModes')}
    >
      {MODES.map(({ id, labelKey }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              'min-h-11 rounded-lg px-2 text-xs font-medium sm:text-sm',
              'motion-safe:transition-colors motion-safe:duration-150',
              'motion-safe:active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tEvolution(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
