import { CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReturnCountdownInfo } from "@/lib/student-portal-utils";

type ReturnCountdownBannerProps = {
  loading?: boolean;
  countdown: ReturnCountdownInfo | null;
};

const ReturnCountdownBanner = ({ loading, countdown }: ReturnCountdownBannerProps) => {
  if (loading) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-card">
        <CardContent className="flex items-center gap-4 p-4 sm:p-5">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!countdown) return null;

  const dateFormatted = new Date(`${countdown.date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const sourceLabel = countdown.source === "dieta" ? "Plano nutricional" : "Plano de treino";
  const absDays = Math.abs(countdown.days);

  return (
    <Card
      className={
        countdown.overdue
          ? "border-destructive/40 bg-gradient-to-br from-destructive/10 to-transparent shadow-card"
          : "border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-card"
      }
    >
      <CardContent className="flex items-start gap-4 p-4 sm:items-center sm:p-5">
        <div
          className={
            countdown.overdue
              ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/15"
              : "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15"
          }
        >
          <CalendarClock
            className={
              countdown.overdue ? "h-6 w-6 text-destructive" : "h-6 w-6 text-primary"
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold leading-tight">{countdown.label}</p>
            <Badge variant={countdown.overdue ? "destructive" : "premium"}>
              {countdown.overdue ? "Atrasado" : absDays <= 7 ? "Em breve" : "Agendado"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateFormatted}
            {countdown.planName ? ` · ${countdown.planName}` : ""}
            {" · "}
            {sourceLabel}
          </p>
        </div>
        {!countdown.overdue && absDays <= 14 && (
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-3xl font-bold tabular-nums text-primary">{absDays}</p>
            <p className="text-xs text-muted-foreground">dias</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReturnCountdownBanner;
