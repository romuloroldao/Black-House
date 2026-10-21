import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import type { AdherenceCarteiraItem } from "@/types/adherence-carteira";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ChevronRight } from "lucide-react";

type CoachAdherenceCarteiraCardProps = {
  onOpenCheckins?: () => void;
};

function rateLabel(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct}%`;
}

export default function CoachAdherenceCarteiraCard({
  onOpenCheckins,
}: CoachAdherenceCarteiraCardProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdherenceCarteiraItem[]>([]);
  const [dropCount, setDropCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiClient.getAdherenceCarteiraSafe(7);
      if (cancelled) return;
      if (res.success && res.data) {
        setItems(res.data.items.filter((i) => i.attention_score > 0).slice(0, 8));
        setDropCount(res.data.drop_count);
        setPendingCount(res.data.pending_checkin_count);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="bg-gradient-card border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Aderência 7 dias
        </CardTitle>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Badge variant="destructive">{pendingCount} check-in</Badge>
          )}
          {dropCount > 0 && (
            <Badge variant="secondary">{dropCount} queda</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma queda de execução nem check-in pendente nesta semana.
          </p>
        ) : (
          items.map((row) => (
            <button
              key={row.aluno_id}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50"
              onClick={() => navigate(`/alunos/${row.aluno_id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.nome}</p>
                <p className="text-xs text-muted-foreground">
                  Dieta {rateLabel(row.rates.meal_pct)} · Treino {rateLabel(row.rates.workout_pct)}
                  {row.miss_days_recent > 0 ? ` · ${row.miss_days_recent} falhas` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {row.checkin_pendente && (
                  <Badge variant="destructive" className="text-[10px]">
                    Check-in
                  </Badge>
                )}
                {row.adherence_drop && (
                  <Badge variant="outline" className="text-[10px]">
                    Queda
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
        {onOpenCheckins && (
          <Button variant="outline" className="mt-2 w-full" onClick={onOpenCheckins}>
            Abrir inbox de check-ins
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
