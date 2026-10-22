import { Check, Save } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  CHECKIN_SECTIONS,
  getCheckinSectionDescId,
  getCheckinSectionTitleId,
} from "@/lib/checkin-sections";

type CheckinStepHeaderProps = {
  step: number;
  completedSections: number;
  hasDraft?: boolean;
  onSelectStep?: (index: number) => void;
};

const CheckinStepHeader = ({
  step,
  completedSections,
  hasDraft = false,
  onSelectStep,
}: CheckinStepHeaderProps) => {
  const current = CHECKIN_SECTIONS[step];
  const pct = Math.round(((step + 1) / CHECKIN_SECTIONS.length) * 100);

  return (
    <div className="sticky top-0 z-10 -mx-1 space-y-2.5 rounded-xl border border-primary/25 bg-background/95 p-3 shadow-sm backdrop-blur md:top-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Check-in semanal
          </p>
          <h3
            id={getCheckinSectionTitleId(current.id)}
            className="text-base font-semibold leading-tight sm:text-lg"
          >
            Bloco {step + 1}/{CHECKIN_SECTIONS.length}: {current.title}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">
            {pct}%
          </span>
          {hasDraft ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground/70">
              <Save className="h-3 w-3 text-primary" aria-hidden />
              Rascunho salvo
            </span>
          ) : null}
        </div>
      </div>

      <Progress value={pct} className="h-2.5" />

      <div
        className="grid grid-cols-5 gap-1.5"
        role="tablist"
        aria-label="Blocos do check-in"
      >
        {CHECKIN_SECTIONS.map((s, i) => {
          const isCurrent = i === step;
          const done = i < step || (!isCurrent && i < completedSections);
          // Pode voltar a qualquer bloco já visitado / abaixo do atual
          const canJump = Boolean(onSelectStep) && i <= step;
          const short = s.title.split(" ")[0];

          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-current={isCurrent ? "step" : undefined}
              disabled={!canJump}
              title={s.title}
              onClick={() => canJump && onSelectStep?.(i)}
              className={cn(
                "flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1.5 text-center transition-colors",
                "motion-safe:active:scale-[0.98]",
                isCurrent &&
                  "border-primary bg-primary text-primary-foreground shadow-gold",
                !isCurrent &&
                  done &&
                  "border-primary/40 bg-primary/10 text-foreground",
                !isCurrent &&
                  !done &&
                  "border-border/70 bg-muted/40 text-muted-foreground",
                canJump && !isCurrent && "cursor-pointer hover:border-primary/60",
                !canJump && "cursor-default opacity-80",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  isCurrent
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-foreground/20",
                )}
              >
                {done && !isCurrent ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className="max-w-full truncate text-[9px] font-medium leading-none sm:text-[10px]">
                {short}
              </span>
            </button>
          );
        })}
      </div>

      <p id={getCheckinSectionDescId(current.id)} className="text-xs text-foreground/75">
        {current.description}
      </p>
    </div>
  );
};

export default CheckinStepHeader;
