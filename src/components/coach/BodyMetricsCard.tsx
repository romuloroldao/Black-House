import { Activity, Ruler, Scale, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { BodyMetricsResponse } from "@/types/profile-completeness";

type Props = {
  metrics: BodyMetricsResponse | null;
  loading?: boolean;
};

function formatPeso(v: number | null | undefined) {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}

function formatAltura(cm: number | null | undefined, m: number | null | undefined) {
  if (m != null) return `${m.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
  if (cm != null) return `${(cm / 100).toFixed(2)} m`;
  return "—";
}

export default function BodyMetricsCard({ metrics, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const sexoLabel =
    metrics?.sexo === "M" ? "Masculino" : metrics?.sexo === "F" ? "Feminino" : "—";
  const incomplete = metrics?.profile_status && !metrics.profile_status.is_complete;
  const hasAnyData =
    metrics &&
    (metrics.peso_kg != null ||
      metrics.altura_cm != null ||
      metrics.idade_anos != null ||
      metrics.sexo != null ||
      metrics.tmb_kcal != null);

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Dados corporais</CardTitle>
          {incomplete && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700">
              Perfil incompleto ({metrics.profile_status?.completion_pct}%)
            </Badge>
          )}
        </div>
        <CardDescription>
          Referência rápida para decisões de dieta e treino
          {metrics?.tmb_kcal != null && " · TMB Harris-Benedict"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Este aluno ainda não tem peso, altura, idade ou sexo preenchidos. Peça para completar o
            perfil no portal ou atualize na importação de ficha.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricTile icon={Scale} label="Peso" value={formatPeso(metrics?.peso_kg)} />
            <MetricTile
              icon={Ruler}
              label="Altura"
              value={formatAltura(metrics?.altura_cm, metrics?.altura_m)}
            />
            <MetricTile
              icon={User}
              label="Idade"
              value={metrics?.idade_anos != null ? `${metrics.idade_anos} anos` : "—"}
            />
            <MetricTile icon={User} label="Sexo" value={sexoLabel} />
            <MetricTile
              icon={Activity}
              label="TMB"
              value={
                metrics?.tmb_kcal != null
                  ? `${metrics.tmb_kcal.toLocaleString("pt-BR")} kcal/dia`
                  : "—"
              }
              highlight
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Scale;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`font-semibold ${highlight ? "text-lg text-primary" : "text-base"}`}>{value}</p>
    </div>
  );
}
