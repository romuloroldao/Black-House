export type WorkoutEvolutionConfidence = "none" | "low" | "medium" | "high";
export type WorkoutEvolutionTone = "positive" | "stable" | "attention" | "insufficient";
export type WorkoutExerciseStatus =
  | "subiu_carga"
  | "subiu_reps"
  | "estavel"
  | "abaixo_ultimo"
  | "novo"
  | "dados_incompletos"
  | "unidade_mista";

export type WorkoutEvolutionPoint = {
  week_start: string;
  label: string;
  carga: number | null;
  unidade: string | null;
  volume?: number | null;
};

export type WorkoutEvolutionExercise = {
  key: string;
  name: string;
  status: WorkoutExerciseStatus;
  comparable: boolean;
  current: {
    carga: number | null;
    carga_label: string | null;
    reps: number | null;
    volume: number | null;
    unidade: string | null;
    date: string;
  };
  previous: {
    carga: number | null;
    carga_label: string | null;
    reps: number | null;
    volume: number | null;
    unidade: string | null;
    date: string;
  } | null;
  delta_carga: number | null;
  delta_reps: number | null;
  sessions_this_week: number;
  week_points: WorkoutEvolutionPoint[];
};

export type WorkoutEvolutionResponse = {
  aluno_id: string;
  audience: "aluno" | "coach";
  gerado_em: string;
  cached?: boolean;
  week: { start: string; end: string };
  previous_week: { start: string; end: string };
  confidence: WorkoutEvolutionConfidence;
  confidence_label: string;
  headline: { title: string; body: string; tone: WorkoutEvolutionTone };
  chart_comment: { title: string; body: string } | null;
  primary_chart: {
    type: "load" | "none";
    series: { exercise_name: string; points: WorkoutEvolutionPoint[] }[];
  };
  volume_chart: { points: { week_start: string; label: string; volume: number | null }[] } | null;
  consistency: {
    sessions_logged: number;
    sessions_completed: number;
    sessions_planned: number | null;
    series_logged: number;
    series_prescribed: number | null;
    fill_pct: number | null;
  };
  highlights: {
    maior_carga?: { name: string; delta: string | null };
    maior_reps?: { name: string; delta: string | null };
    estavel?: { name: string; detail: string };
    atencao?: { name: string; detail: string };
  };
  insights: { kind: string; text: string }[];
  exercises: WorkoutEvolutionExercise[];
  counts?: {
    subiu_carga: number;
    subiu_reps: number;
    estavel: number;
    abaixo_ultimo: number;
    novo: number;
    dados_incompletos: number;
    unidade_mista: number;
  };
  empty: boolean;
  is_fallback?: boolean;
  requested_week?: { start: string; end: string };
  fallback_label?: string;
};
