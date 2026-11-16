import { AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DietRotationDayInfo } from "@/lib/diet-rotation";

type DietRotationBannerProps = {
  info: DietRotationDayInfo;
  /** "Hoje", "Amanhã", "qua., 12/11"… (default: "Hoje"). */
  dayLabel?: string;
  /** Aviso quando o ciclo pede um plano sem refeições cadastradas. */
  missingMealsMessage?: string | null;
};

const DietRotationBanner = ({ info, dayLabel = "Hoje", missingMealsMessage = null }: DietRotationBannerProps) => {
  const isToday = dayLabel === "Hoje";
  const title = info.beforeStart
    ? `Ciclo ainda não começou · ${dayLabel}: Plano ${info.plano}`
    : `${dayLabel}: Plano ${info.plano} (dia ${info.dayInBlock} de ${info.blockLength})`;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <RefreshCw className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">
            Ciclo definido pelo coach: {info.cycleSummary}.{" "}
            {isToday
              ? "Não precisa alternar manualmente — siga o plano de hoje."
              : "Use as setas para ver os próximos dias do ciclo."}
          </p>
          {missingMealsMessage ? (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{missingMealsMessage}</span>
            </p>
          ) : null}
        </div>
        <Badge variant="premium" className="shrink-0 text-sm">
          Plano {info.plano}
        </Badge>
      </div>
    </div>
  );
};

export default DietRotationBanner;
