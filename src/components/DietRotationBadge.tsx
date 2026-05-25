import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRotationBadgeLabel, type DietRotationConfig } from "@/lib/diet-rotation";
import { RefreshCw } from "lucide-react";

type DietRotationBadgeProps = {
  config: DietRotationConfig | Record<string, unknown> | null | undefined;
  className?: string;
};

export function DietRotationBadge({ config, className }: DietRotationBadgeProps) {
  const label = formatRotationBadgeLabel(config as DietRotationConfig);
  if (!label) return null;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 font-normal border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
        className,
      )}
    >
      <RefreshCw className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      {label}
    </Badge>
  );
}
