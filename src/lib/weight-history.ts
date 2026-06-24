import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type PesoHistoricoEntry = {
  id: string;
  peso_kg: number;
  registrado_em: string;
  origem: string;
  origem_id?: string | null;
};

export type WeightChartPoint = {
  id: string;
  date: string;
  dateLabel: string;
  peso: number;
  origem: string;
  origemLabel: string;
};

export const PESO_ORIGEM_LABELS: Record<string, string> = {
  weekly_checkin: "Check-in semanal",
  profile_edit: "Perfil",
  signup: "Cadastro",
  coach_edit: "Coach",
  import: "Importação",
  integration: "Integração",
};

export const PESO_ORIGEM_COLORS: Record<string, string> = {
  weekly_checkin: "hsl(var(--primary))",
  profile_edit: "hsl(var(--chart-2))",
  signup: "hsl(var(--chart-3))",
  coach_edit: "hsl(var(--chart-4))",
  import: "hsl(var(--muted-foreground))",
  integration: "hsl(var(--chart-5, var(--chart-2)))",
};

export function labelPesoOrigem(origem: string): string {
  return PESO_ORIGEM_LABELS[origem] ?? origem;
}

export function buildWeightChartData(entries: PesoHistoricoEntry[]): WeightChartPoint[] {
  if (!entries?.length) return [];

  const sorted = [...entries].sort(
    (a, b) => new Date(a.registrado_em).getTime() - new Date(b.registrado_em).getTime(),
  );

  return sorted.map((entry) => {
    const d = new Date(entry.registrado_em);
    return {
      id: entry.id,
      date: entry.registrado_em,
      dateLabel: Number.isNaN(d.getTime())
        ? "—"
        : format(d, "dd/MM/yy", { locale: ptBR }),
      peso: Number(entry.peso_kg),
      origem: entry.origem,
      origemLabel: labelPesoOrigem(entry.origem),
    };
  });
}

export function computeWeightDelta(points: WeightChartPoint[]) {
  if (points.length < 2) {
    return { desdeInicio: null as number | null, desdeAnterior: null as number | null };
  }
  const first = points[0].peso;
  const last = points[points.length - 1].peso;
  const prev = points[points.length - 2].peso;
  return {
    desdeInicio: Math.round((last - first) * 10) / 10,
    desdeAnterior: Math.round((last - prev) * 10) / 10,
  };
}

export function formatDeltaKg(delta: number | null): string {
  if (delta == null || !Number.isFinite(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}
