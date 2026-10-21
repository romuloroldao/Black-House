import { cn } from '@/lib/utils';
import { tEvolution } from '@/i18n/evolution-photos';

const GUIDE_LINES = [
  { key: 'head', top: '12%' },
  { key: 'shoulders', top: '24%' },
  { key: 'chest', top: '36%' },
  { key: 'waist', top: '50%' },
  { key: 'hips', top: '62%' },
  { key: 'knees', top: '78%' },
] as const;

type Props = {
  visible: boolean;
  className?: string;
};

/** Linhas guia discretas para alinhar regiões do corpo entre fotos. */
export function AlignmentGuides({ visible, className }: Props) {
  if (!visible) return null;

  const labels: Record<(typeof GUIDE_LINES)[number]['key'], string> = {
    head: tEvolution('guideHead'),
    shoulders: tEvolution('guideShoulders'),
    chest: tEvolution('guideChest'),
    waist: tEvolution('guideWaist'),
    hips: tEvolution('guideHips'),
    knees: tEvolution('guideKnees'),
  };

  return (
    <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      {GUIDE_LINES.map((line) => (
        <div key={line.key} className="absolute left-0 right-0" style={{ top: line.top }}>
          <div className="h-px w-full bg-primary/35" />
          <span className="absolute left-1 top-0 -translate-y-1/2 rounded bg-background/70 px-1 text-[9px] font-medium text-muted-foreground">
            {labels[line.key]}
          </span>
        </div>
      ))}
    </div>
  );
}
