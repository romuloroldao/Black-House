import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { rechartsTooltipProps } from "@/lib/recharts-theme";
import {
  buildWeightChartData,
  computeWeightDelta,
  formatDeltaKg,
  labelPesoOrigem,
  PESO_ORIGEM_COLORS,
  type PesoHistoricoEntry,
} from "@/lib/weight-history";

type Props = {
  historico?: PesoHistoricoEntry[];
  pesoAtual?: number | null;
  loading?: boolean;
  compact?: boolean;
};

function DeltaBadge({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const up = value > 0;
  const down = value < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Scale;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
        <Icon className={`h-3.5 w-3.5 ${up ? "text-amber-600" : down ? "text-emerald-600" : ""}`} />
        {formatDeltaKg(value)}
      </p>
    </div>
  );
}

export default function WeightTimelineChart({
  historico = [],
  pesoAtual,
  loading = false,
  compact = false,
}: Props) {
  const chartData = useMemo(() => buildWeightChartData(historico), [historico]);
  const delta = useMemo(() => computeWeightDelta(chartData), [chartData]);

  const pesoDisplay =
    pesoAtual ?? (chartData.length ? chartData[chartData.length - 1].peso : null);

  const yDomain = useMemo(() => {
    if (!chartData.length) return [60, 100];
    const values = chartData.map((p) => p.peso);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(1, (max - min) * 0.15);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [chartData]);

  const recentTimeline = useMemo(
    () => [...chartData].reverse().slice(0, compact ? 3 : 6),
    [chartData, compact],
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[220px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Evolução do peso</CardTitle>
        <CardDescription>
          Histórico a partir de check-ins, perfil e cadastro — atualizado automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
            <p className="text-xs text-muted-foreground">Peso atual</p>
            <p className="text-lg font-bold text-primary">
              {pesoDisplay != null
                ? `${Number(pesoDisplay).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`
                : "—"}
            </p>
          </div>
          <DeltaBadge value={delta.desdeAnterior} label="Vs. registo anterior" />
          <DeltaBadge value={delta.desdeInicio} label="Desde o 1º registo" />
        </div>

        {chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <Scale className="mb-2 h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium">Histórico insuficiente para gráfico</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Com pelo menos dois registos de peso (check-in ou perfil), a evolução aparece aqui.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={compact ? 200 : 260}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 11 }}
                width={40}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                {...rechartsTooltipProps}
                formatter={(value: number) => [
                  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`,
                  "Peso",
                ]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { date?: string; origemLabel?: string };
                  if (!row?.date) return "";
                  const d = new Date(row.date);
                  const dateStr = Number.isNaN(d.getTime())
                    ? ""
                    : format(d, "dd MMM yyyy", { locale: ptBR });
                  return `${dateStr}${row.origemLabel ? ` · ${row.origemLabel}` : ""}`;
                }}
              />
              <Line
                type="monotone"
                dataKey="peso"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={({ cx, cy, payload }) => {
                  const color =
                    PESO_ORIGEM_COLORS[payload.origem as string] ?? "hsl(var(--primary))";
                  if (cx == null || cy == null) return null;
                  return (
                    <circle
                      key={payload.id}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={color}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {recentTimeline.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Registos recentes
            </p>
            <ul className="space-y-1.5">
              {recentTimeline.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {entry.peso.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(entry.date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {labelPesoOrigem(entry.origem)}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
