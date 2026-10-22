import { CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardingStep } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  title: string;
  step: OnboardingStep | null;
  stepIndex: number;
  stepCount: number;
  onNext: () => void;
  onSkip: () => void;
  onDismissPermanently: () => void;
  onClose?: () => void;
};

/**
 * Painel compacto de onboarding contextual — não usa modal full-screen.
 * Destaca o alvo via atributo data-onboarding-active (CSS global).
 */
export function FeatureOnboardingPanel({
  open,
  title,
  step,
  stepIndex,
  stepCount,
  onNext,
  onSkip,
  onDismissPermanently,
  onClose,
}: Props) {
  if (!open || !step) return null;

  const isLast = stepIndex >= stepCount - 1;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[110] flex justify-center px-3",
        "bottom-[calc(var(--student-bottom-nav-total)+0.75rem)] md:bottom-4",
      )}
      role="dialog"
      aria-modal="false"
      aria-labelledby="feature-onboarding-title"
      aria-describedby="feature-onboarding-body"
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md rounded-xl border border-border/80",
          "bg-background/95 p-4 shadow-lg backdrop-blur-sm",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
          "motion-reduce:animate-none",
        )}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <h2 id="feature-onboarding-title" className="text-base font-semibold leading-tight">
              {step.title}
            </h2>
          </div>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onClose}
              aria-label="Fechar orientação"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <p id="feature-onboarding-body" className="text-sm text-muted-foreground">
          {step.body}
        </p>

        <div className="mt-3 flex gap-1.5" aria-hidden>
          {Array.from({ length: stepCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors motion-reduce:transition-none",
                i <= stepIndex ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" className="min-h-10 px-2 text-xs" onClick={onSkip}>
              Pular
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 px-2 text-xs text-muted-foreground"
              onClick={onDismissPermanently}
            >
              Não ver de novo
            </Button>
          </div>
          <Button type="button" className="min-h-10" onClick={onNext}>
            {isLast ? "Entendi" : "Seguinte"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type HelpProps = {
  onClick: () => void;
  label?: string;
  className?: string;
};

export function FeatureOnboardingHelpButton({
  onClick,
  label = "Como usar",
  className,
}: HelpProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("min-h-9 gap-1.5 text-muted-foreground", className)}
      onClick={onClick}
      aria-label={label}
    >
      <CircleHelp className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}

export default FeatureOnboardingPanel;
