import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DietRotationDayInfo } from "@/lib/diet-rotation";

type DietRotationBannerProps = {
  info: DietRotationDayInfo;
};

const DietRotationBanner = ({ info }: DietRotationBannerProps) => (
  <div className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3">
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
        <RefreshCw className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold leading-tight">{info.todayLabel}</p>
        <p className="text-xs text-muted-foreground">
          Ciclo definido pelo coach: {info.cycleSummary}. Não precisa alternar manualmente — siga
          o plano de hoje.
        </p>
      </div>
      <Badge variant="premium" className="shrink-0 text-sm">
        Plano {info.plano}
      </Badge>
    </div>
  </div>
);

export default DietRotationBanner;
