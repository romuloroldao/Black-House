import { AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ProfileCompletenessStatus } from "@/types/profile-completeness";
import { PROFILE_FIELD_LABELS, type ProfileFieldKey } from "@/types/profile-completeness";

type Props = {
  status: ProfileCompletenessStatus;
  onComplete: () => void;
  compact?: boolean;
};

export default function ProfileCompletenessBanner({ status, onComplete, compact }: Props) {
  if (status.is_complete) return null;

  const missingLabels = status.missing_fields
    .slice(0, 3)
    .map((f) => PROFILE_FIELD_LABELS[f as ProfileFieldKey] || f)
    .join(", ");

  if (compact) {
    return (
      <button
        type="button"
        onClick={onComplete}
        className="flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm transition-colors hover:bg-amber-500/15"
      >
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="min-w-0 flex-1 truncate">
          Perfil {status.completion_pct}% — complete para liberar check-in
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-transparent p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-foreground">Perfil incompleto</p>
          <p className="text-sm text-muted-foreground">
            {status.hard_gate_active
              ? "Complete seus dados para enviar check-in e comentários nos relatórios."
              : "Em breve algumas funções exigirão perfil completo. Leva cerca de 2 minutos."}
          </p>
          {missingLabels && (
            <p className="text-xs text-muted-foreground">Faltam: {missingLabels}</p>
          )}
        </div>
        <Button type="button" size="sm" onClick={onComplete}>
          Completar perfil
        </Button>
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progresso do cadastro</span>
          <span>{status.completion_pct}%</span>
        </div>
        <Progress value={status.completion_pct} className="h-2" />
      </div>
    </div>
  );
}
