export type LoadProgressionTrend =
  | "evoluindo"
  | "estavel"
  | "em_queda"
  | "dados_insuficientes";

export type LoadProgressionPeriodKey = "7" | "30" | "90" | "180" | "all";

export type LoadProgressionPoint = {
  date: string;
  carga: number | null;
  unidade: string | null;
  reps: number | null;
  series_count: number;
  volume: number | null;
  carga_label: string | null;
};

export type LoadProgressionExercise = {
  key: string;
  name: string;
  sessions_count: number;
  ultima_carga_label: string | null;
  delta_carga: number | null;
  delta_label: string | null;
  trend: LoadProgressionTrend;
  trend_label: string;
  points: LoadProgressionPoint[];
};

export type LoadProgressionResponse = {
  aluno_id: string;
  gerado_em: string;
  cached?: boolean;
  period: {
    key: string;
    days: number | null;
    start: string | null;
    end: string;
  };
  source: "logbook";
  empty: boolean;
  exercises: LoadProgressionExercise[];
  selected_exercise?: LoadProgressionExercise | null;
  summary: {
    title: string;
    body: string;
    trend: LoadProgressionTrend;
  } | null;
};
