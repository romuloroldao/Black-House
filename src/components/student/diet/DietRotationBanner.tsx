import { AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DietRotationDayInfo } from "@/lib/diet-rotation";

type DietRotationBannerProps = {
  info: DietRotationDayInfo;
  /** Ciclo pede um plano que não existe nas refeições rotuladas. */
  missingMeals?: boolean;
};

const DietRotationBanner = ({ info, missingMeals = false }: DietRotationBannerProps) => (
  <div
    className={
      missingMeals
        ? "rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3"
        : "rounded-xl border border-primary/25 bg-primary/10 px-4 py-3"
    }
  >
    <div className="flex flex-wrap items-start gap-3">
      <div
        className={
          missingMeals
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20"
            : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20"
        }
      >
        {missingMeals ? (
          <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden />
        ) : (
          <RefreshCw className="h-5 w-5 text-primary" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold leading-tight">{info.todayLabel}</p>
        <p className="text-xs text-muted-foreground">
          {missingMeals
            ? `O ciclo aponta Plano ${info.plano}, mas as refeições deste cardápio não têm esse rótulo. Peça ao coach para completar o Plano ${info.plano} (ou ajustar a rotação).`
            : `Ciclo definido pelo coach: ${info.cycleSummary}. Não precisa alternar manualmente — siga o plano de hoje.`}
        </p>
      </div>
      <Badge variant={missingMeals ? "secondary" : "premium"} className="shrink-0 text-sm">
        Plano {info.plano}
      </Badge>
    </div>
  </div>
);

export default DietRotationBanner;
