import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Dumbbell, TrendingUp, Minus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { rechartsLegendProps, rechartsTooltipProps } from "@/lib/recharts-theme";
import { useTreinoEvolucao } from "@/hooks/useTreinoEvolucao";
import type {
  WorkoutEvolutionResponse,
  WorkoutEvolutionTone,
  WorkoutExerciseStatus,
} from "@/types/treino-evolucao";
import PremiumEmptyState from "@/components/student/PremiumEmptyState";

/** YYYY-MM-DD sem Date: evita o dia anterior em fuso UTC−3. */
function formatDay(iso?: string | null) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}`;
}

function weekDescription(data?: WorkoutEvolutionResponse | null) {
  if (data?.is_fallback && data.week?.start && data.week?.end) {
    return `Última semana com treinos: ${formatDay(data.week.start)} a ${formatDay(data.week.end)}.`;
  }
  if (!data?.week?.start || !data?.week?.end) {
    return "Como seu treino evoluiu nesta semana.";
  }
  return `Semana de ${formatDay(data.week.start)} a ${formatDay(data.week.end)}.`;
}

const CHART_STROKES = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

const STATUS_LABEL: Record<WorkoutExerciseStatus, string> = {
  subiu_carga: "Carga subiu",
  subiu_reps: "Reps subiram",
  estavel: "Estável",
  abaixo_ultimo: "Abaixo do último registro",
  novo: "Exercício novo",
  dados_incompletos: "Dados incompletos",
  unidade_mista: "Unidade diferente",
};

const STATUS_RANK: Record<WorkoutExerciseStatus, number> = {
  abaixo_ultimo: 0,
  subiu_carga: 1,
  subiu_reps: 2,
  estavel: 3,
  unidade_mista: 4,
  dados_incompletos: 5,
  novo: 6,
};

type WorkoutEvolutionSectionProps = {
  alunoId?: string | null;
  asOf?: string;
  /** coach vê lista completa; aluno vê hierarquia curta */
  audience?: "aluno" | "coach";
  compact?: boolean;
  className?: string;
};

function toneClass(tone: WorkoutEvolutionTone) {
  if (tone === "positive") return "text-primary";
  if (tone === "attention") return "text-destructive";
  if (tone === "insufficient") return "text-muted-foreground";
  return "text-foreground";
}

function HighlightItem({
  title,
  name,
  detail,
}: {
  title: string;
  name?: string;
  detail?: string | null;
}) {
  if (!name) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-sm font-semibold">{name}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function EvolutionChart({ data }: { data: WorkoutEvolutionResponse }) {
  const series = data.primary_chart.series;
  const chartData = useMemo(() => {
    if (!series.length) return [];
    const labels = series[0]?.points || [];
    return labels.map((point, idx) => {
      const row: Record<string, string | number | null> = { label: point.label };
      for (const s of series) {
        row[s.exercise_name] = s.points[idx]?.carga ?? null;
      }
      return row;
    });
  }, [series]);

  if (data.primary_chart.type !== "load" || chartData.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Performance de treino</p>
        {data.chart_comment ? (
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.chart_comment.title}. </span>
            {data.chart_comment.body}
          </p>
        ) : null}
      </div>
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} width={36} />
            <Tooltip {...rechartsTooltipProps} />
            <Legend {...rechartsLegendProps} />
            {series.map((s, i) => (
              <Line
                key={s.exercise_name}
                type="monotone"
                dataKey={s.exercise_name}
                stroke={CHART_STROKES[i % CHART_STROKES.length]}
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function WorkoutEvolutionSection({
  alunoId,
  asOf,
  audience = "aluno",
  compact = false,
  className,
}: WorkoutEvolutionSectionProps) {
  const { data, loading, error } = useTreinoEvolucao({
    alunoId,
    asOf,
    enabled: true,
  });

  if (loading) {
    return (
      <Card className={cn("shadow-card", className)}>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <Skeleton className="h-6 w-48" />
          {!compact ? <Skeleton className="h-4 w-64" /> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className={compact ? "h-12 w-full" : "h-16 w-full"} />
          {!compact ? <Skeleton className="h-40 w-full" /> : null}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("shadow-card", className)}>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Evolução do treino</CardTitle>
          <CardDescription>Como seu treino evoluiu nesta semana.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.empty || data.confidence === "none") {
    const emptyCopy =
      data?.headline.body ||
      "Continue registrando suas cargas e repetições no treino para acompanhar a evolução.";
    return (
      <Card className={cn("shadow-card", className)}>
        <CardHeader className={compact ? "pb-2" : undefined}>
          <CardTitle className="text-lg sm:text-xl">Evolução do treino</CardTitle>
          <CardDescription>{weekDescription(data)}</CardDescription>
        </CardHeader>
        <CardContent>
          {compact ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Dumbbell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{emptyCopy}</span>
            </p>
          ) : (
            <PremiumEmptyState
              icon={Dumbbell}
              title="Precisamos de mais dados"
              description={emptyCopy}
              className="min-h-[200px] border-0 bg-transparent py-6 shadow-none"
            />
          )}
        </CardContent>
      </Card>
    );
  }

  const listedExercises = [...data.exercises].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name, "pt");
  });
  const hiddenNovos = Math.max(
    0,
    (data.counts?.novo || 0) - listedExercises.filter((e) => e.status === "novo").length,
  );
  const showChart = !compact && data.confidence !== "low" && data.primary_chart.type === "load";
  const showVolume = !compact && audience === "coach" && data.volume_chart;
  const highlights = data.highlights;
  const compactHighlights = compact
    ? Boolean(highlights.maior_carga || highlights.atencao)
    : Boolean(
        highlights.maior_carga || highlights.maior_reps || highlights.estavel || highlights.atencao,
      );

  return (
    <Card className={cn("shadow-card", className)}>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg sm:text-xl">Evolução do treino</CardTitle>
          {data.is_fallback ? (
            <Badge variant="outline" className="text-[11px]">
              Última semana com treinos
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px]">
              {data.confidence === "high" ? "Dados suficientes" : data.confidence === "medium" ? "Leitura provisória" : "Poucos registros"}
            </Badge>
          )}
        </div>
        <CardDescription>{weekDescription(data)}</CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-5", compact && "space-y-3")}>
        {data.is_fallback && data.fallback_label ? (
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {data.fallback_label}
          </p>
        ) : null}
        <div>
          <p className={cn("text-base font-semibold sm:text-lg", toneClass(data.headline.tone))}>
            {data.headline.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{data.headline.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">{data.confidence_label}</p>
        </div>

        {data.insights.length > 0 && (
          <ul className="space-y-1.5">
            {data.insights.slice(0, compact ? 2 : audience === "coach" ? 5 : 3).map((insight) => (
              <li key={insight.kind + insight.text} className="flex gap-2 text-sm">
                {insight.kind === "atencao" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                ) : insight.kind === "evolucao" ? (
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        )}

        {showChart ? <EvolutionChart data={data} /> : null}

        {compactHighlights && (
          <div>
            {!compact ? <p className="mb-2 text-sm font-medium">Destaques da semana</p> : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <HighlightItem
                title="Maior evolução"
                name={highlights.maior_carga?.name}
                detail={highlights.maior_carga?.delta}
              />
              {!compact ? (
                <HighlightItem
                  title="Melhor evolução de reps"
                  name={highlights.maior_reps?.name}
                  detail={highlights.maior_reps?.delta}
                />
              ) : null}
              {!compact ? (
                <HighlightItem
                  title="Estável"
                  name={highlights.estavel?.name}
                  detail={highlights.estavel?.detail}
                />
              ) : null}
              <HighlightItem
                title="Atenção"
                name={highlights.atencao?.name}
                detail={highlights.atencao?.detail}
              />
            </div>
          </div>
        )}

        {!compact ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Sessões registadas</p>
            <p className="text-lg font-semibold">
              {data.consistency.sessions_logged}
              {data.consistency.sessions_planned != null ? (
                <span className="text-sm font-normal text-muted-foreground">
                  /{data.consistency.sessions_planned}
                </span>
              ) : null}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Sessões concluídas</p>
            <p className="text-lg font-semibold">{data.consistency.sessions_completed}</p>
          </div>
          {data.consistency.fill_pct != null ? (
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Séries preenchidas</p>
              <p className="text-lg font-semibold">{data.consistency.fill_pct}%</p>
            </div>
          ) : null}
        </div>
        ) : null}

        {!compact && listedExercises.length > 0 && (
          <Accordion type="single" collapsible>
            {showVolume ? (
              <AccordionItem value="volume">
                <AccordionTrigger className="text-sm">Tendência de volume</AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Soma carga × reps nas séries com carga numérica. Semanas sem dados ficam vazias.
                  </p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.volume_chart?.points || []}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} width={40} />
                        <Tooltip {...rechartsTooltipProps} />
                        <Line
                          type="monotone"
                          dataKey="volume"
                          name="Volume"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}
            <AccordionItem value="detalhes">
              <AccordionTrigger className="text-sm">
                Exercícios acompanhados ({listedExercises.length}
                {hiddenNovos > 0 ? ` + ${hiddenNovos} novos` : ""})
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {listedExercises.map((ex) => (
                    <li
                      key={ex.key}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{ex.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {STATUS_LABEL[ex.status]}
                          {ex.current.carga_label ? ` · ${ex.current.carga_label}` : ""}
                          {ex.current.reps != null ? ` × ${ex.current.reps}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {ex.sessions_this_week}x
                      </Badge>
                    </li>
                  ))}
                </ul>
                {hiddenNovos > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Os restantes exercícios novos não entram no resumo — ainda não têm histórico para comparar.
                  </p>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        {!compact ? (
        <p className="text-[11px] text-muted-foreground">
          Comparação com o próprio histórico. Carga estável não é automaticamente estagnação.
        </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
