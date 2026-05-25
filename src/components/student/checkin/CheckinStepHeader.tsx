import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CHECKIN_SECTIONS, type CheckinSectionId } from "@/lib/checkin-sections";

type CheckinStepHeaderProps = {
  step: number;
  completedSections: number;
};

const CheckinStepHeader = ({ step, completedSections }: CheckinStepHeaderProps) => {
  const current = CHECKIN_SECTIONS[step];
  const pct = Math.round(((step + 1) / CHECKIN_SECTIONS.length) * 100);

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-4 space-y-3 rounded-lg border border-border/60 bg-background/95 p-3 backdrop-blur md:top-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          Bloco {step + 1} de {CHECKIN_SECTIONS.length}: {current.title}
        </span>
        <span className="text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex gap-1">
        {CHECKIN_SECTIONS.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < completedSections
                ? "bg-primary"
                : i === step
                  ? "bg-primary/50"
                  : "bg-muted",
            )}
            title={s.title}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{current.description}</p>
    </div>
  );
};

export default CheckinStepHeader;
