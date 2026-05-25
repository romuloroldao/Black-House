import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PremiumEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

const PremiumEmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: PremiumEmptyStateProps) => {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-border/60 bg-card/40 px-6 py-10 text-center shadow-card",
        className,
      )}
      role="status"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
        <Icon className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button type="button" className="mt-6 min-h-11" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default PremiumEmptyState;
