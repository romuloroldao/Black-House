import { ClipboardPenLine, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContinueCheckinBannerProps = {
  visible: boolean;
  onContinue: () => void;
  className?: string;
};

/**
 * CTA visível na home quando o aluno já começou o check-in (rascunho local).
 * Sem isto o rascunho é “invisível” e parece que nada mudou.
 */
const ContinueCheckinBanner = ({
  visible,
  onContinue,
  className,
}: ContinueCheckinBannerProps) => {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-3 shadow-gold",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-300",
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <ClipboardPenLine className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">
            Check-in em andamento
          </p>
          <p className="student-caption mt-0.5 text-foreground/70">
            Suas respostas estão guardadas neste aparelho. Continue de onde parou.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-11 shrink-0 gap-1 px-3 font-semibold"
          onClick={onContinue}
        >
          Continuar
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
};

export default ContinueCheckinBanner;
