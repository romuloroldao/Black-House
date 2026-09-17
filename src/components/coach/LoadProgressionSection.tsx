import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Dumbbell, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { rechartsTooltipProps } from "@/lib/recharts-theme";
import { useLogbookProgressao } from "@/hooks/useLogbookProgressao";
import type {
  LoadProgressionExercise,
  LoadProgressionPeriodKey,
  LoadProgressionTrend,
} from "@/types/logbook-progressao";
import PremiumEmptyState from "@/components/student/PremiumEmptyState";

const ALL_EXERCISES = "__all__";

const PERIOD_OPTIONS: { value: LoadProgressionPeriodKey; label: string }[] = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "6 meses" },
  { value: "all", label: "Todo período" },
];

function formatDay(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

function trendBadgeVariant(trend: LoadProgressionTrend) {
  if (trend === "evoluindo") return "default" as const;
  if (trend === "em_queda") return "destructive" as const;
  if (trend === "estavel") return "secondary" as const;
  return "outline" as const;
}

function TrendIcon({ trend }: { trend: LoadProgressionTrend }) {
  if (trend === "evoluindo") return <TrendingUp className="h-3.5 w-3.5" aria-hidden />;
  if (trend === "em_queda") return <TrendingDown className="h-3.5 w-3.5" aria-hidden />;
  return null;
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
  label?: string;
  exerciseName?: string;
};

function ProgressionTooltip({ active, payload, label, exerciseName }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const cargaLabel = row.carga_label as string | null;
  const reps = row.reps as number | null;
  const seriesCount = row.series_count as number;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      {exerciseName ? <p className="text-muted-foreground">{exerciseName}</p> : null}
      {cargaLabel ? (
        <p className="mt-1">
          {cargaLabel}
          {reps != null ? ` × ${reps} reps` : ""}
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">Sem carga numérica</p>
      )}
      {seriesCount > 0 ? (
        <p className="text-xs text-muted-foreground">{seriesCount} séries</p>
      ) : null}
    </div>
  );
}

function buildChartData(exercise: LoadProgressionExercise | null) {
  if (!exercise) return [];
  return exercise.points
    .filter((p) => p.carga != null)
    .map((p) => ({
      label: formatDay(p.date),
      date: p.date,
      carga: p.carga,
      carga_label: p.carga_label,
      reps: p.reps,
      series_count: p.series_count,
    }));
}

function buildSummaryForExercise(
  exercise: LoadProgressionExercise,
  periodDays: number | null,
) {
  const periodLabel =
    periodDays != null ? `últimos ${periodDays} dias` : "todo o período registrado";
  const numeric = exercise.points.filter((p) => p.carga != null);

  if (exercise.trend === "dados_insuficientes") {
    return {
      title: "Evolução recente",
      body:
        numeric.length === 0
          ? "Ainda não há registros de carga suficientes para este exercício."
          : "Poucos registros disponíveis para identificar uma tendência.",
    };
  }
  if (exercise.trend === "evoluindo" && exercise.delta_label) {
    return {
      title: "Evolução recente",
      body: `O aluno aumentou a carga utilizada em ${exercise.name} em ${exercise.delta_label.replace(/^\+/, "")} nos ${periodLabel}.`,
    };
  }
  if (exercise.trend === "em_queda") {
    return {
      title: "Evolução recente",
      body: "A carga utilizada apresentou redução nas últimas sessões.",
    };
  }
  if (exercise.trend === "estavel" && numeric.length >= 4) {
    const n = Math.min(numeric.length, 4);
    return {
      title: "Evolução recente",
      body: `A carga permanece estável nas últimas ${n} sessões.`,
    };
  }
  return {
    title: "Evolução recente",
    body: `A carga de ${exercise.name} manteve-se sem alteração relevante nos ${periodLabel}.`,
  };
}

type LoadProgressionSectionProps = {
  alunoId?: string | null;
  className?: string;
};

export default function LoadProgressionSection({ alunoId, className }: LoadProgressionSectionProps) {
  const [period, setPeriod] = useState<LoadProgressionPeriodKey>("30");
  const [selectedKey, setSelectedKey] = useState<string>(ALL_EXERCISES);
  const { data, loading, error, reload } = useLogbookProgressao({
    alunoId,
    period,
    enabled: Boolean(alunoId),
  });

  const exercisesWithLoad = useMemo(
    () => (data?.exercises || []).filter((e) => e.points.some((p) => p.carga != null)),
    [data?.exercises],
  );

  const exerciseOptions = useMemo(
    () => [
      { value: ALL_EXERCISES, label: "Todos os exercícios" },
      ...exercisesWithLoad.map((e) => ({
        value: e.key,
        label: e.name,
        description: e.ultima_carga_label || undefined,
      })),
    ],
    [exercisesWithLoad],
  );

  const selectedExercise = useMemo(() => {
    if (selectedKey === ALL_EXERCISES) {
      return exercisesWithLoad[0] ?? null;
    }
    return exercisesWithLoad.find((e) => e.key === selectedKey) ?? null;
  }, [selectedKey, exercisesWithLoad]);

  const chartData = useMemo(() => buildChartData(selectedExercise), [selectedExercise]);
  const summary = useMemo(() => {
    if (!selectedExercise || !data) return null;
    return buildSummaryForExercise(selectedExercise, data.period.days);
  }, [selectedExercise, data]);

  const fewDataPoints =
    selectedExercise != null &&
    selectedExercise.points.filter((p) => p.carga != null).length < 2;

  if (loading) {
    return (
      <Card className={cn("shadow-card", className)}>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 flex-1" />
          </div>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("shadow-card", className)}>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Progressão de cargas</CardTitle>
          <CardDescription>
            Acompanhe a evolução das cargas registradas pelo aluno no Logbook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.empty || exercisesWithLoad.length === 0) {
    return (
      <Card className={cn("shadow-card", className)}>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Progressão de cargas</CardTitle>
          <CardDescription>
            Acompanhe a evolução das cargas registradas pelo aluno no Logbook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PremiumEmptyState
            icon={Dumbbell}
            title="Ainda não há dados suficientes"
            description="Ainda não há registros suficientes no Logbook para acompanhar a progressão. Incentive o aluno a registrar suas cargas no Logbook para que sua evolução possa ser acompanhada."
            className="min-h-[180px] border-0 bg-transparent py-4 shadow-none"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-card", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg sm:text-xl">Progressão de cargas</CardTitle>
        <CardDescription>
          Acompanhe a evolução das cargas registradas pelo aluno no Logbook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as LoadProgressionPeriodKey)}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Combobox
            className="w-full flex-1"
            options={exerciseOptions}
            value={selectedKey}
            onSelect={setSelectedKey}
            placeholder="Exercício"
            searchPlaceholder="Buscar exercício..."
            emptyText="Nenhum exercício com registros."
          />
        </div>

        {exercisesWithLoad.length > 1 && selectedKey === ALL_EXERCISES ? (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercício</TableHead>
                  <TableHead className="text-right">Última carga</TableHead>
                  <TableHead className="text-right">Evolução</TableHead>
                  <TableHead className="text-right">Tendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercisesWithLoad.map((ex) => (
                  <TableRow
                    key={ex.key}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedKey(ex.key)}
                  >
                    <TableCell className="font-medium">{ex.name}</TableCell>
                    <TableCell className="text-right">{ex.ultima_carga_label || "—"}</TableCell>
                    <TableCell className="text-right">{ex.delta_label || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={trendBadgeVariant(ex.trend)} className="gap-1">
                        <TrendIcon trend={ex.trend} />
                        {ex.trend_label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {summary ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{summary.title}</p>
              {selectedExercise ? (
                <Badge variant={trendBadgeVariant(selectedExercise.trend)} className="gap-1">
                  <TrendIcon trend={selectedExercise.trend} />
                  {selectedExercise.name}
                  {selectedExercise.delta_label ? ` · ${selectedExercise.delta_label}` : ""}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{summary.body}</p>
          </div>
        ) : null}

        {fewDataPoints ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Poucos registros disponíveis para identificar uma tendência.</span>
          </div>
        ) : null}

        {chartData.length > 0 && selectedExercise ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {selectedExercise.name}
              {selectedExercise.ultima_carga_label
                ? ` · última: ${selectedExercise.ultima_carga_label}`
                : ""}
            </p>
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={40} domain={["auto", "auto"]} />
                  <Tooltip
                    {...rechartsTooltipProps}
                    content={
                      <ProgressionTooltip exerciseName={selectedExercise.name} />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="carga"
                    name="Carga"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    connectNulls={false}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground">Baseado nos registros do Logbook.</p>
      </CardContent>
    </Card>
  );
}
