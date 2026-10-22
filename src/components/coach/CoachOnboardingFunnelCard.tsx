import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap } from "lucide-react";

type FunnelRow = { onboarding_id: string; state?: string; event_name?: string; total: number };

type FunnelResponse = {
  window_days: number;
  alunos_total: number;
  preferences: FunnelRow[];
  events_30d: FunnelRow[];
};

const LABELS: Record<string, string> = {
  "portal-overview": "Visão geral",
  "checkin-weekly": "Check-in",
  "hoje-coleman": "Hoje / Coleman",
  "treino-sessao": "Treino",
  "dieta-refeicao": "Dieta",
  "progresso-evolucao": "Evolução",
};

export default function CoachOnboardingFunnelCard() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiClient.requestSafe<FunnelResponse>(
        "/api/coach/me/onboarding-funnel",
      );
      if (cancelled) return;
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const byId = new Map<
      string,
      { id: string; viewed: number; completed: number; skipped: number; dismissed: number }
    >();

    for (const p of data.preferences || []) {
      const cur = byId.get(p.onboarding_id) || {
        id: p.onboarding_id,
        viewed: 0,
        completed: 0,
        skipped: 0,
        dismissed: 0,
      };
      if (p.state === "completed") cur.completed += p.total;
      if (p.state === "skipped") cur.skipped += p.total;
      if (p.state === "dismissed_permanently") cur.dismissed += p.total;
      if (p.state === "in_progress") cur.viewed += p.total;
      byId.set(p.onboarding_id, cur);
    }

    for (const e of data.events_30d || []) {
      const cur = byId.get(e.onboarding_id) || {
        id: e.onboarding_id,
        viewed: 0,
        completed: 0,
        skipped: 0,
        dismissed: 0,
      };
      if (e.event_name === "viewed") cur.viewed += e.total;
      byId.set(e.onboarding_id, cur);
    }

    return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [data]);

  return (
    <Card className="bg-gradient-card border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
          Tutoriais dos alunos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Últimos {data?.window_days ?? 30} dias · {data?.alunos_total ?? "—"} alunos no escopo
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Ainda sem interações de tutorial neste período.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <span className="font-medium">{LABELS[row.id] || row.id}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  vistos {row.viewed} · ok {row.completed} · pulados {row.skipped}
                  {row.dismissed > 0 ? ` · não ver ${row.dismissed}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
