import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { AdherenceCarteiraItem } from "@/types/adherence-carteira";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

export default function AdherenceCarteiraCard() {
  const [items, setItems] = useState<AdherenceCarteiraItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiClient.getAdherenceCarteiraSafe(7);
      if (cancelled) return;
      const list = res.success && Array.isArray(res.data?.items) ? res.data.items : [];
      setItems(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const attention = items.filter((i) => i.attention_score > 0).slice(0, 8);

  return (
    <Card className="bg-gradient-card border-0 shadow-card mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Carteira de aderência (7 dias)
        </CardTitle>
        <CardDescription>
          Taxas de refeição e treino, falhas e streak — clique para abrir o aluno
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum aluno a exigir atenção nesta janela de 7 dias.
          </p>
        ) : (
          <div className="space-y-2">
            {attention.map((item) => (
              <Link
                key={item.aluno_id}
                to={`/alunos/${item.aluno_id}`}
                className="flex w-full items-center gap-3 rounded-lg border border-border/70 p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.nome}</span>
                    {item.pending_checkin && (
                      <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-700 dark:text-amber-400">
                        Check-in pendente
                      </Badge>
                    )}
                    {item.queda_aderencia && (
                      <Badge variant="secondary" className="text-xs">
                        Queda de execução 7d
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dieta {formatPct(item.rates.meal_pct)} · Treino {formatPct(item.rates.workout_pct)} ·{" "}
                    {item.miss_days} {item.miss_days === 1 ? "falha" : "falhas"} · streak {item.streak_days}d
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
