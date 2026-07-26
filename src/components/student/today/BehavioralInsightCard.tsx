import { Flame, AlertCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlunoHojeBehavioralInsight } from "@/types/aluno-hoje";

type BehavioralInsightCardProps = {
  insight: AlunoHojeBehavioralInsight | null | undefined;
  loading?: boolean;
};

const BehavioralInsightCard = ({ insight, loading }: BehavioralInsightCardProps) => {
  if (loading || !insight?.available || !insight.text) return null;

  const Icon =
    insight.tone === "positive" ? Flame : insight.tone === "nudge" ? AlertCircle : Activity;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm",
        insight.tone === "positive" && "border-primary/25 bg-primary/5",
        insight.tone === "nudge" && "border-amber-500/25 bg-amber-500/5",
        insight.tone === "neutral" && "border-border bg-muted/40",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          insight.tone === "positive" && "text-primary",
          insight.tone === "nudge" && "text-amber-600",
          insight.tone === "neutral" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0 space-y-0.5">
        <p className="leading-snug text-foreground">{insight.text}</p>
        {insight.streak_days != null && insight.streak_days > 0 && (
          <p className="text-xs text-muted-foreground">
            Streak execução: {insight.streak_days} dia{insight.streak_days === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
};

export default BehavioralInsightCard;
