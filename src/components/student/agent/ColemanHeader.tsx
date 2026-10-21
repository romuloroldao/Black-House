import { cn } from "@/lib/utils";

type ColemanHeaderProps = {
  className?: string;
  compact?: boolean;
};

/**
 * Identidade interna do agente — não substitui o logo Black House.
 */
export function ColemanHeader({ className, compact = false }: ColemanHeaderProps) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2.5 border-b border-border/50 bg-card/80 px-3 py-2 sm:px-4",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
          compact ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm",
        )}
        aria-hidden
      >
        C
      </div>
      <div className="min-w-0">
        <p className={cn("font-semibold tracking-wide text-foreground", compact ? "text-sm" : "text-sm sm:text-base")}>
          COLEMAN
        </p>
        {!compact ? (
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
            Seu especialista em nutrição e performance
          </p>
        ) : null}
      </div>
    </header>
  );
}

export default ColemanHeader;
