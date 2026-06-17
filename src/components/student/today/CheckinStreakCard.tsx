import { ClipboardCheck, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <Card className="border-border/60 shadow-card">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            {streak.semanas_consecutivas > 0 ? (
              <Flame className="h-5 w-5 text-primary" />
            ) : (
              <ClipboardCheck className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <p className="font-semibold leading-tight">
              {streak.semanas_consecutivas > 0
                ? `${streak.semanas_consecutivas} semana${streak.semanas_consecutivas !== 1 ? "s" : ""} seguidas`
                : "Check-in semanal"}
            </p>
            <p className="text-xs text-muted-foreground">
              {streak.fez_esta_semana
                ? "Um envio por semana — você já concluiu esta semana."
                : checkinDue
                  ? "Pendente: um check-in por semana (até domingo)."
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
          <Button type="button" size="sm" onClick={onOpenCheckin}>
            Fazer check-in
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CheckinStreakCard;
