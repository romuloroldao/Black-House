import { ClipboardCheck, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CheckinStreakInfo } from "@/lib/checkin-streak";

type CheckinStreakCardProps = {
  loading?: boolean;
  streak: CheckinStreakInfo | null;
  checkinDue?: boolean;
  onOpenCheckin: () => void;
};

const CheckinStreakCard = ({
  loading,
  streak,
  checkinDue,
  onOpenCheckin,
}: CheckinStreakCardProps) => {
  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!streak) return null;

  const pending = !streak.fez_esta_semana && Boolean(checkinDue);

  return (
    <Card
      className={cn(
        "border-border/60 shadow-card",
        pending && "border-primary/50 bg-primary/5 shadow-gold",
      )}
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full",
              pending ? "bg-primary text-primary-foreground" : "bg-primary/15",
            )}
          >
            {streak.semanas_consecutivas > 0 ? (
              <Flame className={cn("h-5 w-5", !pending && "text-primary")} />
            ) : (
              <ClipboardCheck className={cn("h-5 w-5", !pending && "text-primary")} />
            )}
          </div>
          <div>
            <p className="font-semibold leading-tight">
              {pending
                ? "Check-in pendente"
                : streak.semanas_consecutivas > 0
                  ? `${streak.semanas_consecutivas} semana${streak.semanas_consecutivas !== 1 ? "s" : ""} seguidas`
                  : "Check-in semanal"}
            </p>
            <p className="text-xs text-muted-foreground">
              {streak.fez_esta_semana
                ? "Um envio por semana — você já concluiu esta semana."
                : pending
                  ? "Ainda dá tempo esta semana. Peso, fotos e blocos curtos."
                  : "Um check-in por semana — mantenha o hábito com seu coach."}
            </p>
            {streak.badge && (
              <Badge variant="premium" className="student-badge-sm mt-1.5">
                {streak.badge}
              </Badge>
            )}
          </div>
        </div>
        {!streak.fez_esta_semana && (
          <Button
            type="button"
            size={pending ? "default" : "sm"}
            className={cn(
              "min-h-[var(--student-touch-min)]",
              pending && "h-11 px-4 font-semibold",
            )}
            onClick={onOpenCheckin}
          >
            {pending ? "Fazer agora" : "Fazer check-in"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CheckinStreakCard;
