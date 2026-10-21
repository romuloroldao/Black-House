import { cn } from '@/lib/utils';
import { tEvolution } from '@/i18n/evolution-photos';
import type { EvolutionPhotoPose } from '@/lib/evolution-timeline';

export type PoseOption = {
  value: string;
  label: string;
  pose?: EvolutionPhotoPose;
  index?: number;
};

type Props = {
  options: PoseOption[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function AnglePoseSelector({ options, value, onChange, disabled, className }: Props) {
  if (!options.length) return null;

  return (
    <div
      className={cn('flex flex-wrap justify-center gap-1.5', className)}
      role="group"
      aria-label={tEvolution('pose')}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'min-h-11 min-w-[4.5rem] rounded-full border px-3.5 text-xs font-medium sm:text-sm',
              'motion-safe:transition-all motion-safe:duration-150',
              'motion-safe:active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50',
              selected
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border/70 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
