import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FINANCIAL_PATHS } from "@/lib/financial-routes";

export interface SyncHealth {
  initial_sync_status?: string;
  orphans_count?: number;
  conflicts_count?: number;
  inbox_pending_count?: number;
}

interface IntegrationHealthBannerProps {
  health: SyncHealth | null;
  compact?: boolean;
}

function hasIssues(health: SyncHealth): boolean {
  return (
    (health.orphans_count ?? 0) > 0 ||
    (health.conflicts_count ?? 0) > 0 ||
    (health.inbox_pending_count ?? 0) > 0 ||
    (health.initial_sync_status && health.initial_sync_status !== "completed")
  );
}

export function IntegrationHealthBanner({ health, compact = false }: IntegrationHealthBannerProps) {
  if (!health) return null;

  const issues = hasIssues(health);
  const Icon = issues ? AlertTriangle : CheckCircle2;

  if (compact) {
    return (
      <Card className={issues ? "border-destructive/50" : "border-primary/30"}>
        <CardContent className="py-3 px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Icon className={issues ? "h-4 w-4 text-destructive" : "h-4 w-4 text-primary"} />
            <span>Integração Asaas: {issues ? "atenção necessária" : "OK"}</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={FINANCIAL_PATHS.integration}>
              Ver <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={issues ? "border-destructive/50" : ""}>
      <CardContent className="py-4 flex flex-wrap items-center gap-2">
        <Icon className={issues ? "h-5 w-5 text-destructive" : "h-5 w-5 text-primary"} />
        <span className="font-medium text-sm">Integração Asaas</span>
        <Badge variant="outline">Sync: {health.initial_sync_status || "pending"}</Badge>
        {(health.orphans_count ?? 0) > 0 && (
          <Badge variant="destructive">Órfãos: {health.orphans_count}</Badge>
        )}
        {(health.conflicts_count ?? 0) > 0 && (
          <Badge variant="outline">Conflitos: {health.conflicts_count}</Badge>
        )}
        {(health.inbox_pending_count ?? 0) > 0 && (
          <Badge variant="outline">Fila: {health.inbox_pending_count}</Badge>
        )}
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link to={FINANCIAL_PATHS.integration}>Gerir integração</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
