import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCheckinPrioridadeSummary, isCheckinPrioridade } from "@/lib/checkin-highlights";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";
import { cn } from "@/lib/utils";

type CheckinPriorityBadgeProps = {
  checkin: WeeklyCheckinRecord;
  className?: string;
  showTooltip?: boolean;
};

export default function CheckinPriorityBadge({
  checkin,
  className,
  showTooltip = true,
}: CheckinPriorityBadgeProps) {
  if (!isCheckinPrioridade(checkin)) return null;

  const summary = getCheckinPrioridadeSummary(checkin);

  const badge = (
    <Badge
      variant="destructive"
      className={cn("gap-1 text-xs font-semibold", className)}
    >
      <AlertTriangle className="h-3 w-3" />
      Prioridade
    </Badge>
  );

  if (!showTooltip || !summary) return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-sm">
          {summary}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
